/**
 * scoreEngine.js
 * Computes the Refactoring Priority Score (0–100).
 *
 * Formula (FR-5):
 *   score = 100
 *         − (HIGH_smells × 15)
 *         − (MEDIUM_smells × 8)
 *         − (LOW_smells × 3)
 *         − (breached_metric_thresholds × 5)
 *   score = max(0, score)
 */

const ScoreEngine = (() => {

  const WEIGHTS = { HIGH: 15, MEDIUM: 8, LOW: 3 };
  const METRIC_BREACH_PENALTY = 5;

  /**
   * @param {Array}  smells        - from SmellDetector
   * @param {object} halsteadResult - from HalsteadEngine (includes .breachCount)
   * @returns {{ score, breakdown }}
   */
  function compute(smells, halsteadResult) {
    let smellPenalty = 0;
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    smells.forEach(s => {
      counts[s.severity] = (counts[s.severity] || 0) + 1;
      smellPenalty += WEIGHTS[s.severity] || 0;
    });

    const metricPenalty = (halsteadResult.breachCount || 0) * METRIC_BREACH_PENALTY;
    const raw   = 100 - smellPenalty - metricPenalty;
    const score = Math.max(0, raw);

    const breakdown = {
      highSmells:    counts.HIGH   || 0,
      mediumSmells:  counts.MEDIUM || 0,
      lowSmells:     counts.LOW    || 0,
      smellPenalty,
      metricBreaches: halsteadResult.breachCount || 0,
      metricPenalty,
      rawScore: raw,
      finalScore: score
    };

    return { score, breakdown };
  }

  /**
   * Return a label and ring color based on score.
   */
  function grade(score) {
    if (score >= 85) return { label: 'Excellent',    color: '#00e5a0' };
    if (score >= 70) return { label: 'Good',         color: '#6dd5a0' };
    if (score >= 55) return { label: 'Fair',         color: '#ffb347' };
    if (score >= 40) return { label: 'Poor',         color: '#ff8c42' };
    return               { label: 'Critical',        color: '#ff4d6d' };
  }

  return { compute, grade };

})();
