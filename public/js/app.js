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
  var map = { must: 'Must Ship', should: 'Should Ship', could: 'Consider', wont: "Won't Ship" };
  return map[getMoSCoW(feature)];
}

function getMoSCoWColor(feature) {
  var map = { must: '#0a6b4a', should: '#444', could: '#888', wont: '#bbb' };
  return map[getMoSCoW(feature)];
}

function getMoSCoWDotClass(feature) {
  var map = { must: 'moscow-dot moscow-dot-must', should: 'moscow-dot moscow-dot-should', could: 'moscow-dot moscow-dot-could', wont: 'moscow-dot moscow-dot-wont' };
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

// ── App module ────────────────────────────────────────────────────────────

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

  function handleFile(file) {
    CSVHandler.parse(file).then(({ count, fileName }) => {
      showToast(fileName + ' — ' + count + ' features loaded', 'success');
      openPrioritiesModal();
    }).catch(err => {
      showToast('Could not read CSV: ' + err, 'error');
    });
  }

  async function scoreFeatures() {
    const csvMeta  = CSVHandler.getMeta();
    const features = Object.keys(csvMeta);
    if (!features.length) { showToast('Please upload a CSV file first.', 'error'); return; }

    const priorities        = getPriorities();
    const additionalContext = getAdditionalContext();

    showWorkspaceState();
    showSkeleton(features.length);
    startLoadingCounter(features.length);

    try {
      const res = await fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: features.map(name => ({ name, ...(csvMeta[name] || {}) })),
          priorities, additionalContext
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      scoredData = data.results.map(f => ({ ...f, score: computeScore(f) }));
      hideSkeleton();
      renderAll();
      unlockNav();
      showToast(scoredData.length + ' features scored successfully', 'success');

    } catch (err) {
      hideSkeleton();
      showToast('Scoring failed: ' + err.message, 'error');
      console.error(err);
    }
  }

  function showSkeleton(count) {
    document.getElementById('tableWrap').style.display      = 'none';
    document.getElementById('skeletonLoader').style.display = 'block';
    const rows = document.getElementById('skeletonRows');
    rows.innerHTML = Array.from({ length: Math.min(count, 6) }).map((_, i) => `
      <div class="skel-row" style="animation-delay:${i*0.1}s;">
        <div class="skel-block" style="width:65px;height:12px;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
          <div class="skel-block" style="width:${160+i*20}px;height:13px;"></div>
        </div>
        <div class="skel-block" style="width:120px;height:24px;border-radius:4px;"></div>
        <div class="skel-block" style="width:90px;height:18px;border-radius:4px;"></div>
        <div class="skel-block" style="width:80px;height:14px;"></div>
      </div>
    `).join('');
  }

  function hideSkeleton() {
    document.getElementById('skeletonLoader').style.display  = 'none';
    document.getElementById('tableWrap').style.display       = 'block';
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    if (window._loadingInterval) { clearInterval(window._loadingInterval); window._loadingInterval = null; }
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

    if (totalEl)    totalEl.textContent    = total;
    if (overlay)    overlay.style.display  = 'flex';
    if (statusDot)  statusDot.className    = 'status-dot loading';
    if (statusWrap) statusWrap.style.display = 'flex';

    const interval = setInterval(() => {
      current = Math.min(current + 1, total);
      const pct = Math.round((current / total) * 100);
      if (bar)        bar.style.width        = pct + '%';
      if (currEl)     currEl.textContent     = current;
      if (nameEl)     nameEl.textContent     = names[current - 1] || '';
      if (statusText) statusText.textContent = 'Scoring ' + current + ' of ' + total + '...';
      if (current >= total) clearInterval(interval);
    }, Math.max(600, 10000 / total));

    window._loadingInterval = interval;
  }

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
    if (epicSel) epicSel.innerHTML = '<option value="">All epics</option>' + epics.map(e => '<option value="'+esc(e)+'">'+esc(e)+'</option>').join('');
  }

  function updateKPIs(sorted) {
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5).length;
    const highRisk  = sorted.filter(f => f.risk === 'High').length;
    document.getElementById('kpiCount').textContent     = sorted.length;
    document.getElementById('kpiQuickWins').textContent = quickWins;
    document.getElementById('kpiHighRisk').textContent  = highRisk;
  }

  function buildInsight(sorted) {
    const highRisk  = sorted.filter(f => f.risk === 'High').length;
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5).length;
    const mustShip  = sorted.filter(f => getMoSCoW(f) === 'must');
    let insight = '';

    if (highRisk > 0 && quickWins > 0 && mustShip.length >= 2) {
      insight = 'Ship <strong>' + esc(mustShip[0].name) + '</strong> & the <strong>' + esc(mustShip[1].name) + '</strong> first - both are high-impact, low-effort quick wins. ' + (highRisk > 1 ? highRisk + ' features carry' : '1 feature carries') + ' high risk; scope before committing.';
    } else if (highRisk > 0) {
      insight = highRisk + ' high-risk feature' + (highRisk > 1 ? 's' : '') + ' detected that may need stakeholder review before committing to the roadmap.';
    } else if (quickWins > 0) {
      insight = quickWins + ' quick win' + (quickWins > 1 ? 's' : '') + ' identified - high impact features with low effort that can be shipped fast.';
    } else if (sorted[0]) {
      insight = '"' + esc(sorted[0].name) + '" is your top priority - ' + esc(getMoSCoWLabel(sorted[0])) + '.';
    }

    if (insight) {
      document.getElementById('insightText').innerHTML    = insight;
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
    const statusWrap = document.getElementById('leftnavStatus');
    if (statusWrap) statusWrap.style.display = 'flex';
  }

  function renderTable() {
    const filtered = getFiltered();
    const csvMeta  = CSVHandler.getMeta();
    window._tableFeatures = filtered;

    const confColor = c => c === 'High' ? '#0a6b4a' : c === 'Medium' ? '#d97706' : '#dc2626';
    const confWidth = c => c === 'High' ? '90%'     : c === 'Medium' ? '55%'     : '22%';

    document.getElementById('tableBody').innerHTML = filtered.map((f, i) => {
      const meta      = csvMeta[f.name] || {};
      const jira      = meta.jiraId || '-';
      const conf      = ['High', 'Medium', 'Low'].includes(f.confidence) ? f.confidence : 'Medium';
      const risk      = ['High', 'Medium', 'Low'].includes(f.risk) ? f.risk : 'Low';
      const spValue   = f.storyPoints || parseInt(meta.storyPoints) || 0;
      const impactPct = clampNumber(f.impact, 0, 10) * 10 + '%';
      const effortPct = Math.min((clampNumber(spValue || f.effort, 0, 21) / 21) * 100, 100) + '%';
      const mLabel    = getMoSCoWLabel(f);
      const mDotClass = getMoSCoWDotClass(f);
      const mColor    = getMoSCoWColor(f);

      return '<tr onclick="openDrawer(window._tableFeatures[' + i + '])">' +
        '<td><div class="row-jira" title="' + esc(jira) + '">' + esc(jira) + '</div></td>' +
        '<td><div class="row-title" title="' + esc(f.name) + '">' + esc(f.name) + '</div></td>' +
        '<td>' +
          '<div class="ie-cell">' +
            '<div class="ie-row"><span class="ie-label">IMP</span><div class="ie-bar-track"><div class="ie-bar-fill" style="width:' + impactPct + ';background:#0a6b4a;"></div></div><span class="ie-val">' + (f.impact || '-') + '</span></div>' +
            '<div class="ie-row"><span class="ie-label">EFF</span><div class="ie-bar-track"><div class="ie-bar-fill" style="width:' + effortPct + ';background:#94a3b8;"></div></div><span class="ie-val">' + (spValue || f.effort || '-') + '<span class="ie-unit">' + (spValue ? ' SP' : '') + '</span></span></div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="moscow-cell">' +
            '<div class="' + mDotClass + '"></div>' +
            '<span class="moscow-text" style="color:' + mColor + ';">' + mLabel.toUpperCase() + '</span>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="risk-cell">' +
            '<span class="risk-dot risk-dot-' + risk.toLowerCase() + '"></span>' +
            '<span class="risk-text' + (risk === 'High' ? ' risk-text-high' : '') + '">' + risk.toUpperCase() + '</span>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="conf-cell">' +
            '<div class="conf-bar-track"><div class="conf-bar-fill" style="width:' + confWidth(conf) + ';background:' + confColor(conf) + ';"></div></div>' +
            '<div class="conf-label" style="color:' + confColor(conf) + ';">' + conf + '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="row-arrow">&gt;</span></td>' +
      '</tr>';
    }).join('');
  }

  function filterTable() {
    if (scoredData.length > 0) renderTable();
  }

  function pluralize(count, noun) {
    return count + ' ' + noun + (count === 1 ? '' : 's');
  }

  function buildOpportunities(sorted) {
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5);
    const highRisk  = sorted.filter(f => f.risk === 'High');
    const strategic = sorted.filter(f => f.alignment >= 8);
    const lowConf   = sorted.filter(f => f.confidence === 'Low');
    const cards = [
      { icon: '!', title: 'Quick Wins', text: quickWins.length > 0 ? quickWins.map(f => f.name).join(', ') + ' - high impact with low engineering effort.' : 'No quick wins detected.', tag: pluralize(quickWins.length, 'feature'), tagBg: '#e8f5f0', tagColor: '#0a6b4a' },
      { icon: '!', title: 'Risk Flags', text: highRisk.length > 0 ? highRisk.map(f => f.name).join(', ') + ' - need stakeholder review.' : 'No high-risk features detected.', tag: pluralize(highRisk.length, 'feature'), tagBg: '#fef2f2', tagColor: '#dc2626' },
      { icon: '*', title: 'Strategic Priorities', text: strategic.length > 0 ? strategic.map(f => f.name).join(', ') + ' - strong strategic alignment.' : 'Add epics and labels to improve alignment scoring.', tag: pluralize(strategic.length, 'feature'), tagBg: '#eff4ff', tagColor: '#2563eb' },
      { icon: '?', title: 'Needs More Context', text: lowConf.length > 0 ? lowConf.map(f => f.name).join(', ') + ' - add descriptions and acceptance criteria.' : 'All features had sufficient context.', tag: pluralize(lowConf.length, 'feature'), tagBg: '#fef3c7', tagColor: '#d97706' },
    ];
    document.getElementById('opportunitiesContent').innerHTML = cards.map(c =>
      '<div class="opp-card"><div class="opp-card-icon">'+esc(c.icon)+'</div><div class="opp-card-title">'+esc(c.title)+'</div><div class="opp-card-text">'+esc(c.text)+'</div><span class="opp-card-tag" style="background:'+c.tagBg+';color:'+c.tagColor+';">'+esc(c.tag)+'</span></div>'
    ).join('');
  }

  function buildSummary(sorted) {
    const top3      = sorted.slice(0, 3);
    const quickWins = sorted.filter(f => f.impact >= 6 && f.effort <= 5);
    const highRisk  = sorted.filter(f => f.risk === 'High');
    document.getElementById('summaryContent').innerHTML =
      '<div class="summary-section"><div class="summary-section-title">Executive Overview</div><div class="summary-section-text">FeatureIQ analysed <strong>' + sorted.length + ' features</strong>. Identified <strong>' + quickWins.length + ' quick win' + (quickWins.length !== 1 ? 's' : '') + '</strong> and flagged <strong>' + highRisk.length + ' high-risk item' + (highRisk.length !== 1 ? 's' : '') + '</strong>.</div></div>' +
      '<div class="summary-section"><div class="summary-section-title">Top 3 Recommended Features</div><div class="summary-section-text">' + top3.map((f,i) => '<strong>'+(i+1)+'. '+esc(f.name)+'</strong> ('+esc(getMoSCoWLabel(f))+') - '+esc(f.rationale || '')).join('<br><br>') + '</div></div>' +
      (quickWins.length > 0 ? '<div class="summary-section"><div class="summary-section-title">Quick Wins</div><div class="summary-section-text">'+quickWins.map(f=>'<strong>'+esc(f.name)+'</strong> - '+esc(f.nextStep||'Move to next sprint')).join('<br>')+'</div></div>' : '') +
      (highRisk.length > 0 ? '<div class="summary-section"><div class="summary-section-title">Risk Register</div><div class="summary-section-text">'+highRisk.map(f=>'<strong>'+esc(f.name)+'</strong> - '+esc(f.rationale || '')).join('<br>')+'</div></div>' : '') +
      '<div class="summary-section"><div class="summary-section-title">Next Steps</div><div class="summary-section-text">1. Review the Priority Matrix to visualise impact vs effort.<br>2. Share with engineering leads to validate estimates.<br>3. Use top 3 as the basis for next sprint planning.<br>4. Add acceptance criteria to low-confidence features.</div></div>';
  }

  function showWorkspaceState() {
    document.getElementById('zeroState').style.display            = 'none';
    document.getElementById('workspaceState').style.display       = 'flex';
    document.getElementById('workspaceState').style.flexDirection = 'column';
    document.getElementById('workspaceState').style.flex          = '1';
    document.getElementById('workspaceState').style.overflow      = 'hidden';
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

    document.getElementById('zeroState').style.display          = 'flex';
    document.getElementById('workspaceState').style.display     = 'none';
    document.getElementById('insightBanner').style.display      = 'none';
    document.getElementById('tableWrap').style.display          = 'none';
    document.getElementById('skeletonLoader').style.display     = 'none';
    document.getElementById('searchInput').value                = '';
    document.getElementById('epicFilter').innerHTML             = '<option value="">All epics</option>';
    document.getElementById('riskFilter').value                 = '';
    document.getElementById('insightText').innerHTML            = '';

    const overlay    = document.getElementById('loadingOverlay');
    const statusWrap = document.getElementById('leftnavStatus');
    if (overlay)    overlay.style.display    = 'none';
    if (statusWrap) statusWrap.style.display = 'none';

    ['nav-matrix','nav-opportunities','nav-summary'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.classList.add('disabled'); el.onclick = null; }
    });

    closeDrawer();

    document.querySelectorAll('.view').forEach(v => { v.style.display='none'; v.classList.remove('active'); });
    document.querySelectorAll('.leftnav-item').forEach(i => i.classList.remove('active'));
    const ws  = document.getElementById('view-workspace');
    const nav = document.getElementById('nav-workspace');
    if (ws)  { ws.style.display='flex'; ws.classList.add('active'); }
    if (nav) nav.classList.add('active');

    const statusDot  = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (statusDot)  statusDot.className    = 'status-dot';
    if (statusText) statusText.textContent = 'Ready to score.';
    var csvInput = document.getElementById('csvInput');
    if (csvInput) csvInput.value = '';
    showToast('Workspace cleared', 'info');
  }

  return { scoreFeatures, handleFile, filterTable, exportCSV, clearAll };
})();

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function clampNumber(value, min, max) {
  var num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
}
