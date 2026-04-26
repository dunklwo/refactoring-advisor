/**
 * halstead.js
 * Computes all Halstead software metrics from token counts.
 * Shows step-by-step formula breakdown for pedagogical transparency.
 *
 * Metrics: n, N, V, D, E, MI (Maintainability Index)
 * Reference: Halstead (1977), Elements of Software Science
 */

const HalsteadEngine = (() => {

  /**
   * Compute cyclomatic complexity (McCabe) as approximation for G in MI formula.
   * G ≈ number of branch points + 1
   */
  function computeCyclomaticComplexity(code, lang) {
    const branchKeywords = {
      python: /\b(if|elif|else|for|while|and|or|except|with)\b/g,
      java:   /\b(if|else|for|while|do|case|catch|&&|\|\|)\b/g,
      c:      /\b(if|else|for|while|do|case|&&|\|\|)\b/g
    };
    const pattern = branchKeywords[lang] || branchKeywords.python;
    const matches = code.match(pattern);
    return (matches ? matches.length : 0) + 1;
  }

  /**
   * Count non-blank, non-comment lines of code (LOC).
   */
  function countLOC(code, lang) {
    return code.split('\n').filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (lang === 'python' && trimmed.startsWith('#')) return false;
      if ((lang === 'java' || lang === 'c') && trimmed.startsWith('//')) return false;
      if ((lang === 'java' || lang === 'c') && trimmed.startsWith('/*')) return false;
      return true;
    }).length;
  }

  /**
   * Main computation.
   * @param {object} tokens - { n1, n2, N1, N2, operators, operands }
   * @param {string} code   - original source code (for LOC and complexity)
   * @param {string} lang   - 'python' | 'java' | 'c'
   * @returns {object} metrics + step-by-step breakdown
   */
  function compute(tokens, code, lang) {
    const { n1, n2, N1, N2 } = tokens;

    // Guard against zero division
    const safeN2 = n2 === 0 ? 1 : n2;
    const safeN  = (n1 + n2) === 0 ? 1 : (n1 + n2);
    const safeN_total = (N1 + N2) === 0 ? 1 : (N1 + N2);

    const n = n1 + n2;           // Vocabulary
    const N = N1 + N2;           // Length
    const V = N * Math.log2(safeN);                 // Volume
    const D = (n1 / 2) * (N2 / safeN2);             // Difficulty
    const E = D * V;                                 // Effort
    const G = computeCyclomaticComplexity(code, lang);
    const LOC = countLOC(code, lang);

    const safeLnV   = V   > 0 ? Math.log(V)   : 0;
    const safeLnLOC = LOC > 0 ? Math.log(LOC) : 0;

    const MI = Math.max(
      0,
      171 - 5.2 * safeLnV - 0.23 * G - 16.2 * safeLnLOC
    );

    // Threshold flags
    const flags = {
      V:  V   > 1000  ? 'High Complexity (V > 1000)'       : null,
      D:  D   > 25    ? 'Hard to Understand (D > 25)'       : null,
      E:  E   > 10000 ? 'Refactor Advised (E > 10,000)'     : null,
      MI: MI  < 65    ? 'Unmaintainable (MI < 65)'          : null
    };

    const breachCount = Object.values(flags).filter(Boolean).length;

    // Step-by-step breakdown for UI
    const steps = [
      { key: 'n₁ (unique operators)',  val: n1 },
      { key: 'n₂ (unique operands)',   val: n2 },
      { key: 'N₁ (total operators)',   val: N1 },
      { key: 'N₂ (total operands)',    val: N2 },
      { key: 'n  = n₁ + n₂',          val: n },
      { key: 'N  = N₁ + N₂',          val: N },
      { key: 'V  = N × log₂(n)',       val: round(V) },
      { key: 'D  = (n₁/2) × (N₂/n₂)', val: round(D) },
      { key: 'E  = D × V',             val: round(E) },
      { key: 'G  (cyclomatic)',         val: G },
      { key: 'LOC (non-blank)',         val: LOC },
      { key: 'MI = 171 − 5.2ln(V) − 0.23G − 16.2ln(LOC)', val: round(MI) }
    ];

    return {
      n1, n2, N1, N2,
      n, N,
      V:  round(V),
      D:  round(D),
      E:  round(E),
      G,
      LOC,
      MI: round(MI),
      flags,
      breachCount,
      steps
    };
  }

  function round(x) {
    return Math.round(x * 100) / 100;
  }

  return { compute };

})();
