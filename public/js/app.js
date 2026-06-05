// ── MoSCoW helpers ────────────────────────────────────────────────────────

function getMoSCoW(feature) {
  var impact    = feature.impact    || 0;
  var effort    = feature.effort    || 0;
  var alignment = feature.alignment || 0;
  if (impact >= 7 && effort <= 5 && alignment >= 7) return 'must';
  if (impact >= 7 && alignment >= 7)                return 'should';
  if (impact >= 5 || alignment >= 5)                return 'could';
  return 'wont';
}

function getMoSCoWLabel(feature) {
  var map = { must: 'Must Ship', should: 'Should Ship', could: 'Consider', wont: 'Deprioritise' };
  return map[getMoSCoW(feature)];
}

function getMoSCoWColor(feature) {
  var map = { must: '#16a34a', should: '#2563eb', could: '#d97706', wont: '#dc2626' };
  return map[getMoSCoW(feature)];
}

function getMoSCoWReason(feature) {
  var tier = getMoSCoW(feature);
  var i = feature.impact    || 0;
  var e = feature.effort    || 0;
  var a = feature.alignment || 0;
  if (tier === 'must')   return 'High impact (' + i + '/10), manageable effort (' + e + '/10), strong alignment (' + a + '/10). Prioritise in next sprint.';
  if (tier === 'should') return 'Strong impact (' + i + '/10) and alignment (' + a + '/10) but higher effort (' + e + '/10). Plan for upcoming quarter.';
  if (tier === 'could')  return 'Moderate scores across dimensions. Consider when capacity allows.';
  return 'Low impact or high effort relative to value. Review or break down before committing.';
}

// ── Main App module ───────────────────────────────────────────────────────

const App = (() => {
  let scoredData = [];

  function computeScore(f) {
    return ((f.impact * 1) + ((10 - f.effort) * 1) + (f.alignment * 1)).toFixed(1);
  }

  function getPriorities() {
    return [...document.querySelectorAll('.priority-checkbox:checked')].map(cb => cb.value);
  }

  function getAdditionalContext() {
    const el = document.getElementById('additionalContext');
    return el ? el.value.trim() : '';
  }

  // ── File handling ───────────────────────────────────────────────────────

  function handleFile(file) {
    CSVHandler.parse(file).then(({ count, fileName }) => {
      showToast(fileName + ' — ' + count + ' features loaded', 'success');
      setStep(2);
      openPrioritiesModal();
    }).catch(err => {
      showToast('Could not read CSV: ' + err, 'error');
    });
  }

  // ── Scoring ─────────────────────────────────────────────────────────────

  async function scoreFeatures() {
    const csvMeta  = CSVHandler.getMeta();
    const features = Object.keys(csvMeta);
    if (!features.length) {
      showToast('Please upload a CSV file first.', 'error');
      return;
    }

    const priorities        = getPriorities();
    const additionalContext = getAdditionalContext();

    setStep(3);
    showWorkspaceState();
    showSkeleton(features.length);
    startLoadingCounter(features.length);

    try {
      const res = await fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: features.map(name => ({ name, ...(csvMeta[name] || {}) })),
          priorities,
          additionalContext
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      scoredData = data.results.map(f => ({ ...f, score: computeScore(f) }));
      hideSkeleton();
      renderAll();
      setStep(4);
      unlockNav();
      showToast(scoredData.length + ' features scored successfully', 'success');

    } catch (err) {
      hideSkeleton();
      showToast('Scoring failed: ' + err.message, 'error');
      console.error(err);
    }
  }

  // ── Skeleton & loading ──────────────────────────────────────────────────

  function showSkeleton(count) {
    document.getElementById('tableWrap').style.display      = 'none';
    document.getElementById('skeletonLoader').style.display = 'block';
    const rows = document.getElementById('skeletonRows');
    rows.innerHTML = Array.from({ length: Math.min(count, 6) }).map((_, i) => `
      <div class="skel-row" style="animation-delay:${i * 0.1}s;">
        <div class="skel-block" style="width:70px;height:13px;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
          <div class="skel-block" style="width:${160 + i * 20}px;height:13px;"></div>
          <div class="skel-block" style="width:80px;height:11px;"></div>
        </div>
        <div class="skel-block" style="width:60px;height:18px;border-radius:4px;"></div>
        <div class="skel-block" style="width:80px;height:18px;border-radius:5px;"></div>
        <div class="skel-block" style="width:72px;height:14px;"></div>
      </div>
    `).join('');
  }

  function hideSkeleton() {
    document.getElementById('skeletonLoader').style.display  = 'none';
    document.getElementById('tableWrap').style.display       = 'block';
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    if (window._loadingInterval) {
      clearInterval(window._loadingInterval);
      window._loadingInterval = null;
    }
    const statusDot = document.getElementById('statusDot');
    if (statusDot) statusDot.className = 'status-dot ready';
  }

  function startLoadingCounter(total) {
    const names      = Object.keys(CSVHandler.getMeta());
    let current      = 0;
    const overlay    = document.getElementById('loadingOverlay');
    const bar        = document.getElementById('loadingBar');
    const currEl     = document.getElementById('loadingCurrent');
    const totalEl    = document.getElementById('loadingTotal');
    const nameEl     = document.getElementById('loadingFeatureName');
    const statusText = document.getElementById('statusText');
    const statusDot  = document.getElementById('statusDot');
    const statusWrap = document.getElementById('leftnavStatus');

    if (totalEl)   totalEl.textContent   = total;
    if (overlay)   overlay.style.display = 'flex';
    if (statusDot) statusDot.className   = 'status-dot loading';
    if (statusWrap) statusWrap.style.display = 'flex';

    const interval = setInterval(() => {
      current = Math.min(current + 1, total);
      const pct = Math.round((current / total) * 100);
      if (bar)       bar.style.width       = pct + '%';
      if (currEl)    currEl.textContent    = current;
      if (nameEl)    nameEl.textContent    = names[current - 1] || '';
      if (statusText) statusText.textContent = 'Scoring ' + current + ' of ' + total + '...';
      if (current >= total) clearInterval(interval);
    }, Math.max(600, 10000 / total));

    window._loadingInterval = interval;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  function getSorted() {
    return [...scoredData].sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
  }

  function getFiltered() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const epic   = document.getElementById('epicFilter')?.value  || '';
    const risk   = document.getElementById('riskFilter')?.value  || '';

    return getSorted().filter(f => {
      const meta        = CSVHandler.getMeta()[f.name] || {};
      const matchSearch = !search || f.name.toLowerCase().includes(search) || (f.rationale||'').toLowerCase().includes(search) || (meta.jiraId||'').toLowerCase().includes(search);
      const matchEpic   = !epic   || (meta.epic||'') === epic;
      const matchRisk   = !risk   || (f.risk||'Low') === risk;
      return matchSearch && matchEpic && matchRisk;
    });
  }

  function populateFilters() {
    const csvMeta = CSVHandler.getMeta();
    const epics   = [...new Set(Object.values(csvMeta).map(m => m.epic).filter(Boolean))];
    const epicSel = document.getElementById('epicFilter');
    if (epicSel) {
      epicSel.innerHTML = '<option value="">All epics</option>' + epics.map(e => '<option value="' + e + '">' + e + '</option>').join('');
    }
  }

  function updateKPIs(sorted) {
    const csvMeta   = CSVHandler.getMeta();
    const mustShip  = sorted.filter(f => getMoSCoW(f) === 'must').length;
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5).length;
    const highRisk  = sorted.filter(f => f.risk === 'High').length;
    const highConf  = sorted.filter(f => f.confidence === 'High').length;
    const confPct   = Math.round((highConf / sorted.length) * 100);

    document.getElementById('kpiCount').textContent        = sorted.length;
    document.getElementById('kpiHighPriority').textContent = mustShip;
    document.getElementById('kpiHighPct').textContent      = Math.round((mustShip / sorted.length) * 100) + '% of total';
    document.getElementById('kpiQuickWins').textContent    = quickWins;
    document.getElementById('kpiConfidence').textContent   = confPct + '%';
    document.getElementById('kpiHighRisk').textContent     = highRisk;

    const sub = document.getElementById('workspaceSub');
    if (sub) sub.textContent = 'AI has analysed ' + Object.keys(csvMeta).length + ' features from your JIRA backlog';
  }

  function buildInsight(sorted) {
    const highRisk  = sorted.filter(f => f.risk === 'High').length;
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5).length;
    const top       = sorted[0];
    let insight     = '';

    if (highRisk > 0) {
      insight = highRisk + ' high-risk feature' + (highRisk > 1 ? 's' : '') + ' detected that may need stakeholder review before committing to the roadmap.';
    } else if (quickWins > 0) {
      insight = quickWins + ' quick win' + (quickWins > 1 ? 's' : '') + ' identified — high impact features with low effort that can be shipped fast.';
    } else if (top) {
      insight = '"' + top.name + '" is your top priority with a MoSCoW classification of ' + getMoSCoWLabel(top) + '.';
    }

    if (insight) {
      document.getElementById('insightText').textContent    = insight;
      document.getElementById('insightBanner').style.display = 'flex';
    }
  }

  function renderAll() {
    const sorted = getSorted();
    populateFilters();
    updateKPIs(sorted);
    buildInsight(sorted);
    renderTable();
    ChartRenderer.render(sorted);
    buildOpportunities(sorted);
    buildSummary(sorted);
    PresentationMode.build(sorted);
    document.getElementById('whatsNext').style.display = 'flex';
    const statusWrap = document.getElementById('leftnavStatus');
    if (statusWrap) statusWrap.style.display = 'flex';
  }

  function renderTable() {
    const filtered  = getFiltered();
    const csvMeta   = CSVHandler.getMeta();
    const confColor = c => c === 'High' ? '#16a34a' : c === 'Medium' ? '#d97706' : '#dc2626';
    const confWidth = c => c === 'High' ? '90%'     : c === 'Medium' ? '55%'     : '22%';

    document.getElementById('tableBody').innerHTML = filtered.map(f => {
      const meta       = csvMeta[f.name] || {};
      const jira       = meta.jiraId || '—';
      const conf       = f.confidence || 'Medium';
      const spValue    = f.storyPoints || parseInt(meta.storyPoints) || 0;
      const fibMap     = {1:5, 2:10, 3:20, 5:35, 8:55, 13:75, 21:100};
      const spBarWidth = (fibMap[spValue] || Math.min((spValue/21)*100, 100)) + '%';
      const spColor    = spValue >= 13 ? '#dc2626' : spValue >= 8 ? '#d97706' : '#16a34a';
      const mColor     = getMoSCoWColor(f);
      const mLabel     = getMoSCoWLabel(f);

      return '<tr onclick="openDrawer(' + JSON.stringify(f).replace(/"/g, '&quot;') + ')">' +
        '<td><div class="row-jira">' + esc(jira) + '</div></td>' +
        '<td>' +
          '<div class="row-title">' + esc(f.name) + '</div>' +
          (meta.epic ? '<div class="row-epic">' + esc(meta.epic) + '</div>' : '') +
        '</td>' +
        '<td>' +
          '<div class="score-cell">' +
            '<div class="score-num">' + (spValue || '—') + ' <span style="font-size:10px;font-weight:500;color:var(--text-4);">SP</span></div>' +
            '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + spBarWidth + ';background:' + spColor + ';"></div></div>' +
          '</div>' +
        '</td>' +
        '<td><span class="priority-chip" style="color:' + mColor + ';background:' + mColor + '18;">' + mLabel + '</span></td>' +
        '<td>' +
          '<div class="conf-cell">' +
            '<div class="conf-bar-track"><div class="conf-bar-fill" style="width:' + confWidth(conf) + ';background:' + confColor(conf) + ';"></div></div>' +
            '<div class="conf-label" style="color:' + confColor(conf) + ';">' + conf + '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="row-arrow">›</span></td>' +
      '</tr>';
    }).join('');
  }

  function filterTable() {
    if (scoredData.length > 0) renderTable();
  }

  // ── Opportunities ───────────────────────────────────────────────────────

  function buildOpportunities(sorted) {
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5);
    const highRisk  = sorted.filter(f => f.risk === 'High');
    const strategic = sorted.filter(f => f.alignment >= 8);
    const lowConf   = sorted.filter(f => f.confidence === 'Low');

    const cards = [
      { icon: '⚡', title: 'Quick Wins', text: quickWins.length > 0 ? quickWins.map(f => f.name).join(', ') + ' — high impact with low engineering effort.' : 'No quick wins detected. Consider breaking down complex features.', tag: quickWins.length + ' features', tagBg: '#f0fdf4', tagColor: '#16a34a' },
      { icon: '⚠', title: 'Risk Flags', text: highRisk.length > 0 ? highRisk.map(f => f.name).join(', ') + ' — carry high risk and need stakeholder review.' : 'No high-risk features detected.', tag: highRisk.length + ' features', tagBg: '#fef2f2', tagColor: '#dc2626' },
      { icon: '🎯', title: 'Strategic Priorities', text: strategic.length > 0 ? strategic.map(f => f.name).join(', ') + ' — strong strategic alignment with your goals.' : 'Add epics and labels to improve alignment scoring.', tag: strategic.length + ' features', tagBg: '#eff4ff', tagColor: '#2563eb' },
      { icon: '🔍', title: 'Needs More Context', text: lowConf.length > 0 ? lowConf.map(f => f.name).join(', ') + ' — Claude had low confidence. Add descriptions and acceptance criteria.' : 'All features had sufficient context for confident scoring.', tag: lowConf.length + ' features', tagBg: '#fef3c7', tagColor: '#d97706' },
    ];

    document.getElementById('opportunitiesContent').innerHTML = cards.map(c =>
      '<div class="opp-card">' +
        '<div class="opp-card-icon">' + c.icon + '</div>' +
        '<div class="opp-card-title">' + c.title + '</div>' +
        '<div class="opp-card-text">' + c.text + '</div>' +
        '<span class="opp-card-tag" style="background:' + c.tagBg + ';color:' + c.tagColor + ';">' + c.tag + '</span>' +
      '</div>'
    ).join('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  function buildSummary(sorted) {
    const top3      = sorted.slice(0, 3);
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5);
    const highRisk  = sorted.filter(f => f.risk === 'High');
    const total     = sorted.length;

    document.getElementById('summaryContent').innerHTML =
      '<div class="summary-section">' +
        '<div class="summary-section-title">Executive Overview</div>' +
        '<div class="summary-section-text">FeatureIQ analysed <strong>' + total + ' features</strong> from your JIRA backlog. The analysis identified <strong>' + quickWins.length + ' quick win' + (quickWins.length !== 1 ? 's' : '') + '</strong> and flagged <strong>' + highRisk.length + ' high-risk item' + (highRisk.length !== 1 ? 's' : '') + '</strong> for review.</div>' +
      '</div>' +
      '<div class="summary-section">' +
        '<div class="summary-section-title">Top 3 Recommended Features</div>' +
        '<div class="summary-section-text">' + top3.map((f, i) => '<strong>' + (i+1) + '. ' + f.name + '</strong> (' + getMoSCoWLabel(f) + ') — ' + f.rationale).join('<br><br>') + '</div>' +
      '</div>' +
      (quickWins.length > 0 ?
        '<div class="summary-section">' +
          '<div class="summary-section-title">Quick Wins</div>' +
          '<div class="summary-section-text">' + quickWins.map(f => '<strong>' + f.name + '</strong> — ' + (f.nextStep || 'Move to next sprint')).join('<br>') + '</div>' +
        '</div>' : '') +
      (highRisk.length > 0 ?
        '<div class="summary-section">' +
          '<div class="summary-section-title">Risk Register</div>' +
          '<div class="summary-section-text">' + highRisk.map(f => '<strong>' + f.name + '</strong> — ' + f.rationale).join('<br>') + '</div>' +
        '</div>' : '') +
      '<div class="summary-section">' +
        '<div class="summary-section-title">Recommended Next Steps</div>' +
        '<div class="summary-section-text">' +
          '1. Review the Priority Matrix to visualise the full impact vs effort landscape.<br>' +
          '2. Share this report with engineering leads to validate effort estimates.<br>' +
          '3. Use the top 3 recommendations as the basis for your next sprint planning session.<br>' +
          '4. Add acceptance criteria to low-confidence features to improve future scoring accuracy.' +
        '</div>' +
      '</div>';
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  function showWorkspaceState() {
    document.getElementById('zeroState').style.display           = 'none';
    document.getElementById('workspaceState').style.display      = 'flex';
    document.getElementById('workspaceState').style.flexDirection = 'column';
    document.getElementById('workspaceState').style.flex         = '1';
    document.getElementById('workspaceState').style.overflow     = 'hidden';
  }

  function setStep(n) {
    // Steps managed via leftnav status now
  }

  function exportCSV() {
    if (!scoredData.length) return showToast('No data to export yet.', 'error');
    ExportHandler.toCSV(getSorted(), CSVHandler.getMeta());
    showToast('CSV exported successfully', 'success');
  }

  function clearAll() {
    scoredData = [];
    CSVHandler.reset();
    ChartRenderer.destroy();

    document.getElementById('zeroState').style.display           = 'flex';
    document.getElementById('workspaceState').style.display      = 'none';
    document.getElementById('insightBanner').style.display       = 'none';
    document.getElementById('whatsNext').style.display           = 'none';
    document.getElementById('tableWrap').style.display           = 'none';
    document.getElementById('skeletonLoader').style.display      = 'none';
    document.getElementById('searchInput').value                 = '';
    document.getElementById('epicFilter').innerHTML              = '<option value="">All epics</option>';
    document.getElementById('riskFilter').value                  = '';
    document.getElementById('insightText').textContent           = '';

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';

    const statusWrap = document.getElementById('leftnavStatus');
    if (statusWrap) statusWrap.style.display = 'none';

    // Lock nav items again
    ['nav-matrix', 'nav-opportunities', 'nav-summary'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('disabled');
        el.onclick = null;
      }
    });

    closeDrawer();

    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
    document.querySelectorAll('.leftnav-item').forEach(i => i.classList.remove('active'));
    const workspace = document.getElementById('view-workspace');
    if (workspace) { workspace.style.display = 'flex'; workspace.classList.add('active'); }
    const navWorkspace = document.getElementById('nav-workspace');
    if (navWorkspace) navWorkspace.classList.add('active');

    const statusDot  = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (statusDot)  statusDot.className    = 'status-dot';
    if (statusText) statusText.textContent = 'Ready to score.';

    showToast('Workspace cleared', 'info');
  }

  function switchTab(tab, el) {}

  return {
    scoreFeatures,
    handleFile,
    filterTable,
    exportCSV,
    clearAll,
    switchTab,
  };
})();

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}