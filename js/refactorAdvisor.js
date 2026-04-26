/**
 * refactorAdvisor.js
 * Generates structured Suggestion objects from detected smells.
 * Each suggestion includes: smell metadata, rationale, before/after code diff.
 *
 * Reference: Fowler (1999) - Refactoring: Improving the Design of Existing Code
 */

const RefactorAdvisor = (() => {

  /**
   * Generate suggestions from a list of smells.
   * @param {Array}  smells  - output from SmellDetector.detect()
   * @param {string} code    - original source code
   * @param {string} lang    - 'python'|'java'|'c'
   * @returns {Array} suggestions
   */
  function generateSuggestions(smells, code, lang) {
    return smells.map((smell, index) => ({
      id: `suggestion_${index}`,
      smellId:     smell.id,
      smellLabel:  smell.label,
      severity:    smell.severity,
      affectedName: smell.affectedName,
      lineRange:   smell.lineRange,
      rationale:   smell.rationale,
      pattern:     smell.pattern,
      detail:      smell.detail,
      before:      cleanCode(smell.beforeSnippet || ''),
      after:       cleanCode(smell.afterSnippet  || '')
    }));
  }

  /**
   * Normalize indentation and trim blank edges.
   */
  function cleanCode(snippet) {
    if (!snippet) return '';
    const lines = snippet.split('\n');
    // Find minimum indent
    const minIndent = lines
      .filter(l => l.trim())
      .reduce((min, l) => Math.min(min, l.match(/^(\s*)/)[1].length), Infinity);
    const normalized = lines.map(l => l.slice(Math.min(minIndent, l.length)));
    // Trim leading/trailing blank lines
    while (normalized.length && !normalized[0].trim()) normalized.shift();
    while (normalized.length && !normalized[normalized.length - 1].trim()) normalized.pop();
    return normalized.join('\n');
  }

  /**
   * Produce a human-readable summary for the report.
   */
  function summarize(suggestions) {
    return suggestions.map(s =>
      `[${s.severity}] ${s.smellLabel} — ${s.affectedName} (${s.lineRange})\n` +
      `  Pattern: ${s.pattern}\n` +
      `  Rationale: ${s.rationale}`
    ).join('\n\n');
  }

  return { generateSuggestions, summarize };

})();
