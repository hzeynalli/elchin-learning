import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { testsRoutes } from '../tests.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8')).skills;
const skills = [...load('skills_math_ccss.json'), ...load('skills_reading.json')].map((s) => ({ ...s, fluency: ['G4.OA.F', '5.FLU'].includes(s.id), active: true }));
const STUDENT = 's-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { pass_rate: 0.9, regress_rate: 0.7 } }];
const env = { MODEL_GEN: 'claude-sonnet-5' };
let repo, student;
const ctx = (body, extra = {}) => ({ env, repo, studentId: STUDENT, profile: student, body, now: new Date('2026-09-10T08:00:00Z'), url: new URL('http://x/?' + new URLSearchParams(extra)), ...extra });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); student = profiles[0]; });

async function answerAll(testId, first, decide) {
  let step = first, n = 0;
  while (step.item && n < 400) {
    const given = decide(step.item, n) ? step.item.__answer : 'wrong-answer-0';
    step = await testsRoutes['POST /next-item'](ctx({ test_id: testId, last_answer: { item_id: step.item.id, answer: given, time_s: 20 } }));
    n++;
  }
  return { step, n };
}
// helper: peek the stored answer (the client never sees it; the test may)
async function withAnswer(step) { if (step.item) { const row = await repo.getTestItem(step.item.id); step.item.__answer = Array.isArray(row.item.answer) ? row.item.answer : row.item.answer; } return step; }

describe('diagnostic (adaptive, docs/02 §1)', () => {
  it('serves items without answers, stops per skill, caps sittings at 25 and resumes', async () => {
    const start = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', scope: 'A' }));
    expect(start.item).toBeDefined(); expect(start.item.answer).toBeUndefined(); expect(start.item.stem).toBeTruthy();
    expect(start.progress.skills_total).toBe(15);
    // sitting 1: answer everything correctly → 25 items then sitting_complete
    let step = await withAnswer(start);
    for (let i = 0; i < 25; i++) { step = await withAnswer(await testsRoutes['POST /next-item'](ctx({ test_id: start.test_id, last_answer: { item_id: step.item.id, answer: step.item.__answer, time_s: 12 } }))); if (step.sitting_complete) break; }
    expect(step.sitting_complete).toBe(true);
    expect(step.last.correct).toBe(true); expect(step.last.explanation).toBeTruthy();
    // resume
    const again = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic' }));
    expect(again.resumed).toBe(true); expect(again.test_id).toBe(start.test_id); expect(again.item).toBeDefined();
  });
  it('a skill with 4/4 stops as secure candidate → emerging; 3 wrong in 4 → not_yet; complete test recomputes states and awards points', async () => {
    const start = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', skill_ids: ['5.OA.1', '5.NBT.5'] }));
    let step = await withAnswer(start); let n = 0;
    while (step.item && n < 60) {
      const right = step.item.skill_id === '5.OA.1';
      step = await withAnswer(await testsRoutes['POST /next-item'](ctx({ test_id: start.test_id, last_answer: { item_id: step.item.id, answer: right ? step.item.__answer : 'nope', time_s: 15 } })));
      n++;
    }
    expect(step.test_complete).toBe(true);
    const per = Object.fromEntries(step.results.per_skill.map((s) => [s.skill_id, s]));
    expect(per['5.OA.1']).toMatchObject({ items: 4, correct: 4, status_after: 'emerging' });
    expect(per['5.NBT.5']).toMatchObject({ items: 3, correct: 0, status_after: 'not_yet' });
    // prerequisite gating: the failed Grade-5 skill pulled in G4.NBT.3 (no data yet) — root-cause finding
    expect(per['G4.NBT.3']).toMatchObject({ items: 3, correct: 0 });
    expect(step.results.points).toBeGreaterThan(0);
    expect((await repo.getPoints(STUDENT)).length).toBe(1);
    const t = (await repo.getTests(STUDENT))[0]; expect(t.status).toBe('complete'); expect(t.score).toBe(0.4);
    expect(t.plan.gated).toEqual([{ from: '5.NBT.5', added: 'G4.NBT.3' }]);
  });
  it('two diagnostics in a row produce different items (fresh seeds + dedupe)', async () => {
    const a = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', skill_ids: ['G4.NBT.3'] }));
    const b = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', skill_ids: ['G4.NBT.3'], restart: true }));
    expect(a.item.stem).not.toBe(b.item.stem);
  });
});

describe('targeted test', () => {
  it('contains only weak skills, 15 items, autosave then submit marks and reports', async () => {
    await repo.upsertSkillState({ student_id: STUDENT, skill_id: 'G4.OA.F', status: 'secure', attempts: 3 });
    await repo.upsertSkillState({ student_id: STUDENT, skill_id: '5.OA.1', status: 'emerging', attempts: 1 });
    const t = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'targeted' }));
    expect(t.items).toHaveLength(15);
    expect(t.items.some((i) => i.skill_id === 'G4.OA.F')).toBe(false);
    expect(t.items.every((i) => i.answer === undefined)).toBe(true);
    await testsRoutes['POST /answer-item'](ctx({ test_id: t.test_id, item_id: t.items[0].id, answer: '1', time_s: 5 }));
    const rows = await repo.getTestItems(t.test_id);
    const answers = rows.map((r) => ({ item_id: r.id, answer: Array.isArray(r.item.answer) ? r.item.answer : r.item.answer, time_s: 10 }));
    const res = await testsRoutes['POST /submit-test'](ctx({ test_id: t.test_id, answers }));
    expect(res.results.correct).toBe(15); expect(res.results.score).toBe(1);
    expect(res.results.items[0].explanation).toBeTruthy();
    await expect(testsRoutes['POST /submit-test'](ctx({ test_id: t.test_id, answers }))).rejects.toThrow(/already complete/);
  });
});

describe('practice10 / confirm5 (coach loop sets)', () => {
  it('practice allows one retry after a hint; retry-correct counts 0.5; confirm needs 3 tier-3 items', async () => {
    const p = await testsRoutes['POST /generate-test'](ctx({ mode: 'practice10', skill_id: '5.NBT.5', loop_id: '00000000-0000-4000-8000-000000000099' }));
    expect(p.items).toHaveLength(10);
    expect(p.items.filter((i) => i.tier === 2)).toHaveLength(7);
    const first = p.items[0]; const row = await repo.getTestItem(first.id);
    const wrong = await testsRoutes['POST /next-item'](ctx({ test_id: p.test_id, last_answer: { item_id: first.id, answer: 'x', time_s: 9 } }));
    expect(wrong.last.retry).toBe(true); expect(wrong.last.hint).toBeTruthy();
    const retry = await testsRoutes['POST /next-item'](ctx({ test_id: p.test_id, last_answer: { item_id: first.id, answer: row.item.answer, time_s: 9 } }));
    expect(retry.last.correct).toBe(true); expect(retry.last.retry_used).toBe(true); expect(retry.item.id).not.toBe(first.id);
    const c = await testsRoutes['POST /generate-test'](ctx({ mode: 'confirm5', skill_id: '5.NBT.5' }));
    expect(c.items).toHaveLength(5); expect(c.items.filter((i) => i.tier === 3)).toHaveLength(3);
  });
});

describe('guards', () => {
  it('rejects unknown tests, foreign items, double answers', async () => {
    await expect(testsRoutes['POST /next-item'](ctx({ test_id: 'nope' }))).rejects.toThrow(/not found/);
    const t = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', skill_ids: ['5.OA.1'] }));
    const row = await repo.getTestItem(t.item.id);
    await testsRoutes['POST /next-item'](ctx({ test_id: t.test_id, last_answer: { item_id: t.item.id, answer: row.item.answer } }));
    await expect(testsRoutes['POST /next-item'](ctx({ test_id: t.test_id, last_answer: { item_id: t.item.id, answer: row.item.answer } }))).rejects.toThrow(/already answered/);
  });
  it('non-maths subjects need the item bank (503 until Phase 3 seeds it)', async () => {
    await expect(testsRoutes['POST /generate-test'](ctx({ subject: 'Reading', mode: 'diagnostic', skill_ids: ['RD.RL.1'] }))).rejects.toThrow(/No verified items/);
  });
});
