import type { Criterion, CriterionScore } from './types'

/**
 * Weighted score out of 100.
 *
 * Each criterion is scored 0 to 10. Criteria without a score (no verified
 * evidence) are left out of both the points and the weights, so a company is
 * never punished or rewarded for what could not be checked. Returns null when
 * nothing is scored or every weight is zero.
 *
 * The board calls this in the browser with the visitor's what-if weights, and
 * the worker calls it with the saved weights. Same function, same result.
 */
export function weightedScore(scores: CriterionScore[], criteria: Criterion[]): number | null {
  let points = 0
  let weights = 0
  for (const criterion of criteria) {
    const score = scores.find((s) => s.key === criterion.key)?.score
    if (typeof score !== 'number' || criterion.weight <= 0) continue
    points += criterion.weight * score
    weights += criterion.weight
  }
  return weights === 0 ? null : Math.round((10 * points) / weights)
}

/** How many criteria have a score, e.g. "4 of 5 criteria scored". */
export function coverage(scores: CriterionScore[], criteria: Criterion[]): { scored: number; total: number } {
  const scored = criteria.filter((c) => typeof scores.find((s) => s.key === c.key)?.score === 'number').length
  return { scored, total: criteria.length }
}

/** Tally of revealed votes. */
export function tally(votes: { decision: 'invest' | 'pass'; conviction: number }[]) {
  const invest = votes.filter((v) => v.decision === 'invest')
  const pass = votes.filter((v) => v.decision === 'pass')
  const sum = (list: typeof votes) => list.reduce((total, v) => total + v.conviction, 0)
  return { invest: invest.length, pass: pass.length, investConviction: sum(invest), passConviction: sum(pass) }
}
