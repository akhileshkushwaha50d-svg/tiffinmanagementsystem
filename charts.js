/**
 * charts.js - Lightweight zero-dependency HTML5 Canvas Chart Renderer
 * Renders Bar Charts, Line Charts, and Doughnut Charts.
 */

const MiniChart = {
  // 1. Doughnut Chart
  renderDoughnut(canvasId, data, labels, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 260;
    const height = canvas.height = 220;
    
    ctx.clearRect(0, 0, width, height);
    const total = data.reduce((a, b) => a + b, 0);
    if (total === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillText('No data available', width / 2, height / 2);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2 - 15;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.58;

    let startAngle = -0.5 * Math.PI;

    for (let i = 0; i < data.length; i++) {
      const sliceAngle = (data[i] / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    }

    // Legend
    let legendY = height - 20;
    let legendX = 20;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < labels.length; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(legendX, legendY - 8, 10, 10);
      ctx.fillStyle = '#334155';
      ctx.fillText(`${labels[i]} (${data[i]})`, legendX + 14, legendY);
      legendX += (width / labels.length);
    }
  },

  // 2. Bar Chart
  renderBar(canvasId, values, labels, barColor = '#059669') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 360;
    const height = canvas.height = 200;
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...values, 10);
    const padding = 36;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    const barWidth = Math.min(42, (chartWidth / values.length) * 0.65);
    const gap = chartWidth / values.length;

    // Draw baseline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const barH = (val / maxVal) * chartHeight;
      const x = padding + i * gap + (gap - barWidth) / 2;
      const y = height - padding - barH;

      // Bar
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Value label on top
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, x + barWidth / 2, y - 6);

      // Label below
      ctx.fillStyle = '#334155';
      ctx.fillText(labels[i], x + barWidth / 2, height - padding + 16);
    }
  },

  // 3. Line Chart
  renderLine(canvasId, points, labels, lineColor = '#059669', fillColor = 'rgba(16, 185, 129, 0.1)') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 400;
    const height = canvas.height = 200;
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...points, 100);
    const padding = 36;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    const gap = chartWidth / (points.length - 1 || 1);

    // Baseline & Gridlines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const gy = padding + (chartHeight / 3) * g;
      ctx.beginPath();
      ctx.moveTo(padding, gy);
      ctx.lineTo(width - padding, gy);
      ctx.stroke();
    }

    const coords = points.map((p, i) => ({
      x: padding + i * gap,
      y: height - padding - (p / maxVal) * chartHeight
    }));

    // Area Fill
    ctx.beginPath();
    ctx.moveTo(coords[0].x, height - padding);
    coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, height - padding);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    coords.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Dots & Labels
    coords.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], pt.x, height - padding + 16);
      ctx.fillText(`₹${points[i]}`, pt.x, pt.y - 8);
    });
  }
};
