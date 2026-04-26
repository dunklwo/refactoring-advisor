/**
 * reportGen.js
 * Generates downloadable PDF and HTML reports.
 * PDF via jsPDF (loaded from CDN).
 * HTML as a self-contained single-file page with embedded CSS.
 */

const ReportGenerator = (() => {

  /**
   * Export as HTML — self-contained, single-file page.
   */
  function exportHTML(data) {
    const { score, grade, metrics, smells, suggestions, lang, timestamp } = data;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Refactoring Advisor Report</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d0f12;color:#e2e8f0;margin:0;padding:32px;line-height:1.6}
  h1{color:#00e5a0;font-size:24px;margin-bottom:4px}
  h2{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin:24px 0 8px}
  .meta{color:#64748b;font-size:13px;margin-bottom:24px}
  .score-block{display:inline-block;padding:16px 32px;background:#13161b;border:2px solid ${grade.color};border-radius:8px;margin-bottom:24px;text-align:center}
  .score-num{font-size:48px;font-weight:700;color:${grade.color};display:block;font-family:monospace}
  .score-label{color:${grade.color};font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #252a35}
  th{color:#64748b;font-weight:600}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
  .HIGH{background:rgba(255,77,109,.15);color:#ff4d6d;border:1px solid #ff4d6d}
  .MEDIUM{background:rgba(255,179,71,.15);color:#ffb347;border:1px solid #ffb347}
  .LOW{background:rgba(0,229,160,.15);color:#00e5a0;border:1px solid #00e5a0}
  .diff{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
  .diff-before,.diff-after{background:#13161b;border-radius:6px;padding:12px}
  .diff-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:6px}
  .diff-before .diff-label{color:#ff4d6d}.diff-after .diff-label{color:#00e5a0}
  pre{font-family:'JetBrains Mono',monospace;font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0;color:#e2e8f0}
  .smell-card{background:#13161b;border:1px solid #252a35;border-radius:6px;padding:16px;margin-bottom:12px}
  .smell-card h3{font-size:14px;margin:4px 0}
  .smell-card p{color:#64748b;font-size:12px;margin:4px 0}
  footer{margin-top:40px;color:#64748b;font-size:11px;border-top:1px solid #252a35;padding-top:12px}
</style>
</head>
<body>
<h1>⬡ Refactoring Advisor Report</h1>
<p class="meta">Language: <strong>${lang.toUpperCase()}</strong> &nbsp;·&nbsp; Generated: ${timestamp}</p>

<div class="score-block">
  <span class="score-num">${score}</span>
  <span class="score-label">${grade.label} Quality</span>
</div>

<h2>Halstead Metrics</h2>
<table>
  <tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr>
  <tr><td>Volume (V)</td><td>${metrics.V}</td><td>&gt; 1000</td><td>${metrics.flags.V ? '⚠️ '+metrics.flags.V : '✅ OK'}</td></tr>
  <tr><td>Difficulty (D)</td><td>${metrics.D}</td><td>&gt; 25</td><td>${metrics.flags.D ? '⚠️ '+metrics.flags.D : '✅ OK'}</td></tr>
  <tr><td>Effort (E)</td><td>${metrics.E}</td><td>&gt; 10000</td><td>${metrics.flags.E ? '⚠️ '+metrics.flags.E : '✅ OK'}</td></tr>
  <tr><td>Maint. Index (MI)</td><td>${metrics.MI}</td><td>&lt; 65</td><td>${metrics.flags.MI ? '⚠️ '+metrics.flags.MI : '✅ OK'}</td></tr>
  <tr><td>LOC</td><td>${metrics.LOC}</td><td>—</td><td>—</td></tr>
  <tr><td>Cyclomatic (G)</td><td>${metrics.G}</td><td>—</td><td>—</td></tr>
</table>

<h2>Detected Smells (${smells.length})</h2>
${smells.length === 0
  ? '<p style="color:#00e5a0;font-weight:600">✅ No code smells detected. Clean code!</p>'
  : smells.map(s => `
<div class="smell-card">
  <span class="badge ${s.severity}">${s.severity}</span>
  <h3>${s.label} — ${s.affectedName}</h3>
  <p>${s.detail}</p>
  <p><em>${s.lineRange}</em></p>
</div>`).join('')}

<h2>Refactoring Suggestions (${suggestions.length})</h2>
${suggestions.map(s => `
<div class="smell-card">
  <span class="badge ${s.severity}">${s.severity}</span>
  <h3>${s.smellLabel} · <span style="color:#007aff">${s.pattern}</span></h3>
  <p><em>${s.rationale}</em></p>
  <p style="font-size:11px;color:#64748b">${s.lineRange}</p>
  <div class="diff">
    <div class="diff-before">
      <div class="diff-label">Before</div>
      <pre>${escapeHtml(s.before)}</pre>
    </div>
    <div class="diff-after">
      <div class="diff-label">After</div>
      <pre>${escapeHtml(s.after)}</pre>
    </div>
  </div>
</div>`).join('')}

<footer>Refactoring Advisor · 15B17CI573 Software Engineering Lab · 2025–26</footer>
</body>
</html>`;

    download(html, 'refactoring-report.html', 'text/html');
  }

  /**
   * Export as PDF via jsPDF.
   */
  function exportPDF(data) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      alert('jsPDF library not loaded. Please export as HTML instead.');
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { score, grade, metrics, smells, suggestions, lang, timestamp } = data;

    const pageW = 210;
    const margin = 18;
    let y = margin;

    const addText = (text, size = 11, color = [226, 232, 240], bold = false) => {
      doc.setFontSize(size);
      doc.setTextColor(...color);
      if (bold) doc.setFont('helvetica', 'bold');
      else doc.setFont('helvetica', 'normal');
      doc.text(String(text), margin, y);
      y += size * 0.45;
    };

    const checkPage = (needed = 20) => {
      if (y + needed > 280) { doc.addPage(); y = margin; }
    };

    const divider = () => {
      doc.setDrawColor(37, 42, 53);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    };

    // Title
    doc.setFillColor(13, 15, 18);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFontSize(20); doc.setTextColor(0, 229, 160); doc.setFont('helvetica', 'bold');
    doc.text('Refactoring Advisor Report', margin, y); y += 10;

    doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
    doc.text(`Language: ${lang.toUpperCase()}   |   Generated: ${timestamp}`, margin, y); y += 8;
    divider();

    // Score
    doc.setFontSize(36); doc.setTextColor(0, 229, 160); doc.setFont('helvetica', 'bold');
    doc.text(`${score}`, margin, y); y += 10;
    doc.setFontSize(12); doc.text(`${grade.label} Quality`, margin, y); y += 10;
    divider();

    // Metrics
    addText('HALSTEAD METRICS', 11, [100, 116, 139], true); y += 2;
    const mRows = [
      ['Volume (V)', metrics.V, metrics.flags.V || 'OK'],
      ['Difficulty (D)', metrics.D, metrics.flags.D || 'OK'],
      ['Effort (E)', metrics.E, metrics.flags.E || 'OK'],
      ['Maint. Index', metrics.MI, metrics.flags.MI || 'OK'],
      ['LOC', metrics.LOC, '—'],
      ['Cyclomatic (G)', metrics.G, '—'],
    ];
    mRows.forEach(([label, val, status]) => {
      checkPage(8);
      doc.setFontSize(9);
      doc.setTextColor(226, 232, 240); doc.setFont('helvetica', 'normal');
      doc.text(label, margin, y);
      doc.text(String(val), margin + 55, y);
      const isFlag = status !== 'OK' && status !== '—';
      doc.setTextColor(isFlag ? 255 : 0, isFlag ? 77 : 229, isFlag ? 109 : 160);
      doc.text(String(status), margin + 85, y);
      y += 6;
    });
    y += 4; divider();

    // Smells
    addText(`CODE SMELLS (${smells.length})`, 11, [100, 116, 139], true); y += 2;
    if (smells.length === 0) {
      addText('No code smells detected.', 10, [0, 229, 160]);
    } else {
      smells.forEach(s => {
        checkPage(16);
        const sColor = s.severity === 'HIGH' ? [255,77,109] : s.severity === 'MEDIUM' ? [255,179,71] : [0,229,160];
        doc.setFontSize(9); doc.setTextColor(...sColor); doc.setFont('helvetica', 'bold');
        doc.text(`[${s.severity}] ${s.label} — ${s.affectedName}`, margin, y); y += 5;
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(s.detail.substring(0, 90), margin + 2, y); y += 5;
        doc.text(s.lineRange, margin + 2, y); y += 7;
      });
    }
    y += 2; divider();

    // Suggestions summary
    addText(`REFACTORING SUGGESTIONS (${suggestions.length})`, 11, [100, 116, 139], true); y += 2;
    suggestions.forEach(s => {
      checkPage(20);
      doc.setFontSize(9); doc.setTextColor(226, 232, 240); doc.setFont('helvetica', 'bold');
      doc.text(`${s.smellLabel}  →  ${s.pattern}`, margin, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      const wrapped = doc.splitTextToSize(s.rationale, pageW - margin * 2 - 5);
      doc.text(wrapped, margin + 2, y); y += wrapped.length * 4.5 + 4;
    });

    // Footer
    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text('Refactoring Advisor · 15B17CI573 · 2025–26', margin, 290);

    doc.save('refactoring-report.pdf');
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return { exportHTML, exportPDF };

})();
