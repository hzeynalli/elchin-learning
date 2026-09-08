// Mastery state rules — docs/02-pedagogy.md §3, implemented exactly. Pure function, no I/O.
// Replays ONE skill's chronological evidence and returns its state. Thresholds are settings with the documented defaults.
//
// Evidence event shape (one per qualifying test / practice set / review on this skill):
//   { kind: 'diagnostic'|'targeted'|'manual'|'daily_review'|'practice10'|'confirm5'|'review'|'knowledge_check',
//     items: number,            // items on this skill in that test (qualifying only if >= min_items)
//     correct: number,          // practice10: retry-correct counts 0.5 (caller adds it); confirm5: retries count 0
//     tier3_correct?: boolean,  // at least one tier-3 item answered correctly in this test
//     loop_id?: string,         // coach loop the practice/confirm set belongs to
//     mean_time_s?: number,     // mean seconds per item (fluency skills)
//     at?: string }
//
// Interpretation notes (owner to confirm — see HANDOFF.md):
//  * A Secure/Mastered skill that scores 0.7–0.89 on a later ordinary test keeps its status but its clean streak resets;
//    only the regression rule (< 0.7) or a failed review/knowledge check demotes it.
//  * "Two consecutive qualifying tests ≥ 0.9 with at least one tier-3 item correct" = across those two tests together.
//  * Fluency skills: a pass additionally requires mean_time_s <= fluency_max_s; slow-but-correct never counts as a pass.

export const DEFAULTS = { pass_rate: 0.9, regress_rate: 0.7, emerging_floor: 0.5, min_items: 3, fluency_max_s: 3 };

const fresh = (fluency) => ({
  status: 'not_yet', last_rate: null, attempts: 0,
  clean_streak: 0, streak_tier3: false,      // consecutive ≥ pass_rate ordinary tests, and whether a tier-3 was correct in them
  reviews_passed: 0,                         // passed scheduled reviews since becoming Secure
  loop: null,                                // { id, practice_passed } for the coach loop
  fast: fluency ? false : null,
});

function demote(st, status) {
  return { ...st, status, clean_streak: 0, streak_tier3: false, reviews_passed: 0, loop: null };
}
function secure(st) {
  return { ...st, status: 'secure', reviews_passed: 0, loop: null };
}
function ordinaryTest(st, ev, passed) {
  if (passed) {
    const clean_streak = st.clean_streak + 1;
    const streak_tier3 = st.streak_tier3 || !!ev.tier3_correct;
    const next = { ...st, clean_streak, streak_tier3 };
    if (st.status === 'not_yet' || st.status === 'emerging') {
      return clean_streak >= 2 && streak_tier3 ? secure(next) : { ...next, status: 'emerging' };
    }
    return next;                                                    // secure / mastered stay
  }
  // 0.7–0.89 (or fast-fail on a fluency skill): not a regression, but no credit
  const next = { ...st, clean_streak: 0, streak_tier3: false };
  return st.status === 'not_yet' ? { ...next, status: 'emerging' } : next;
}

export function recomputeSkillState(events, opts = {}) {
  const s = { ...DEFAULTS, ...(opts.settings || {}) };
  const fluency = !!opts.fluency;
  let st = fresh(fluency);
  for (const ev of events || []) {
    if (!ev || !(ev.items >= s.min_items)) continue;                // not a qualifying test
    const rate = ev.correct / ev.items;
    st = { ...st, attempts: st.attempts + 1, last_rate: Math.round(rate * 1000) / 1000 };
    if (fluency) st.fast = rate >= s.pass_rate && ev.mean_time_s != null && ev.mean_time_s <= s.fluency_max_s;
    const passed = rate >= s.pass_rate && (!fluency || st.fast);

    if (rate < s.emerging_floor) { st = demote(st, 'not_yet'); continue; }   // Not yet: last rate < 0.5
    if (rate < s.regress_rate)   { st = demote(st, 'emerging'); continue; }  // Regression: < 0.7 → Emerging, chain cleared

    switch (ev.kind) {
      case 'practice10':
        st = passed
          ? { ...st, loop: { id: ev.loop_id ?? null, practice_passed: true }, status: st.status === 'not_yet' ? 'emerging' : st.status }
          : { ...st, loop: null, status: st.status === 'not_yet' ? 'emerging' : st.status };
        break;
      case 'confirm5': {
        const sameLoop = st.loop?.practice_passed && (ev.loop_id == null || st.loop.id == null || st.loop.id === ev.loop_id);
        st = passed && sameLoop
          ? secure(st)                                              // PRACTICE ≥ 0.9 and CONFIRM ≥ 0.9 in the same loop
          : { ...st, loop: null, status: st.status === 'not_yet' ? 'emerging' : st.status };
        break;
      }
      case 'review':
      case 'knowledge_check':
        if (st.status === 'secure' || st.status === 'mastered') {
          st = passed
            ? { ...st, reviews_passed: st.reviews_passed + 1, status: st.reviews_passed + 1 >= 2 ? 'mastered' : st.status }
            : demote(st, 'emerging');                               // failed review → Emerging, back into the loop
        } else {
          st = ordinaryTest(st, ev, passed);
        }
        break;
      default:                                                      // diagnostic, targeted, manual, daily_review
        st = ordinaryTest(st, ev, passed);
    }
  }
  const { streak_tier3, ...out } = st;
  return { ...out, loop_state: st.loop?.practice_passed ? 'CONFIRM_5' : null };
}

// Urgency score per skill — BRIEF.md §7.
export function urgencyScore({ priority, status, dependents_not_secure = 0, days_overdue = 0 }) {
  const notSecure = status !== 'secure' && status !== 'mastered' ? 1 : 0;
  return 3 * (priority === 1 ? 1 : 0) * notSecure + 2 * dependents_not_secure + 1 * Math.max(0, days_overdue) + (status === 'not_yet' ? 1 : 0);
}
