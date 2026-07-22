const PresentationMode = (() => {

  let _sorted = [];

  function build(sorted) {
    _sorted = sorted;
  }

  function open() {
    if (!_sorted.length) return alert('Please run prioritisation first.');

    const csvMeta = CSVHandler.getMeta();

    // KPIs
    const avgImpact = (_sorted.reduce((s, f) => s + f.impact, 0) / _sorted.length).toFixed(1);
    const highConf  = _sorted.filter(f => f.confidence === 'High').length;
    const highRisk  = _sorted.filter(f => f.risk === 'High').length;

    document.getElementById('presentKpis').innerHTML = `
      <div class="present-kpi">
        <div class="present-kpi-label">Features ranked</div>
        <div class="present-kpi-value">${_sorted.length}</div>
        <div class="present-kpi-sub">total in backlog</div>
      </div>
      <div class="present-kpi">
        <div class="present-kpi-label">Top score</div>
        <div class="present-kpi-value">${_sorted[0].score}</div>
        <div class="present-kpi-sub">${esc(_sorted[0].name.length > 16 ? _sorted[0].name.slice(0,16)+'...' : _sorted[0].name)}</div>
      </div>
      <div class="present-kpi">
        <div class="present-kpi-label">Avg. user impact</div>
        <div class="present-kpi-value">${avgImpact}</div>
        <div class="present-kpi-sub">out of 10</div>
      </div>
      <div class="present-kpi">
        <div class="present-kpi-label">High confidence</div>
        <div class="present-kpi-value">${highConf}</div>
        <div class="present-kpi-sub">${highRisk} high risk items</div>
      </div>
    `;

    // Table
    document.getElementById('presentBody').innerHTML = _sorted.map((f, i) => {
      const meta = csvMeta[f.name] || {};
      const jira = meta.jiraId || '-';
      const risk = f.risk || 'Low';
      const riskColor = risk === 'High' ? '#ef4444' : risk === 'Medium' ? '#f59e0b' : '#10b981';

      return `<tr>
        <td style="color:${i === 0 ? '#f5c400' : 'rgba(255,255,255,0.4)'}; font-family:var(--mono); font-weight:600;">${i + 1}</td>
        <td style="font-weight:500; color:${i < 3 ? '#ffffff' : 'rgba(255,255,255,0.7)'};">${esc(f.name)}</td>
        <td style="font-family:var(--mono); font-size:10px; color:#06b6d4;">${esc(jira)}</td>
        <td style="font-family:var(--mono);">${f.impact}</td>
        <td style="font-family:var(--mono);">${f.effort}</td>
        <td style="font-family:var(--mono);">${f.alignment}</td>
        <td style="font-family:var(--mono); font-weight:700; color:#f5c400;">${f.score}</td>
        <td style="font-family:var(--mono); font-size:10px; font-weight:600; color:${riskColor}; text-transform:uppercase;">${risk}</td>
        <td style="font-size:11px; color:rgba(255,255,255,0.5); max-width:160px;">${esc(f.nextStep || '-')}</td>
        <td style="font-size:11px; color:rgba(255,255,255,0.4); max-width:200px;">${esc(f.rationale)}</td>
      </tr>`;
    }).join('');

    document.getElementById('presentOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    document.getElementById('presentOverlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  return { build, open, close };
})();
