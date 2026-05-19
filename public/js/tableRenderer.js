const TableRenderer = (() => {

  function tagClass(val) {
    if (val >= 7) return 'score-tag tag-green';
    if (val >= 4) return 'score-tag tag-amber';
    return 'score-tag tag-red';
  }

  function riskClass(risk) {
    if (risk === 'Low')    return 'risk-tag risk-low';
    if (risk === 'Medium') return 'risk-tag risk-medium';
    return 'risk-tag risk-high';
  }

  function confColor(c) {
    if (c === 'High')   return '#0d9e6e';
    if (c === 'Medium') return '#d97706';
    return '#dc2626';
  }

  function confWidth(c) {
    if (c === 'High')   return '90%';
    if (c === 'Medium') return '55%';
    return '22%';
  }

  function rankBadge(i) {
    if (i === 0) return `<div class="rank-badge rank-1">1</div>`;
    if (i === 1) return `<div class="rank-badge rank-2">2</div>`;
    if (i === 2) return `<div class="rank-badge rank-3">3</div>`;
    return `<div class="rank-badge rank-n">${i + 1}</div>`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function render(sorted, csvMeta, onEditName, onEditNote) {
    return sorted.map((f, i) => {
      const meta  = csvMeta[f.name] || {};
      const jira  = meta.jiraId || '';
      const notes = f.notes !== undefined ? f.notes : (meta.notes || '');
      const conf  = f.confidence || 'Medium';
      const risk  = f.risk || 'Low';

      return `<tr>
        <td>${rankBadge(i)}</td>
        <td>
          <div class="feat-name" onclick="App.editName(this,'${esc(f.name)}')">${esc(f.name)}</div>
          ${jira ? `<div><span class="jira-badge">${esc(jira)}</span></div>` : ''}
        </td>
        <td>${jira
          ? `<span class="jira-badge">${esc(jira)}</span>`
          : `<span style="color:var(--text-muted);font-family:var(--mono);font-size:11px;">—</span>`}
        </td>
        <td>
          <div class="notes-view" onclick="App.editNote(this,'${esc(f.name)}')">${notes
            ? esc(notes)
            : `<span style="color:var(--border-dark)">+ add note</span>`}
          </div>
        </td>
        <td><span class="${tagClass(f.impact)}">${f.impact}</span></td>
        <td><span class="${tagClass(10 - f.effort)}">${f.effort}</span></td>
        <td><span class="${tagClass(f.alignment)}">${f.alignment}</span></td>
        <td><div class="total-val">${f.score}</div></td>
        <td><span class="${riskClass(risk)}">${risk}</span></td>
        <td><div class="next-step-col">${esc(f.nextStep || '—')}</div></td>
        <td>
          <div class="conf-block">
            <div class="conf-bar-track">
              <div class="conf-bar-fill" style="width:${confWidth(conf)};background:${confColor(conf)};"></div>
            </div>
            <div class="conf-label" style="color:${confColor(conf)};">${conf}</div>
          </div>
        </td>
        <td class="rationale-col">${esc(f.rationale)}</td>
      </tr>`;
    }).join('');
  }

  return { render, esc, tagClass, riskClass, confColor, confWidth, rankBadge };
})();