const { buildPrompt } = require('../utils/promptBuilder');

const VALID_RISKS = new Set(['Low', 'Medium', 'High']);
const VALID_CONFIDENCE = new Set(['Low', 'Medium', 'High']);
const VALID_STORY_POINTS = new Set([1, 2, 3, 5, 8, 13, 21]);

function clampScore(value, field, index) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid response item at index ${index}: ${field} must be a number.`);
  }
  return Math.min(Math.max(Math.round(number), 1), 10);
}

function normalizeStoryPoints(value) {
  const number = Number(value);
  if (VALID_STORY_POINTS.has(number)) return number;
  if (!Number.isFinite(number)) return 3;
  return [...VALID_STORY_POINTS].reduce((closest, candidate) => (
    Math.abs(candidate - number) < Math.abs(closest - number) ? candidate : closest
  ), 3);
}

function normalizeClaudeResults(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error('Claude response JSON must be an array.');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid response item at index ${index}: expected object.`);
    }
    if (!item.name || typeof item.name !== 'string') {
      throw new Error(`Invalid response item at index ${index}: missing or invalid name.`);
    }
    const name = item.name.trim();
    if (!name) {
      throw new Error(`Invalid response item at index ${index}: missing or invalid name.`);
    }

    const risk = VALID_RISKS.has(item.risk) ? item.risk : 'Medium';
    const confidence = VALID_CONFIDENCE.has(item.confidence) ? item.confidence : 'Medium';

    return {
      name,
      impact: clampScore(item.impact, 'impact', index),
      effort: clampScore(item.effort, 'effort', index),
      alignment: clampScore(item.alignment, 'alignment', index),
      storyPoints: normalizeStoryPoints(item.storyPoints),
      risk,
      nextStep: typeof item.nextStep === 'string' ? item.nextStep.trim().slice(0, 1000) : '',
      confidence,
      rationale: typeof item.rationale === 'string' ? item.rationale.trim().slice(0, 1000) : ''
    };
  });
}

async function scoreFeatures(features, priorities, additionalContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
  }

  if (!features || !Array.isArray(features) || features.length === 0) {
    throw new Error('No features provided for scoring.');
  }

  const prompt = buildPrompt(features, priorities, additionalContext);

  const fetchImpl = global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available. Run on Node 18+ or add a fetch polyfill.');
  }

  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API request failed (${response.status} ${response.statusText}): ${body}`);
  }

  const data = await response.json();
  if (data.type === 'error' || data.error) {
    const errorMessage = data.error?.message || (typeof data.error === 'string' ? data.error : 'Unknown Claude API error.');
    throw new Error(`Claude API error: ${errorMessage}`);
  }

  let text = null;
  if (Array.isArray(data.content) && data.content[0]?.text) {
    text = data.content[0].text;
  } else if (typeof data.completion === 'string') {
    text = data.completion;
  } else if (typeof data.text === 'string') {
    text = data.text;
  } else {
    throw new Error('Claude API returned an unexpected response format.');
  }

  const cleaned = text.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/(\[.*\])/s);
    if (!match) {
      throw new Error(`Failed to parse Claude response as JSON: ${err.message}`);
    }
    try {
      parsed = JSON.parse(match[1]);
    } catch (innerErr) {
      throw new Error(`Failed to parse Claude response JSON content: ${innerErr.message}`);
    }
  }

  return normalizeClaudeResults(parsed);
}

module.exports = { scoreFeatures, normalizeClaudeResults };
