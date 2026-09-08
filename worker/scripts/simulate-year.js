#!/usr/bin/env node
// Year simulation (BRIEF §8 Phase 6 acceptance; AUDIT round 2 Judge 2: uses the SAME scheduler.js as production).
// A modelled student secures ~2 skills a week from September; every day the app schedules ≤ 10 reviews (most overdue
// first, interference rule applied). Recall probability at a review is the modelled retrievability R(t). We report:
//   - max reviews on any day (must be ≤ 10)
//   - modelled recall of every Mastered skill at the monthly check dates (must be ≥ 0.9)
//   - total review load, and how stable skills stop consuming time.
import { onSecure, onReview, retrievability, planDailyReview, daysBetween, FSRS } from '../src/scheduler.js';
import { readFileSync } from 'node:fs';

const skills = JSON.parse(readFileSync(new URL('../../data/skills_math_ccss.json', import.meta.url), 'utf8')).skills;
const confusables = JSON.parse(readFileSync(new URL('../../data/confusables.json', import.meta.url), 'utf8')).pairs;
const START = new Date('2026-09-10T08:00:00Z'), END = new Date('2027-06-15T08:00:00Z');
const DAY = 86400000;
let seed = 42; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const states = {};                                    // skill_id → state row (as in skill_state)
const statusOf = () => Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.status]));
const queue = skills.map((s) => s.id);                // learning order
let maxPerDay = 0, totalReviews = 0, failed = 0, delayedDays = 0;
const checkResults = [];
for (let t = START.getTime(); t <= END.getTime(); t += DAY) {
  const now = new Date(t).toISOString();
  const dow = new Date(t).getUTCDay();
  // learn: secure 2 new skills per week (Mon, Thu)
  if ((dow === 1 || dow === 4) && queue.length) { const id = queue.shift(); states[id] = { skill_id: id, status: 'secure', reviews_passed: 0, ...onSecure(now) }; }
  // daily reviews: ≤ 10, most overdue first, interference rule
  const due = planDailyReview(Object.values(states), { now, cap: FSRS.daily_cap, confusables, statusOf: statusOf() });
  maxPerDay = Math.max(maxPerDay, due.length);
  for (const id of due) {
    const st = states[id];
    const R = retrievability(daysBetween(st.last_review_at, now), st.stability);
    if (daysBetween(st.next_review_at, now) > 0.5) delayedDays++;
    const passed = rnd() < R;                          // recall probability = modelled retrievability
    totalReviews++;
    const r = onReview(st, { passed, credit: 1, now });
    Object.assign(st, r);
    if (passed) { st.reviews_passed++; if (st.reviews_passed >= 2) st.status = 'mastered'; }
    else { failed++; states[id] = { skill_id: id, status: 'secure', reviews_passed: 0, ...onSecure(now) }; }   // failed → coach loop the same day → Secure again, chain restarts
  }
  // first school week of each month: knowledge check — modelled recall of every Mastered skill
  if (new Date(t).getUTCDate() === 3 && t > START.getTime() + 20 * DAY) {
    const mastered = Object.values(states).filter((s) => s.status === 'mastered');
    const recalls = mastered.map((s) => retrievability(daysBetween(s.last_review_at, now), s.stability));
    checkResults.push({ month: now.slice(0, 7), mastered: mastered.length, min_recall: recalls.length ? Math.min(...recalls) : null, below_09: recalls.filter((r) => r < 0.9).length });
  }
}
const stable = Object.values(states).filter((s) => s.stability >= 60).length;
console.log('Year simulation (same scheduler.js as production)');
console.log(`skills learned: ${skills.length - queue.length}/${skills.length} · reviews: ${totalReviews} (${failed} failed, ${delayedDays} served late) · max per day: ${maxPerDay} (cap ${FSRS.daily_cap}) · skills with S ≥ 60 days by June: ${stable}`);
console.table(checkResults.map((c) => ({ ...c, min_recall: c.min_recall == null ? '-' : c.min_recall.toFixed(3) })));
const ok = maxPerDay <= FSRS.daily_cap && checkResults.every((c) => c.below_09 === 0);
console.log(ok ? 'ACCEPTANCE: PASS — daily reviews ≤ 10 and every Mastered skill ≥ 0.9 modelled recall at each check' : 'ACCEPTANCE: FAIL');
process.exit(ok ? 0 : 1);
