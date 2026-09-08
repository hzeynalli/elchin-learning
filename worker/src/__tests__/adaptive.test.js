import { describe, it, expect } from 'vitest';
import { createPlan, nextSpec, recordAnswer, startSitting, summarize, targetedSpecs } from '../adaptive.js';

const skills = [
  { id: 'A', priority: 1, grade: 5, prerequisites: ['P1'] },
  { id: 'B', priority: 1, grade: 5, prerequisites: [] },
  { id: 'C', priority: 2, grade: 5, prerequisites: [] },
  { id: 'P1', priority: 1, grade: 4, prerequisites: [] },
];

describe('docs/02 §1 adaptive diagnostic', () => {
  it('scope A = priority-1 skills only; starts at tier 2', () => {
    const plan = createPlan({ skills, scope: 'A' });
    expect(plan.skills.map((s) => s.id)).toEqual(['A', 'B', 'P1']);
    expect(nextSpec(plan)).toEqual({ skill_id: 'A', tier: 2 });
  });
  it('4/4 → stop, secure candidate; tier climbs to 3 and stays', () => {
    const plan = createPlan({ skills, skill_ids: ['A'] });
    for (let i = 0; i < 4; i++) recordAnswer(plan, { skill_id: 'A', correct: true });
    expect(plan.skills[0]).toMatchObject({ done: true, result: 'secure_candidate', asked: 4, tier: 3 });
    expect(nextSpec(plan)).toEqual({ test_complete: true });
  });
  it('3 wrong within the first 4 → stop, not yet; tier drops but never below 1', () => {
    const plan = createPlan({ skills, skill_ids: ['A'] });
    recordAnswer(plan, { skill_id: 'A', correct: false });
    recordAnswer(plan, { skill_id: 'A', correct: false });
    expect(plan.skills[0].tier).toBe(1);
    recordAnswer(plan, { skill_id: 'A', correct: true });
    recordAnswer(plan, { skill_id: 'A', correct: false });
    expect(plan.skills[0]).toMatchObject({ done: true, result: 'not_yet', asked: 4 });
  });
  it('otherwise continues to 8 items and finishes by rate', () => {
    const plan = createPlan({ skills, skill_ids: ['A'] });
    const pattern = [true, false, true, true, false, true, true, true];
    pattern.forEach((c) => recordAnswer(plan, { skill_id: 'A', correct: c }));
    expect(plan.skills[0]).toMatchObject({ done: true, result: 'by_rate', asked: 8, correct: 6 });
    expect(summarize(plan)[0]).toMatchObject({ items: 8, correct: 6, rate: 0.75 });
  });
  it('interleaves: never the same skill twice in a row while another is open', () => {
    const plan = createPlan({ skills, skill_ids: ['A', 'B'] });
    const seq = [];
    for (let i = 0; i < 8; i++) { const n = nextSpec(plan); seq.push(n.skill_id); recordAnswer(plan, { skill_id: n.skill_id, correct: true }); }
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(nextSpec(plan)).toEqual({ test_complete: true });
  });
  it('sitting cap 25, resumable', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: 'S' + i, priority: 1, grade: 5, prerequisites: [] }));
    const plan = createPlan({ skills: many, scope: 'A' });
    for (let i = 0; i < 25; i++) { const n = nextSpec(plan); recordAnswer(plan, { skill_id: n.skill_id, correct: i % 2 === 0 }); }
    expect(nextSpec(plan)).toEqual({ sitting_complete: true });
    startSitting(plan);
    expect(nextSpec(plan).skill_id).toBeDefined();
  });
  it('prerequisite gating: a failed Grade-5 skill pulls in prerequisites with no data', () => {
    const plan = createPlan({ skills, skill_ids: ['A'] });
    const ctx = { skills, states: {} };
    for (const c of [false, false, false]) recordAnswer(plan, { skill_id: 'A', correct: c }, ctx);
    expect(plan.skills.map((s) => s.id)).toEqual(['A', 'P1']);
    expect(plan.gated).toEqual([{ from: 'A', added: 'P1' }]);
    // …but not when the prerequisite already has evidence
    const plan2 = createPlan({ skills, skill_ids: ['A'] });
    const ctx2 = { skills, states: { P1: { status: 'secure', attempts: 2 } } };
    for (const c of [false, false, false]) recordAnswer(plan2, { skill_id: 'A', correct: c }, ctx2);
    expect(plan2.skills.map((s) => s.id)).toEqual(['A']);
  });
  it('tier-3 correct is tracked for the mastery rule', () => {
    const plan = createPlan({ skills, skill_ids: ['A'] });
    [true, true, true, true].forEach((c) => recordAnswer(plan, { skill_id: 'A', correct: c }));
    expect(summarize(plan)[0].tier3_correct).toBe(true);   // 4th item was served at tier 3
  });
});

describe('targeted test', () => {
  it('15 items only over weak skills, interleaved, weighted by urgency', () => {
    const specs = targetedSpecs({ weak: [{ skill_id: 'A', urgency: 8, status: 'not_yet' }, { skill_id: 'B', urgency: 2, status: 'emerging' }, { skill_id: 'C', urgency: 5, status: 'emerging' }] });
    expect(specs).toHaveLength(15);
    expect(new Set(specs.map((s) => s.skill_id))).toEqual(new Set(['A', 'B', 'C']));
    const nA = specs.filter((s) => s.skill_id === 'A').length, nB = specs.filter((s) => s.skill_id === 'B').length;
    expect(nA).toBeGreaterThan(nB);
    expect(specs.every((s) => s.tier >= 1 && s.tier <= 3)).toBe(true);
  });
});
