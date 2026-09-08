// Retention engine — FSRS-lite per skill (docs/06 §2), implicit repetition, timing evidence, interference rule,
// daily-review planning. Pure functions; the Worker persists the returned fields on skill_state.
//
// R(t) = (1 + t/(9S))^-1 ; review due when R <= target (0.9) → interval = 9S(1/target − 1) = S days.
// Pass:  S' = S · (1 + credit · e^w8 · (11 − D) · S^(−w9) · (e^(w10·(1−R)) − 1)), capped at cap·S, never below S.
// Fail:  S' = max(min_S, fail_S · S), D' = min(10, D + 1). First S after Secure = first_S (2 days).
// NOTE (flagged in HANDOFF.md): docs/06 prints e^0.6, S^-0.2, e^(0.1(1-R)) — those constants give ~10 % growth per
// review and cannot produce the "≈ 2, 6, 15, 35, 80, 180 days" schedule the same section promises. The defaults below
// are FSRS's published weights (w8 = 1.49, w9 = 0.14, w10 = 0.94), which do. All are parameters.

export const FSRS = {
  target_R: 0.9, first_S: 2, w8: 1.49, w9: 0.14, w10: 0.94, cap: 3, fail_S: 0.3, min_S: 1,
  D_default: 5, D_drift: 0.1, implicit_credit: 0.5, slow_factor: 2, slow_credit: 0.5, daily_cap: 10,
};
const DAY = 86400000;
const r2 = (x) => Math.round(x * 100) / 100;
export const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * DAY).toISOString();
export const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

export function retrievability(days, S) { return Math.pow(1 + Math.max(0, days) / (9 * S), -1); }
export function intervalDays(S, p = FSRS) { return 9 * S * (1 / p.target_R - 1); }

/** Fields to store when a skill first becomes Secure. */
export function onSecure(now, p = FSRS) {
  return { stability: p.first_S, difficulty: p.D_default, last_review_at: now, next_review_at: addDays(now, intervalDays(p.first_S, p)), review_stage: 1 };
}

/** Apply a scheduled review result. credit ∈ (0,1]: 1 = clean pass, 0.5 = slow-but-correct or implicit repetition. */
export function onReview(state, { passed, credit = 1, now }, p = FSRS) {
  const S = state.stability ?? p.first_S, D = state.difficulty ?? p.D_default;
  const last = state.last_review_at ?? now;
  const R = retrievability(daysBetween(last, now), S);
  if (!passed) {
    const S2 = Math.max(p.min_S, r2(p.fail_S * S)), D2 = Math.min(10, D + 1);
    return { stability: S2, difficulty: D2, last_review_at: now, next_review_at: addDays(now, intervalDays(S2, p)), review_stage: 0, regressed: true };
  }
  const growth = Math.exp(p.w8) * (11 - D) * Math.pow(S, -p.w9) * (Math.exp(p.w10 * (1 - R)) - 1);
  let S2 = S * (1 + Math.max(0, Math.min(1, credit)) * growth);
  S2 = r2(Math.max(S, Math.min(S2, p.cap * S)));
  const D2 = r2(D + (p.D_default - D) * p.D_drift);
  return { stability: S2, difficulty: D2, last_review_at: now, next_review_at: addDays(now, intervalDays(S2, p)), review_stage: (state.review_stage ?? 0) + 1, regressed: false };
}

/** Implicit repetition (Math Academy): a correct answer on a skill gives partial review credit to each direct prerequisite.
 *  Only for maths and grammar mechanics — the caller filters by subject/strand (docs/06 §2). Never counts toward Mastered. */
export function implicitRepetition(prereqState, now, p = FSRS) {
  if (!prereqState || !prereqState.stability) return null;                 // only Secure/Mastered skills carry S
  const r = onReview(prereqState, { passed: true, credit: p.implicit_credit, now }, p);
  return { ...r, review_stage: prereqState.review_stage ?? 0 };             // stage unchanged: not a real review
}

/** Timing as evidence: correct but slower than slow_factor × expected → half credit. */
export function timingCredit({ correct, time_s, expected_s }, p = FSRS) {
  if (!correct) return 0;
  if (expected_s && time_s != null && time_s > p.slow_factor * expected_s) return p.slow_credit;
  return 1;
}

/** Skills whose review is due, most overdue first. states: [{skill_id, status, next_review_at, ...}] */
export function dueSkills(states, now) {
  const t = new Date(now).getTime();
  return states
    .filter((s) => (s.status === 'secure' || s.status === 'mastered') && s.next_review_at && new Date(s.next_review_at).getTime() <= t)
    .map((s) => ({ ...s, days_overdue: r2((t - new Date(s.next_review_at).getTime()) / DAY) }))
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

/** Interference rule: never put two confusable skills in one session unless both are Secure/Mastered.
 *  confusables: [[idA, idB], ...]. Returns the chosen skill ids (≤ cap), most overdue first. */
export function planDailyReview(states, { now, cap = FSRS.daily_cap, confusables = [], statusOf = {} }) {
  const partner = new Map();
  for (const [a, b] of confusables) { partner.set(a, b); partner.set(b, a); }
  const isSecure = (id) => ['secure', 'mastered'].includes(statusOf[id]);
  const chosen = [];
  for (const s of dueSkills(states, now)) {
    if (chosen.length >= cap) break;
    const other = partner.get(s.skill_id);
    if (other && chosen.includes(other) && !(isSecure(s.skill_id) && isSecure(other))) continue;
    chosen.push(s.skill_id);
  }
  return chosen;
}

/** Learn-ahead frontier (docs/06 §1): skills of the given month whose prerequisites are all Secure/Mastered; cap 2. */
export function learnAheadCandidates(skills, statusOf, month, cap = 2) {
  const ok = (id) => ['secure', 'mastered'].includes(statusOf[id]);
  return skills
    .filter((sk) => sk.planned_month === month && !ok(sk.id) && sk.prerequisites.every(ok))
    .slice(0, cap)
    .map((sk) => sk.id);
}
