import { describe, it, expect } from 'vitest';
import { retrievability, intervalDays, onSecure, onReview, implicitRepetition, timingCredit, dueSkills, planDailyReview, learnAheadCandidates, addDays } from '../scheduler.js';

const T0 = '2026-09-10T08:00:00.000Z';

describe('FSRS-lite', () => {
  it('review is due exactly when R drops to 0.9, i.e. after S days', () => {
    expect(retrievability(0, 2)).toBe(1);
    expect(retrievability(2, 2)).toBeCloseTo(0.9, 6);
    expect(intervalDays(2)).toBeCloseTo(2, 6);
    expect(intervalDays(15)).toBeCloseTo(15, 6);
  });
  it('first review after Secure is at +2 days', () => {
    const s = onSecure(T0);
    expect(s.stability).toBe(2);
    expect(s.next_review_at).toBe(addDays(T0, 2));
  });
  it('a chain of on-time passes gives roughly 2, 6, 18, 50, 125, 290 days (docs/06: "≈ 2, 6, 15, 35, 80, 180")', () => {
    let st = onSecure(T0), now = T0; const intervals = [2];
    for (let i = 0; i < 5; i++) { now = st.next_review_at; st = onReview(st, { passed: true, now }); intervals.push(Math.round(st.stability)); }
    expect(intervals[1]).toBeGreaterThanOrEqual(5); expect(intervals[1]).toBeLessThanOrEqual(6);
    expect(intervals[2]).toBeGreaterThanOrEqual(12); expect(intervals[2]).toBeLessThanOrEqual(20);
    expect(intervals[5]).toBeGreaterThanOrEqual(150);
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeLessThanOrEqual(3 * intervals[i - 1] + 0.01);
  });
  it('a failed review shrinks S to 30 % (min 1 day) and raises difficulty', () => {
    const st = { stability: 20, difficulty: 5, last_review_at: T0, review_stage: 3 };
    const r = onReview(st, { passed: false, now: addDays(T0, 20) });
    expect(r.stability).toBe(6); expect(r.difficulty).toBe(6); expect(r.regressed).toBe(true); expect(r.review_stage).toBe(0);
    expect(onReview({ stability: 2, difficulty: 9 }, { passed: false, now: T0 }).stability).toBe(1);
  });
  it('reviewing early (R still high) grows S less than reviewing on time', () => {
    const st = onSecure(T0);
    const early = onReview(st, { passed: true, now: addDays(T0, 0.5) });
    const onTime = onReview(st, { passed: true, now: addDays(T0, 2) });
    expect(early.stability).toBeLessThan(onTime.stability);
    expect(early.stability).toBeGreaterThanOrEqual(2);
  });
  it('implicit repetition gives half credit and does not advance the review stage', () => {
    const st = { ...onSecure(T0) };
    const full = onReview(st, { passed: true, now: addDays(T0, 2) });
    const imp = implicitRepetition(st, addDays(T0, 2));
    expect(imp.stability).toBeLessThan(full.stability);
    expect(imp.stability).toBeGreaterThan(2);
    expect(imp.review_stage).toBe(st.review_stage);
    expect(implicitRepetition({ status: 'emerging' }, T0)).toBeNull();
  });
  it('timing credit: slow-but-correct is half credit', () => {
    expect(timingCredit({ correct: true, time_s: 10, expected_s: 20 })).toBe(1);
    expect(timingCredit({ correct: true, time_s: 45, expected_s: 20 })).toBe(0.5);
    expect(timingCredit({ correct: false, time_s: 5, expected_s: 20 })).toBe(0);
  });
});

describe('daily review planning', () => {
  const states = [
    { skill_id: 'A', status: 'secure', next_review_at: addDays(T0, -3) },
    { skill_id: 'B', status: 'mastered', next_review_at: addDays(T0, -1) },
    { skill_id: 'C', status: 'secure', next_review_at: addDays(T0, 2) },
    { skill_id: 'D', status: 'emerging', next_review_at: addDays(T0, -5) },
  ];
  it('due = secure/mastered with next_review_at in the past, most overdue first', () => {
    expect(dueSkills(states, T0).map((s) => s.skill_id)).toEqual(['A', 'B']);
  });
  it('interference: confusable pair not both scheduled unless both are secure', () => {
    const st = [
      { skill_id: 'area', status: 'secure', next_review_at: addDays(T0, -2) },
      { skill_id: 'perimeter', status: 'secure', next_review_at: addDays(T0, -1) },
      { skill_id: 'x', status: 'secure', next_review_at: addDays(T0, -0.5) },
    ];
    const conf = [['area', 'perimeter']];
    expect(planDailyReview(st, { now: T0, confusables: conf, statusOf: { area: 'secure', perimeter: 'emerging' } })).toEqual(['area', 'x']);
    expect(planDailyReview(st, { now: T0, confusables: conf, statusOf: { area: 'secure', perimeter: 'secure' } })).toEqual(['area', 'perimeter', 'x']);
  });
  it('daily cap of 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ skill_id: 's' + i, status: 'secure', next_review_at: addDays(T0, -i) }));
    expect(planDailyReview(many, { now: T0 })).toHaveLength(10);
  });
  it('learn-ahead only proposes skills whose prerequisites are Secure, max 2', () => {
    const skills = [
      { id: 'p', planned_month: '2026-10', prerequisites: [] },
      { id: 'q', planned_month: '2026-10', prerequisites: ['a'] },
      { id: 'r', planned_month: '2026-10', prerequisites: ['zz'] },
      { id: 's', planned_month: '2026-10', prerequisites: [] },
      { id: 't', planned_month: '2026-11', prerequisites: [] },
    ];
    expect(learnAheadCandidates(skills, { a: 'secure' }, '2026-10')).toEqual(['p', 'q']);
    expect(learnAheadCandidates(skills, { a: 'emerging' }, '2026-10')).toEqual(['p', 's']);
  });
});
