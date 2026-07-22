#!/usr/bin/env python3
"""Evaluation harness for FeatureIQ's Claude-based backlog scoring.

Sends a labelled test set to the running /score endpoint and compares
Claude's output against human-labelled ground truth. See eval/README.md.
"""

import argparse
import csv
import json
import statistics
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from scipy.stats import spearmanr as _scipy_spearmanr
except ImportError:
    _scipy_spearmanr = None

EVAL_DIR = Path(__file__).resolve().parent
DEFAULT_DATASET = EVAL_DIR / "dataset.json"
RESULTS_LOG = EVAL_DIR / "results" / "history.csv"

MOSCOW_ORDER = ["wont", "could", "should", "must"]
RISK_ORDER = ["Low", "Medium", "High"]
CONFIDENCE_ORDER = ["Low", "Medium", "High"]


# -- Scoring logic, ported from public/js/app.js to stay consistent with --
# what the app actually shows users (Claude never returns MoSCoW/score directly). --

def compute_score(impact, effort, alignment):
    return impact + (10 - effort) + alignment


def get_moscow(impact, effort, alignment):
    if impact >= 7 and effort <= 5 and alignment >= 7:
        return "must"
    if impact >= 7 and alignment >= 7:
        return "should"
    if impact >= 5 or alignment >= 5:
        return "could"
    return "wont"


# -- Dataset + API --
def load_dataset(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list) or not data:
        raise ValueError("Dataset must be a non-empty JSON array.")
    for i, item in enumerate(data):
        if "expected" not in item:
            raise ValueError(f"Dataset item {i} ('{item.get('name', '?')}') is missing 'expected' labels.")
    return data


def call_score_endpoint(base_url, features, timeout=180):
    payload = json.dumps({
        "features": features,
        "priorities": [],
        "additionalContext": "",
    }).encode("utf-8")
    req = Request(
        f"{base_url.rstrip('/')}/score",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        raise RuntimeError(f"/score returned HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
    except URLError as e:
        raise RuntimeError(f"Could not reach {base_url}/score ({e.reason}). Is `npm start` running?")
    if "error" in body:
        raise RuntimeError(f"/score error: {body['error']}")
    return body["results"]


# -- Metrics --
def mae(pairs):
    return statistics.fmean(abs(p - e) for p, e in pairs) if pairs else float("nan")


def within_tolerance(pairs, tol):
    if not pairs:
        return float("nan")
    hits = sum(1 for p, e in pairs if abs(p - e) <= tol)
    return hits / len(pairs)


def exact_match(pairs):
    if not pairs:
        return float("nan")
    hits = sum(1 for p, e in pairs if p == e)
    return hits / len(pairs)


def confusion_matrix(pairs, labels):
    matrix = {expected: {predicted: 0 for predicted in labels} for expected in labels}
    for predicted, expected in pairs:
        if expected in matrix and predicted in matrix[expected]:
            matrix[expected][predicted] += 1
    return matrix


def print_confusion(title, matrix, labels):
    print(f"\n{title} confusion matrix (rows = expected, cols = predicted)")
    print("  ".ljust(12) + "".join(label.ljust(8) for label in labels))
    for row_label in labels:
        row = matrix[row_label]
        print(row_label.ljust(12) + "".join(str(row[col]).ljust(8) for col in labels))


def spearman(xs, ys):
    if len(xs) < 2:
        return float("nan")
    if _scipy_spearmanr is not None:
        rho, _ = _scipy_spearmanr(xs, ys)
        return rho

    def rank(values):
        order = sorted(range(len(values)), key=lambda i: values[i])
        ranks = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            avg_rank = (i + j) / 2
            for k in range(i, j + 1):
                ranks[order[k]] = avg_rank
            i = j + 1
        return ranks

    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    d2 = sum((a - b) ** 2 for a, b in zip(rx, ry))
    return 1 - (6 * d2) / (n * (n ** 2 - 1))


# -- Git helper for the results log --
def get_git_commit():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=EVAL_DIR, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return "unknown"


def log_result(dataset_path, n, runs, impact_pairs, effort_pairs, alignment_pairs, risk_pairs, moscow_pairs, rho):
    RESULTS_LOG.parent.mkdir(parents=True, exist_ok=True)
    is_new = not RESULTS_LOG.exists()
    with open(RESULTS_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow([
                "timestamp", "git_commit", "dataset", "n_features", "runs",
                "impact_mae", "effort_mae", "alignment_mae",
                "risk_accuracy", "moscow_accuracy", "spearman_rho",
            ])
        writer.writerow([
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            get_git_commit(), Path(dataset_path).name, n, runs,
            round(mae(impact_pairs), 3), round(mae(effort_pairs), 3), round(mae(alignment_pairs), 3),
            round(exact_match(risk_pairs), 3), round(exact_match(moscow_pairs), 3),
            round(rho, 3) if rho == rho else "",
        ])
    print(f"\nLogged to {RESULTS_LOG.relative_to(EVAL_DIR.parent)}")


# -- Main eval run --
def run_eval(dataset_path, base_url, runs, tolerance):
    dataset = load_dataset(dataset_path)
    features = [{k: v for k, v in item.items() if k != "expected"} for item in dataset]
    expected_by_name = {item["name"]: item["expected"] for item in dataset}

    all_predictions = []
    for run_idx in range(runs):
        print(f"Run {run_idx + 1}/{runs}: scoring {len(features)} features via {base_url}/score ...")
        results = call_score_endpoint(base_url, features)
        all_predictions.append({r["name"]: r for r in results})

    # Average impact/effort/alignment across repeated runs to smooth Claude's
    # run-to-run variance; take the mode for categorical fields.
    averaged = {}
    for name in expected_by_name:
        runs_for_item = [p[name] for p in all_predictions if name in p]
        if not runs_for_item:
            print(f"WARNING: no prediction returned for '{name}', skipping.", file=sys.stderr)
            continue
        averaged[name] = {
            "impact": round(statistics.fmean(r["impact"] for r in runs_for_item)),
            "effort": round(statistics.fmean(r["effort"] for r in runs_for_item)),
            "alignment": round(statistics.fmean(r["alignment"] for r in runs_for_item)),
            "risk": statistics.mode([r["risk"] for r in runs_for_item]),
            "confidence": statistics.mode([r["confidence"] for r in runs_for_item]),
        }

    impact_pairs, effort_pairs, alignment_pairs = [], [], []
    risk_pairs, confidence_pairs, moscow_pairs = [], [], []
    pred_scores, expected_scores = [], []
    rows = []

    for name, expected in expected_by_name.items():
        if name not in averaged:
            continue
        pred = averaged[name]

        impact_pairs.append((pred["impact"], expected["impact"]))
        effort_pairs.append((pred["effort"], expected["effort"]))
        alignment_pairs.append((pred["alignment"], expected["alignment"]))
        risk_pairs.append((pred["risk"], expected["risk"]))
        confidence_pairs.append((pred["confidence"], expected["confidence"]))

        pred_moscow = get_moscow(pred["impact"], pred["effort"], pred["alignment"])
        expected_moscow = get_moscow(expected["impact"], expected["effort"], expected["alignment"])
        moscow_pairs.append((pred_moscow, expected_moscow))

        pred_scores.append(compute_score(pred["impact"], pred["effort"], pred["alignment"]))
        expected_scores.append(compute_score(expected["impact"], expected["effort"], expected["alignment"]))

        rows.append({
            "name": name,
            "impact": (pred["impact"], expected["impact"]),
            "effort": (pred["effort"], expected["effort"]),
            "alignment": (pred["alignment"], expected["alignment"]),
            "risk": (pred["risk"], expected["risk"]),
        })

    print("\n" + "=" * 72)
    print(f"EVAL RESULTS  --  {len(rows)} features, {runs} run(s) per feature averaged")
    print("=" * 72)

    print(f"\n{'Field':<12}{'MAE':>8}{'+/-' + str(tolerance) + ' acc':>10}{'Exact':>10}")
    for field, pairs in [("Impact", impact_pairs), ("Effort", effort_pairs), ("Alignment", alignment_pairs)]:
        print(f"{field:<12}{mae(pairs):>8.2f}{within_tolerance(pairs, tolerance):>10.0%}{exact_match(pairs):>10.0%}")

    print(f"\n{'Field':<12}{'Exact match':>14}")
    print(f"{'Risk':<12}{exact_match(risk_pairs):>14.0%}")
    print(f"{'Confidence':<12}{exact_match(confidence_pairs):>14.0%}")
    print(f"{'MoSCoW':<12}{exact_match(moscow_pairs):>14.0%}")

    print_confusion("Risk", confusion_matrix(risk_pairs, RISK_ORDER), RISK_ORDER)
    print_confusion("MoSCoW", confusion_matrix(moscow_pairs, MOSCOW_ORDER), MOSCOW_ORDER)

    rho = spearman(pred_scores, expected_scores)
    engine = "scipy" if _scipy_spearmanr is not None else "manual fallback"
    print(f"\nRanking correlation (Spearman rho, {engine}): {rho:.3f}")
    print("  1.0 = perfect prioritisation order agreement, 0.0 = no correlation, -1.0 = inverted.")

    worst = sorted(
        rows,
        key=lambda r: abs(r["impact"][0] - r["impact"][1]) + abs(r["effort"][0] - r["effort"][1]) + abs(r["alignment"][0] - r["alignment"][1]),
        reverse=True,
    )[:5]
    print("\nWorst mismatches (by combined impact+effort+alignment error):")
    for r in worst:
        print(f"  {r['name']}")
        print(
            f"    impact {r['impact'][0]} vs {r['impact'][1]}"
            f"  |  effort {r['effort'][0]} vs {r['effort'][1]}"
            f"  |  alignment {r['alignment'][0]} vs {r['alignment'][1]}"
            f"  |  risk {r['risk'][0]} vs {r['risk'][1]}  (predicted vs expected)"
        )

    log_result(dataset_path, len(rows), runs, impact_pairs, effort_pairs, alignment_pairs, risk_pairs, moscow_pairs, rho)


def main():
    parser = argparse.ArgumentParser(description="Evaluate FeatureIQ's Claude scoring against a labelled dataset.")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to labelled dataset JSON.")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of the running FeatureIQ server.")
    parser.add_argument("--runs", type=int, default=1, help="Repeat scoring N times per feature and average (reduces Claude's run-to-run variance, costs N x API calls).")
    parser.add_argument("--tolerance", type=int, default=1, help="Tolerance window (in points) for the '+/-N accuracy' metric.")
    args = parser.parse_args()

    try:
        run_eval(args.dataset, args.url, args.runs, args.tolerance)
    except (RuntimeError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
