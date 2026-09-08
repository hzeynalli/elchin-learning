import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { testsRoutes } from '../tests.js';
import { yearRoutes, learnAheadFor } from '../year.js';
import { exportRoutes, weeklyReport, toCSV } from '../export.js';
import { dashboard } from '../dashboard.js';
import { readFileSync } from 'node:fs';

// skills as the seed builder stores them: with planned_month (scope_sequence) and map_area
const J = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8'));
const scope = J('scope_sequence.json').months;
const plannedMonth = (id) => { for (const [m, ids] of Object.entries(scope)) for (const x of ids) { if (x === id || (x.endsWith('*') && id.startsWith(x.slice(0, -1)))) return m; } return null; };
const mapArea = (s) => (/Fraction|Number|Fluency/.test(s.strand) ? 'Number and Operations' : /Algebraic|practices/i.test(s.strand) ? 'Operations and Algebraic Thinking' : /Measurement/.test(s.strand) ? 'Measurement and Data' : 'Geometry');
const skills = J('skills_math_ccss.json').skills.map((s) => ({ ...s, active: true, planned_month: plannedMonth(s.id), map_area: mapArea(s), fluency: ['G4.OA.F', '5.FLU'].includes(s.id) }));
const STUDENT = 's-1', PARENT = 'p-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { pass_rate: 0.9, regress_rate: 0.7 } }, { id: PARENT, role: 'parent', display_name: 'Huseyn', student_id: STUDENT, settings: {} }];
const env = { MODEL_GEN: 'claude-sonnet-5', DUE_DATE: '2026-10-01' };
const T_SECURE = new Date('2026-09-10T08:00:00Z'), T0 = new Date('2026-09-20T08:00:00Z');
let repo;
const ctx = (body, profile = profiles[0], now = T0, extra = {}) => ({ env, repo, studentId: STUDENT, profile, body, now, url: new URL('http://x/?' + new URLSearchParams(extra)) });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); });

async function answerAll(testId, right = true, now = T0) {
  const rows = await repo.getTestItems(testId);
  return testsRoutes['POST /submit-test'](ctx({ test_id: testId, answers: rows.map((r) => ({ item_id: r.id, answer: right ? r.item.answer : 'nope', time_s: 20 })) }, profiles[0], now));
}
/** Secure a skill the real way: a passed practice set and a passed confirm set in the same loop (docs/02 §3). */
async function secureByEvidence(id, now = T_SECURE) {
  const loop = '00000000-0000-4000-8000-0000000000' + String(id.length).padStart(2, '0');
  const p = await testsRoutes['POST /generate-test'](ctx({ mode: 'practice10', skill_id: id, loop_id: loop }, profiles[0], now));
  await answerAll(p.test_id, true, now);
  const c = await testsRoutes['POST /generate-test'](ctx({ mode: 'confirm5', skill_id: id, loop_id: loop }, profiles[0], now));
  await answerAll(c.test_id, true, now);
  const st = (await repo.getSkillStates(STUDENT)).find((s) => s.skill_id === id);
  if (st.status !== 'secure') throw new Error(`${id} not secure after evidence: ${st.status}`);
  return st;
}
const stateOf = async (id) => (await repo.getSkillStates(STUDENT)).find((s) => s.skill_id === id);

describe('Phase 6 — retention wiring', () => {
  it('a passed review extends the next review and advances the chain; two passes → mastered', async () => {
    const before = await secureByEvidence('5.OA.1');
    expect(before.stability).toBe(2); expect(before.next_review_at).toBeTruthy();
    const t = await testsRoutes['POST /generate-test'](ctx({ mode: 'review', subject: 'Mathematics' }));
    expect(t.items.length).toBeGreaterThanOrEqual(3);
    const res = await answerAll(t.test_id, true);
    const after = await stateOf('5.OA.1');
    expect(new Date(after.next_review_at).getTime()).toBeGreaterThan(new Date(before.next_review_at).getTime());
    expect(after.stability).toBeGreaterThan(before.stability);
    expect(after.reviews_passed).toBe(1); expect(after.status).toBe('secure');
    expect(res.results.points).toBeGreaterThanOrEqual(5);                       // review-day bonus
    expect(res.results.scheduling.some((s) => s.skill_id === '5.OA.1' && s.kind === 'review' && s.passed)).toBe(true);
    const later = new Date(after.next_review_at);
    const t2 = await testsRoutes['POST /generate-test'](ctx({ mode: 'review', subject: 'Mathematics' }, profiles[0], later));
    await answerAll(t2.test_id, true, later);
    expect((await stateOf('5.OA.1')).status).toBe('mastered');
  });
  it('a failed review (70 %) drops the skill to emerging and clears the chain; 0 % goes to not_yet', async () => {
    const before = await secureByEvidence('5.NBT.5');
    const t = await testsRoutes['POST /generate-test'](ctx({ mode: 'review', subject: 'Mathematics' }));
    const rows = await repo.getTestItems(t.test_id);
    await testsRoutes['POST /submit-test'](ctx({ test_id: t.test_id, answers: rows.map((r, i) => ({ item_id: r.id, answer: i < 7 ? r.item.answer : 'nope', time_s: 20 })) }));
    const after = await stateOf('5.NBT.5');
    expect(before.status).toBe('secure');
    expect(after.status).toBe('emerging'); expect(after.next_review_at).toBeNull(); expect(after.reviews_passed).toBe(0);
    // a second skill: total failure → not_yet (docs/02 §3: last rate < 0.5)
    await secureByEvidence('5.NBT.2');
    const t2 = await testsRoutes['POST /generate-test'](ctx({ mode: 'review', subject: 'Mathematics' }, profiles[0], new Date('2026-09-21T08:00:00Z')));
    await answerAll(t2.test_id, false, new Date('2026-09-21T08:00:00Z'));
    expect((await stateOf('5.NBT.2')).status).toBe('not_yet');
  });
  it('implicit repetition: passing a skill gives half credit to its secure prerequisite', async () => {
    const before = await secureByEvidence('5.NBT.1');                            // prerequisite of 5.NBT.2
    const t = await testsRoutes['POST /generate-test'](ctx({ mode: 'practice10', skill_id: '5.NBT.2', loop_id: '00000000-0000-4000-8000-000000000077' }));
    const res = await answerAll(t.test_id, true);
    const after = await stateOf('5.NBT.1');
    expect(after.stability).toBeGreaterThan(before.stability);
    expect(after.review_stage).toBe(before.review_stage);                        // not a real review
    expect(res.results.scheduling.some((s) => s.kind === 'implicit' && s.skill_id === '5.NBT.1')).toBe(true);
  });
  it('learn-ahead proposes ≤ 2 next-month skills whose prerequisites are secure, only from the 15th', () => {
    const statusOf = { '5.NBT.5': 'secure', 'G4.NBT.4': 'secure' };
    expect(learnAheadFor(skills, statusOf, '2026-09-10T08:00:00Z')).toEqual([]);
    expect(learnAheadFor(skills, statusOf, '2026-09-20T08:00:00Z')).toEqual(['5.NBT.6']);   // planned 2026-10, prerequisites secure
    expect(learnAheadFor(skills, {}, '2026-09-20T08:00:00Z')).toEqual([]);
  });
  it('knowledge check: 20 blind items over mastered/secure skills, 5 in school style; failures drop the skill', async () => {
    for (const id of ['5.OA.1', '5.NBT.5', '5.NBT.2', '5.NBT.1']) await secureByEvidence(id);
    const kc = await yearRoutes['POST /knowledge-check'](ctx({}));
    expect(kc.items).toHaveLength(20); expect(kc.label).toBe('Memory game');
    const rows = await repo.getTestItems(kc.test_id);
    expect(rows.filter((r) => r.item.school_style).length).toBe(5);
    const res = await answerAll(kc.test_id, false);
    expect(['emerging', 'not_yet']).toContain((await stateOf('5.OA.1')).status);
    expect(res.results.regressed.length).toBeGreaterThan(0);
  });
  it('MAP mock: 40 items across the subject, results by instructional area', async () => {
    const m = await yearRoutes['POST /map-mock'](ctx({ subject: 'Mathematics' }));
    expect(m.items).toHaveLength(40);
    const res = await answerAll(m.test_id, true);
    expect(res.results.by_area.length).toBeGreaterThanOrEqual(3);
    expect(res.results.by_area.every((a) => a.rate === 1)).toBe(true);
  });
});

describe('Phase 5 — exports and KPIs', () => {
  it('weekly report and PDF', async () => {
    await secureByEvidence('5.OA.1', new Date('2026-09-18T08:00:00Z'));
    const rep = await weeklyReport({ repo, studentId: STUDENT, now: T0 });
    expect(rep.bySubject.Mathematics.secure).toBe(1);
    expect(rep.secured).toContain(skills.find((s) => s.id === '5.OA.1').name);   // skill_secure event logged by recompute
    const res = await exportRoutes['GET /export/weekly.pdf'](ctx(null, profiles[1]));
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000); expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF');
  });
  it('CSV export escapes and includes rows', async () => {
    await repo.addPoints({ student_id: STUDENT, delta: 3, reason: 'test, with "quotes"' });
    const res = await exportRoutes['GET /export/csv'](ctx(null, profiles[1], T0, { table: 'points' }));
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('delta');
    expect(text).toContain('"test, with ""quotes"""');
    expect(toCSV([])).toBe('');
  });
  it('dashboard carries retention rate and learn-ahead', async () => {
    const d = await dashboard({ repo, profile: profiles[1], studentId: STUDENT, env, now: T0 });
    expect(d.metrics).toHaveProperty('retention_rate');
    expect(Array.isArray(d.today.learn_ahead)).toBe(true);
  });
});
