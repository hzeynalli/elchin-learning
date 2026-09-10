import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { testsRoutes } from '../tests.js';
import { rewardsRoutes } from '../rewards.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8')).skills;
const skills = load('skills_math_ccss.json').map((s) => ({ ...s, fluency: false, active: true }));
const STUDENT = 's-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { pass_rate: 0.9, regress_rate: 0.7 } }];
const env = { MODEL_GEN: 'claude-sonnet-5' };
let repo, student;
const ctx = (body, extra = {}) => ({ env, repo, studentId: STUDENT, profile: student, body, now: new Date('2026-09-10T08:00:00Z'), url: new URL('http://x/?' + new URLSearchParams(extra)), ...extra });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); student = profiles[0]; });
async function answerOf(item) { const row = await repo.getTestItem(item.id); return row.item.answer; }
async function play(testId, first, rightFor) {
  let step = first, n = 0;
  while (step.item && n < 50) { const ok = rightFor(n); step = await testsRoutes['POST /next-item'](ctx({ test_id: testId, last_answer: { item_id: step.item.id, answer: ok ? await answerOf(step.item) : 'nope-0', time_s: 9 } })); n++; }
  return step;
}
const balance = async () => (await repo.getPoints(STUDENT)).reduce((a, p) => a + p.delta, 0);

describe('boss rounds (10 Sep)', () => {
  it('a boss is 5 mixed-tier items on one skill; 5 hits finalise with the +25 bonus', async () => {
    const b = await testsRoutes['POST /generate-test'](ctx({ mode: 'boss', skill_id: '5.NBT.5', parent_test_id: 'quest-1' }));
    expect(b.items).toHaveLength(5); expect(b.items.every((i) => i.skill_id === '5.NBT.5')).toBe(true);
    expect(b.items.map((i) => i.tier).sort()).toEqual([1, 2, 2, 3, 3]);
    const end = await play(b.test_id, { item: b.items[0] }, () => true);
    expect(end.test_complete).toBe(true);
    expect(end.results.correct).toBe(5);
    expect(end.results.points).toBeGreaterThanOrEqual(25 + 5);
    expect((await repo.getPoints(STUDENT)).some((p) => p.reason === 'boss defeated' && p.delta === 25)).toBe(true);
  });
  it('a boss that only blocks earns no bonus; /boss/finish closes an unfinished round without one', async () => {
    const b = await testsRoutes['POST /generate-test'](ctx({ mode: 'boss', skill_id: '5.NBT.5' }));
    let step = { item: b.items[0] };
    for (let i = 0; i < 2; i++) step = await testsRoutes['POST /next-item'](ctx({ test_id: b.test_id, last_answer: { item_id: step.item.id, answer: await answerOf(step.item), time_s: 9 } }));
    const fin = await testsRoutes['POST /boss/finish'](ctx({ test_id: b.test_id }));
    expect(fin.results.correct).toBe(2); expect(fin.results.total).toBe(2);
    expect((await repo.getPoints(STUDENT)).some((p) => p.reason === 'boss defeated')).toBe(false);
    const again = await testsRoutes['POST /boss/finish'](ctx({ test_id: b.test_id }));
    expect(again.already).toBe(true);
  });
  it('the big boss mixes every boss skill, 5–10 items, and pays +50', async () => {
    const bb = await testsRoutes['POST /generate-test'](ctx({ mode: 'big_boss', skill_ids: ['5.NBT.5', '5.OA.1', 'BOGUS'] }));
    expect(bb.items.length).toBe(7);
    expect(new Set(bb.items.map((i) => i.skill_id))).toEqual(new Set(['5.NBT.5', '5.OA.1']));
    const end = await play(bb.test_id, { item: bb.items[0] }, () => true);
    expect(end.test_complete).toBe(true);
    expect((await repo.getPoints(STUDENT)).some((p) => p.reason === 'big boss defeated' && p.delta === 50)).toBe(true);
    student.settings.boss_points = { big: 80 };
    const bb2 = await testsRoutes['POST /generate-test'](ctx({ mode: 'big_boss', skill_ids: ['5.NBT.5'], count: 5 }));
    await play(bb2.test_id, { item: bb2.items[0] }, () => true);
    expect((await repo.getPoints(STUDENT)).some((p) => p.delta === 80)).toBe(true);
  });
  it('shop: skip costs points and voids the item; refused in the Big quest and when broke', async () => {
    await repo.addPoints({ student_id: STUDENT, delta: 30, reason: 'seed' });
    const t = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'targeted' }));
    const shop = await rewardsRoutes['POST /shop'](ctx({ item: 'skip' }));
    expect(shop.cost).toBe(20); expect(shop.balance).toBe(10);
    const sk = await testsRoutes['POST /skip-item'](ctx({ test_id: t.test_id, item_id: t.items[0].id }));
    expect(sk.item.id).toBe(t.items[1].id);
    const next = await testsRoutes['POST /next-item'](ctx({ test_id: t.test_id }));
    expect(next.item.id).toBe(t.items[1].id);                       // the skipped item is never served again
    await expect(rewardsRoutes['POST /shop'](ctx({ item: 'skip' }))).rejects.toThrow(/Not enough points/);
    student.settings.shop_prices = { time: 0 };
    expect((await rewardsRoutes['POST /shop'](ctx({ item: 'time' }))).balance).toBe(10);
    const d = await testsRoutes['POST /generate-test'](ctx({ subject: 'Mathematics', mode: 'diagnostic', skill_ids: ['5.NBT.5'] }));
    await expect(testsRoutes['POST /skip-item'](ctx({ test_id: d.test_id, item_id: d.item.id }))).rejects.toThrow(/cannot be skipped/);
  });
  it('helper returns the canonical explanation for a skill', async () => {
    const h = await testsRoutes['GET /helper'](ctx(null, { url: new URL('http://x/helper?skill_id=5.NBT.1') }));
    expect(h.name).toMatch(/Place-value/); expect(h.text).toMatch(/small steps/);
  });
});
