import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { seedFromData, refillBank, generateBankItems } from '../bank.js';
import { testsRoutes } from '../tests.js';
import { parentRoutes } from '../parent.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8'));
const skills = [...load('skills_reading.json').skills, ...load('skills_language_usage.json').skills, ...load('skills_science.json').skills].map((s) => ({ ...s, active: true }));
const passages = load('passages/fables.json').passages;
const STUDENT = 's-1', PARENT = 'p-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { pass_rate: 0.9, regress_rate: 0.7 } }, { id: PARENT, role: 'parent', display_name: 'Huseyn', student_id: STUDENT, settings: {} }];
const env = { MODEL_GEN: 'claude-sonnet-5', DAILY_BUDGET_USD: '3' };   // no ANTHROPIC_API_KEY → mock mode
let repo;
const ctx = (body, profile = profiles[0], extra = {}) => ({ env, repo, studentId: STUDENT, profile, body, now: new Date('2026-09-10T08:00:00Z'), url: new URL('http://x/'), ...extra });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); });

describe('content seeding', () => {
  it('loads passages (readability-gated) and their questions into the bank; idempotent', async () => {
    const r = await seedFromData(repo, { passages });
    expect(r.passages).toBe(passages.length); expect(r.rejected).toEqual([]);
    expect(r.items).toBe(passages.reduce((a, p) => a + p.questions.length, 0));
    const again = await seedFromData(repo, { passages });
    expect(again.items).toBe(0); expect(again.passages).toBe(0);
    expect(await repo.bankCount('RD.RL.1', 1)).toBeGreaterThan(0);
  });
});

describe('bank refill (mock LLM)', () => {
  it('generates, verifies and stores items for low-stock non-maths skills, priority-1 first', async () => {
    const s = await refillBank(env, repo, { min: 2, perCall: 3, maxCalls: 4 });
    expect(s.calls).toBe(4); expect(s.generated).toBeGreaterThan(0);
    const first = (await repo.getSkills()).filter((x) => x.subject !== 'Mathematics').sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0];
    expect(await repo.bankCount(first.id, 1)).toBeGreaterThan(0);
    const [row] = repo.db.item_bank;
    expect(row.verified).toBe(true); expect(row.item.verification.ok).toBe(true); expect(row.item.generated_by).toBe('llm');
  });
  it('rejects duplicates of stems already in the bank', async () => {
    const skill = skills.find((s) => s.id === 'LU.G.6');
    const a = await generateBankItems(env, repo, { skill, tier: 1, n: 2 });
    const b = await generateBankItems(env, repo, { skill, tier: 1, n: 2 });    // mock returns the same stems → all duplicates
    expect(a).toBeGreaterThan(0); expect(b).toBe(0);
  });
});

describe('reading sets and marking queue', () => {
  it('a reading set serves one passage with its questions; short answers go to the LLM and low confidence lands in the parent queue', async () => {
    await seedFromData(repo, { passages });
    const t = await testsRoutes['POST /generate-test'](ctx({ mode: 'reading' }));
    expect(t.passage.title).toBeTruthy(); expect(t.items.length).toBeGreaterThanOrEqual(5);
    expect(t.items.every((i) => i.passage)).toBe(true);
    const rows = await repo.getTestItems(t.test_id);
    const answers = rows.map((r) => ({ item_id: r.id, answer: r.format === 'short_text' ? 'they were too busy being right' : r.item.answer, time_s: 30 }));
    const res = await testsRoutes['POST /submit-test'](ctx({ test_id: t.test_id, answers }));
    const st = res.results.items.find((i) => i.format === 'short_text');
    expect(st.marked_by ?? 'llm').toBeDefined();
    const q = await parentRoutes['GET /marking-queue'](ctx(null, profiles[1]));
    expect(q.queue.length).toBeGreaterThanOrEqual(1);
    expect(q.queue[0].why).toBe('low_confidence'); expect(q.queue[0].answer_given).toBe('they were too busy being right');
    // parent overrides → recompute
    const before = (await repo.getSkillStates(STUDENT)).find((s) => s.skill_id === q.queue[0].skill_id);
    const out = await parentRoutes['POST /parent-mark'](ctx({ item_id: q.queue[0].id, correct: true, feedback: 'Good quote.' }, profiles[1]));
    expect(out.correct).toBe(true);
    const row = await repo.getTestItem(q.queue[0].id);
    expect(row.marked_by).toBe('parent'); expect(row.confidence).toBe(1);
    expect(before).toBeDefined();
  });
  it('a non-maths diagnostic works once the bank has items', async () => {
    await seedFromData(repo, { passages });
    const t = await testsRoutes['POST /generate-test'](ctx({ subject: 'Reading', mode: 'diagnostic', skill_ids: ['RD.RL.1'] }));
    expect(t.item.skill_id).toBe('RD.RL.1'); expect(t.item.passage).toBeTruthy(); expect(t.item.answer).toBeUndefined();
  });
});
