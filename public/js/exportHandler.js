const ExportHandler = (() => {

  function toCSV(sorted, csvMeta) {
    const rows = [[
      'Rank', 'JIRA ID', 'Feature', 'Impact', 'Effort',
      'Alignment', 'Weighted Score', 'Risk', 'Next Step',
      'Confidence', 'Notes', 'Rationale'
    ]];

    sorted.forEach((f, i) => {
      const meta = csvMeta[f.name] || {};
      rows.push([
        i + 1,
        meta.jiraId || '',
        f.name,
        f.impact,
        f.effort,
        f.alignment,
        f.score,
        f.risk || 'Low',
        f.nextStep || '',
        f.confidence || 'Medium',
        f.notes || '',
        f.rationale
      ]);
    });

    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'feature-prioritisation.csv';
    a.click();
  }

  return { toCSV };
})();