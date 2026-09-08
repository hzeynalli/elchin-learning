import { describe, it, expect } from 'vitest';
import { recomputeSkillState, urgencyScore } from '../mastery.js';

const T = (kind, items, correct, extra = {}) => ({ kind, items, correct, ...extra });

describe('docs/02 §3 — the eight rule cases', () => {
  it('1. no data → not_yet', () => {
    expect(recomputeSkillState([]).status).toBe('not_yet');
  });
  it('2. last rate < 0.5 → not_yet', () => {
    expect(recomputeSkillState([T('diagnostic', 5, 2)]).status).toBe('not_yet');
  });
  it('3. last rate 0.5–0.89 → emerging', () => {
    expect(recomputeSkillState([T('diagnostic', 8, 6)]).status).toBe('emerging');
    expect(recomputeSkillState([T('targeted', 4, 2)]).status).toBe('emerging');
  });
  it('4. diagnostic 4/4 without confirmation → emerging', () => {
    const st = recomputeSkillState([T('diagnostic', 4, 4, { tier3_correct: true })]);
    expect(st.status).toBe('emerging');
    expect(st.clean_streak).toBe(1);
  });
  it('5. PRACTICE_10 passed but CONFIRM not yet → emerging', () => {
    const st = recomputeSkillState([T('practice10', 10, 9, { loop_id: 'L1' })]);
    expect(st.status).toBe('emerging');
    expect(st.loop_state).toBe('CONFIRM_5');
  });
  it('6. PRACTICE_10 ≥ 0.9 and CONFIRM_5 ≥ 0.9 in the same loop → secure', () => {
    const st = recomputeSkillState([T('practice10', 10, 9, { loop_id: 'L1' }), T('confirm5', 5, 5, { loop_id: 'L1' })]);
    expect(st.status).toBe('secure');
  });
  it('7. two consecutive qualifying tests ≥ 0.9 with a tier-3 correct → secure', () => {
    const st = recomputeSkillState([T('diagnostic', 4, 4), T('targeted', 5, 5, { tier3_correct: true })]);
    expect(st.status).toBe('secure');
    // …but not without any tier-3 correct
    expect(recomputeSkillState([T('diagnostic', 4, 4), T('targeted', 5, 5)]).status).toBe('emerging');
    // …and not if they are not consecutive
    expect(recomputeSkillState([T('diagnostic', 4, 4), T('targeted', 5, 4), T('targeted', 5, 5, { tier3_correct: true })]).status).toBe('emerging');
  });
  it('8. secure, then two passed reviews → mastered', () => {
    const base = [T('practice10', 10, 9, { loop_id: 'L1' }), T('confirm5', 5, 5, { loop_id: 'L1' })];
    expect(recomputeSkillState([...base, T('review', 3, 3)]).status).toBe('secure');
    expect(recomputeSkillState([...base, T('review', 3, 3), T('review', 3, 3)]).status).toBe('mastered');
  });
});

describe('regression, reviews, loops and fluency', () => {
  const secureBase = [T('practice10', 10, 9, { loop_id: 'L1' }), T('confirm5', 5, 5, { loop_id: 'L1' })];
  it('regression: any qualifying test < 0.7 → emerging, review chain cleared', () => {
    const st = recomputeSkillState([...secureBase, T('review', 3, 3), T('targeted', 5, 3)]);
    expect(st.status).toBe('emerging');
    expect(st.reviews_passed).toBe(0);
    expect(st.clean_streak).toBe(0);
  });
  it('a failed review (0.7–0.89) on a mastered skill → emerging', () => {
    const st = recomputeSkillState([...secureBase, T('review', 3, 3), T('review', 3, 3), T('review', 4, 3)]);
    expect(st.status).toBe('emerging');
  });
  it('a secure skill scoring 0.8 on an ordinary test keeps secure but loses its streak', () => {
    const st = recomputeSkillState([...secureBase, T('targeted', 5, 4)]);
    expect(st.status).toBe('secure');
    expect(st.clean_streak).toBe(0);
  });
  it('a failed CONFIRM resets the loop: a later CONFIRM alone cannot make it secure', () => {
    const st = recomputeSkillState([T('practice10', 10, 9, { loop_id: 'L1' }), T('confirm5', 5, 4, { loop_id: 'L1' }), T('confirm5', 5, 5, { loop_id: 'L1' })]);
    expect(st.status).toBe('emerging');
  });
  it('practice and confirm from different loops do not combine', () => {
    const st = recomputeSkillState([T('practice10', 10, 9, { loop_id: 'L1' }), T('confirm5', 5, 5, { loop_id: 'L2' })]);
    expect(st.status).toBe('emerging');
  });
  it('retry-correct counted as 0.5 by the caller: 8 + 2×0.5 = 9/10 passes practice', () => {
    expect(recomputeSkillState([T('practice10', 10, 9)]).loop_state).toBe('CONFIRM_5');
    expect(recomputeSkillState([T('practice10', 10, 8.5)]).loop_state).toBe(null);
  });
  it('tests with fewer than 3 items on the skill are ignored', () => {
    expect(recomputeSkillState([T('diagnostic', 2, 0)]).status).toBe('not_yet');
    expect(recomputeSkillState([T('diagnostic', 8, 8, { tier3_correct: true }), T('targeted', 2, 0), T('targeted', 4, 4)]).status).toBe('secure');
  });
  it('fluency skills need the fast flag: ≥ 90% at ≤ 3 s per item', () => {
    const slow = recomputeSkillState([T('diagnostic', 6, 6, { mean_time_s: 4.2 })], { fluency: true });
    expect(slow.fast).toBe(false); expect(slow.status).toBe('emerging');
    const fast = recomputeSkillState([T('diagnostic', 6, 6, { mean_time_s: 2.5, tier3_correct: true }), T('targeted', 6, 6, { mean_time_s: 2.1 })], { fluency: true });
    expect(fast.fast).toBe(true); expect(fast.status).toBe('secure');
  });
  it('thresholds are settings', () => {
    const st = recomputeSkillState([T('practice10', 10, 8, { loop_id: 'L' }), T('confirm5', 5, 4, { loop_id: 'L' })], { settings: { pass_rate: 0.8 } });
    expect(st.status).toBe('secure');
  });
});

describe('urgency score (BRIEF §7)', () => {
  it('priority-1 not_yet with two blocked dependents and 3 days overdue', () => {
    expect(urgencyScore({ priority: 1, status: 'not_yet', dependents_not_secure: 2, days_overdue: 3 })).toBe(3 + 4 + 3 + 1);
  });
  it('secure priority-1 skill scores 0 from the priority term', () => {
    expect(urgencyScore({ priority: 1, status: 'secure' })).toBe(0);
  });
});
