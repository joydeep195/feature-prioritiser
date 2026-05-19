const ChartRenderer = (() => {
  let chartInstance = null;

  function getQuadrantColor(impact, effort) {
    const highImpact = impact >= 6;
    const lowEffort  = effort <= 5;
    if  (highImpact && lowEffort)  return { bg: 'rgba(22,163,74,0.8)',   border: '#16a34a' };
    if  (highImpact && !lowEffort) return { bg: 'rgba(37,99,235,0.8)',   border: '#2563eb' };
    if  (!highImpact && lowEffort) return { bg: 'rgba(217,119,6,0.8)',   border: '#d97706' };
    return                                { bg: 'rgba(220,38,38,0.8)',   border: '#dc2626' };
  }

  function render(sorted) {
    const canvas = document.getElementById('matrixChart');
    if (!canvas) return;
    if (chartInstance) chartInstance.destroy();

    const points = sorted.map(f => {
      const color = getQuadrantColor(f.impact, f.effort);
      return { x: f.effort, y: f.impact, label: f.name.length > 18 ? f.name.slice(0,18)+'…' : f.name, score: f.score, ...color };
    });

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [{
          data: points.map(p => ({ x: p.x, y: p.y })),
          pointBackgroundColor: points.map(p => p.bg),
          pointBorderColor:     points.map(p => p.border),
          pointBorderWidth: 2,
          pointRadius: 11,
          pointHoverRadius: 14,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#08112a',
            titleColor: '#f5c400',
            bodyColor: 'rgba(255,255,255,0.7)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono', size: 11 },
            bodyFont:  { family: 'JetBrains Mono', size: 10 },
            callbacks: {
              title: items => points[items[0].dataIndex].label,
              label: item  => ['Impact: ' + item.parsed.y, 'Effort: ' + item.parsed.x, 'Score: ' + points[item.dataIndex].score]
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Effort (1 = low, 10 = high)', color: '#6b7a9a', font: { family: 'JetBrains Mono', size: 10 } },
            min: 0, max: 11,
            ticks: { color: '#6b7a9a', font: { family: 'JetBrains Mono', size: 10 } },
            grid:  { color: '#e2e6f0' },
            border: { color: '#e2e6f0' }
          },
          y: {
            title: { display: true, text: 'User Impact (1 = low, 10 = high)', color: '#6b7a9a', font: { family: 'JetBrains Mono', size: 10 } },
            min: 0, max: 11,
            ticks: { color: '#6b7a9a', font: { family: 'JetBrains Mono', size: 10 } },
            grid:  { color: '#e2e6f0' },
            border: { color: '#e2e6f0' }
          }
        }
      },
      plugins: [{
        id: 'quadrantLabels',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, top, bottom } } = chart;
          const midX = (left + right) / 2;
          const midY = (top + bottom) / 2;
          ctx.save();
          ctx.font = '600 10px JetBrains Mono';
          ctx.fillStyle = 'rgba(22,163,74,0.35)';   ctx.fillText('QUICK WINS',    left + 8,   top + 16);
          ctx.fillStyle = 'rgba(37,99,235,0.35)';   ctx.fillText('STRATEGIC BETS', right - 120, top + 16);
          ctx.fillStyle = 'rgba(217,119,6,0.35)';   ctx.fillText('FILL-INS',      left + 8,   bottom - 8);
          ctx.fillStyle = 'rgba(220,38,38,0.35)';   ctx.fillText('RECONSIDER',    right - 90, bottom - 8);
          ctx.strokeStyle = 'rgba(0,0,0,0.06)';
          ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(midX, top);   ctx.lineTo(midX, bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(left, midY);  ctx.lineTo(right, midY);  ctx.stroke();
          ctx.restore();
        }
      }]
    });
  }

  function destroy() {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  }

  return { render, destroy };
})();
