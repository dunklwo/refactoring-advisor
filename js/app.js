/**
 * app.js
 * Main controller for Refactoring Advisor.
 * Wires together: Tokenizer → HalsteadEngine → SmellDetector →
 *                 RefactorAdvisor → ScoreEngine → ReportGenerator
 * Manages tab switching, score ring animation, and all UI rendering.
 */

(function () {

  // ── State ────────────────────────────────────────────────────────────────
  let _lastResult = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const codeInput  = document.getElementById('codeInput');
  const langSelect = document.getElementById('language');
  const fileUpload = document.getElementById('fileUpload');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn   = document.getElementById('clearBtn');
  const inputMeta  = document.getElementById('inputMeta');
  const tabContent = document.getElementById('tabContent');
  const tabs       = document.querySelectorAll('.tab');
  const scoreNum   = document.getElementById('scoreNum');
  const ringFill   = document.getElementById('ringFill');

  // ── Line counter ──────────────────────────────────────────────────────────
  function updateMeta() {
    const lines = codeInput.value.split('\n').length;
    const chars = codeInput.value.length;
    inputMeta.textContent = `${lines} lines · ${chars} chars`;
  }

  codeInput.addEventListener('input', updateMeta);
  codeInput.addEventListener('paste', () => setTimeout(updateMeta, 10));
  codeInput.addEventListener('change', updateMeta);

  // ── File upload ───────────────────────────────────────────────────────────
  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const langMap = { py: 'python', java: 'java', c: 'c' };
    if (langMap[ext]) langSelect.value = langMap[ext];
    const reader = new FileReader();
    reader.onload = (ev) => {
      codeInput.value = ev.target.result;
      codeInput.dispatchEvent(new Event('input'));
    };
    reader.readAsText(file);
  });

  // ── Clear ─────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    codeInput.value = '';
    inputMeta.textContent = 'Ready · 0 lines';
    _lastResult = null;
    setScore(null);
    showEmpty();
    setActiveTab(null);
  });

  // ── Tab switching ─────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (!_lastResult) return;
      setActiveTab(tab.dataset.tab);
      renderTab(tab.dataset.tab, _lastResult);
    });
  });

  function setActiveTab(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  }

  // ── Analyze ───────────────────────────────────────────────────────────────
  analyzeBtn.addEventListener('click', runAnalysis);

  async function runAnalysis() {
    const code = codeInput.value.trim();
    if (!code) {
      inputMeta.textContent = '⚠ Please paste some code first.';
      return;
    }

    const lines = code.split('\n');
    if (lines.length > 500) {
      inputMeta.textContent = `⚠ Code too long: ${lines.length} lines (max 500).`;
      return;
    }

    const lang = langSelect.value;

    showLoading();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing…';

    // Small timeout to let the loading UI render
    await new Promise(r => setTimeout(r, 50));

    try {
      // 1. Tokenize
      const tokens    = Tokenizer.tokenize(code, lang);
      const structure = Tokenizer.extractStructure(code, lang);

      // 2. Halstead metrics
      const metrics = HalsteadEngine.compute(tokens, code, lang);

      // 3. Smell detection
      const smells = await SmellDetector.detect(code, lang, structure, tokens);

      // 4. Refactoring suggestions
      const suggestions = RefactorAdvisor.generateSuggestions(smells, code, lang);

      // 5. Quality score
      const { score, breakdown } = ScoreEngine.compute(smells, metrics);
      const grade = ScoreEngine.grade(score);

      _lastResult = { code, lang, metrics, smells, suggestions, score, breakdown, grade };

      // Update score ring
      setScore(score, grade);

      // Default to Metrics tab
      setActiveTab('metrics');
      renderTab('metrics', _lastResult);

    } catch (err) {
      console.error('Analysis error:', err);
      tabContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" style="color:var(--danger)">⚠</div>
          <p style="color:var(--danger);font-weight:600">Analysis Error</p>
          <p style="font-size:12px;color:var(--muted);max-width:320px;text-align:center">${err.message || 'Unknown error. Open browser console (F12) for details.'}</p>
        </div>`;
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze →';
    }
  }

  // ── Score ring ─────────────────────────────────────────────────────────────
  function setScore(score, grade) {
    if (score === null) {
      scoreNum.textContent = '—';
      ringFill.setAttribute('stroke-dasharray', '0 264');
      ringFill.style.stroke = 'var(--accent)';
      return;
    }
    const circumference = 2 * Math.PI * 42; // ≈ 264
    const filled = (score / 100) * circumference;
    ringFill.setAttribute('stroke-dasharray', `${filled} ${circumference}`);
    ringFill.style.stroke = grade.color;
    scoreNum.textContent = score;
    scoreNum.style.color = grade.color;
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  function showLoading() {
    tabContent.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Analyzing code…</p>
      </div>`;
  }

  function showEmpty() {
    tabContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⬡</div>
        <p>Paste code and click <strong>Analyze</strong> to begin.</p>
      </div>`;
  }

  // ── Tab renderers ──────────────────────────────────────────────────────────

  function renderTab(tabName, result) {
    switch (tabName) {
      case 'metrics':     renderMetrics(result);     break;
      case 'smells':      renderSmells(result);      break;
      case 'suggestions': renderSuggestions(result); break;
      case 'report':      renderReport(result);      break;
    }
  }

  // --- METRICS ---
  function renderMetrics({ metrics }) {
    const { n1, n2, N1, N2, n, N, V, D, E, MI, G, LOC, flags, steps } = metrics;

    const metricCards = [
      { label: 'Volume (V)',         value: V,   flag: flags.V,  formula: `N × log₂(n) = ${N} × log₂(${n})` },
      { label: 'Difficulty (D)',     value: D,   flag: flags.D,  formula: `(n₁/2) × (N₂/n₂) = (${n1}/2) × (${N2}/${n2})` },
      { label: 'Effort (E)',         value: E,   flag: flags.E,  formula: `D × V = ${D} × ${V}` },
      { label: 'Maint. Index (MI)',  value: MI,  flag: flags.MI, formula: `171 − 5.2ln(${V.toFixed(1)}) − 0.23×${G} − 16.2ln(${LOC})` },
    ];

    const cardsHTML = metricCards.map(m => `
      <div class="metric-card ${m.flag ? 'breach' : ''}">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
        <div class="metric-formula">${m.formula}</div>
        ${m.flag ? `<div class="metric-flag">⚠ ${m.flag}</div>` : ''}
      </div>`).join('');

    const stepsHTML = steps.map(s => `
      <div class="formula-row">
        <span class="fkey">${s.key}</span>
        <span class="fval">${s.val}</span>
      </div>`).join('');

    tabContent.innerHTML = `
      <div class="metrics-grid">${cardsHTML}</div>
      <div class="formula-breakdown">
        <h4>Step-by-step calculation</h4>
        ${stepsHTML}
      </div>`;
  }

  // --- SMELLS ---
  function renderSmells({ smells }) {
    if (smells.length === 0) {
      tabContent.innerHTML = `<div class="no-smells">✅ No code smells detected!<br><small style="color:var(--muted);font-weight:400">Clean, well-structured code.</small></div>`;
      return;
    }

    const cards = smells.map(s => `
      <div class="smell-card">
        <span class="smell-badge badge-${s.severity}">${s.severity}</span>
        <div class="smell-info">
          <h4>${s.label}</h4>
          <p>${s.detail}</p>
          <div class="smell-line">${s.lineRange}</div>
        </div>
      </div>`).join('');

    tabContent.innerHTML = `<div class="smell-list">${cards}</div>`;
  }

  // --- SUGGESTIONS ---
  function renderSuggestions({ suggestions }) {
    if (suggestions.length === 0) {
      tabContent.innerHTML = `<div class="no-smells">✅ No refactoring suggestions needed!</div>`;
      return;
    }

    const cards = suggestions.map(s => `
      <div class="suggestion-card">
        <div class="suggestion-header">
          <span class="smell-badge badge-${s.severity}">${s.severity}</span>
          <h4>${s.smellLabel} — ${s.affectedName}</h4>
          <span class="pattern-tag">${s.pattern}</span>
        </div>
        <div class="suggestion-rationale">${s.rationale}</div>
        <div class="diff-pane">
          <div class="diff-side">
            <div class="diff-label">Before</div>
            <div class="diff-code">${escapeHtml(s.before) || '<em style="color:var(--muted)">No snippet available</em>'}</div>
          </div>
          <div class="diff-side">
            <div class="diff-label">After</div>
            <div class="diff-code">${escapeHtml(s.after) || '<em style="color:var(--muted)">See refactoring pattern</em>'}</div>
          </div>
        </div>
      </div>`).join('');

    tabContent.innerHTML = `<div class="suggestion-list">${cards}</div>`;
  }

  // --- REPORT ---
  function renderReport({ score, grade, metrics, smells, suggestions, lang }) {
    const timestamp = new Date().toLocaleString();

    const smellRows = smells.map(s => `
      <tr>
        <td><span class="smell-badge badge-${s.severity}" style="font-size:10px">${s.severity}</span></td>
        <td>${s.label}</td>
        <td>${s.affectedName}</td>
        <td>${s.lineRange}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:var(--low)">✅ No smells detected</td></tr>';

    tabContent.innerHTML = `
      <div class="report-actions">
        <button class="btn-export btn-pdf" id="exportPDF">⬇ Download PDF</button>
        <button class="btn-export btn-html" id="exportHTML">⬇ Download HTML</button>
      </div>
      <div class="report-preview">
        <h3>Refactoring Advisor · Analysis Report</h3>
        <p style="color:var(--muted);font-size:12px">${timestamp} · Language: ${lang.toUpperCase()}</p>

        <h4>Quality Score</h4>
        <p><span style="font-size:32px;font-weight:700;color:${grade.color};font-family:var(--font-mono)">${score}</span>
        &nbsp;<span style="color:${grade.color};font-weight:600">${grade.label}</span></p>

        <h4>Halstead Metrics</h4>
        <table class="report-table">
          <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
          <tr><td>Volume (V)</td><td>${metrics.V}</td><td>${metrics.flags.V ? '⚠ '+metrics.flags.V : '✅ OK'}</td></tr>
          <tr><td>Difficulty (D)</td><td>${metrics.D}</td><td>${metrics.flags.D ? '⚠ '+metrics.flags.D : '✅ OK'}</td></tr>
          <tr><td>Effort (E)</td><td>${metrics.E}</td><td>${metrics.flags.E ? '⚠ '+metrics.flags.E : '✅ OK'}</td></tr>
          <tr><td>Maint. Index (MI)</td><td>${metrics.MI}</td><td>${metrics.flags.MI ? '⚠ '+metrics.flags.MI : '✅ OK'}</td></tr>
          <tr><td>LOC</td><td>${metrics.LOC}</td><td>—</td></tr>
        </table>

        <h4>Detected Smells</h4>
        <table class="report-table">
          <tr><th>Severity</th><th>Type</th><th>Location</th><th>Range</th></tr>
          ${smellRows}
        </table>

        <h4>Suggestions Summary</h4>
        ${suggestions.map(s => `<p style="font-size:12px">• <strong>${s.smellLabel}</strong> → ${s.pattern}: ${s.rationale}</p>`).join('')
          || '<p style="color:var(--low)">✅ No suggestions needed</p>'}
      </div>`;

    document.getElementById('exportPDF').addEventListener('click', () => {
      ReportGenerator.exportPDF({ score, grade, metrics, smells, suggestions, lang, timestamp });
    });
    document.getElementById('exportHTML').addEventListener('click', () => {
      ReportGenerator.exportHTML({ score, grade, metrics, smells, suggestions, lang, timestamp });
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
