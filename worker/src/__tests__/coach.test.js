import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { coachRoutes, REPRESENTATIONS } from '../coach.js';
import { testsRoutes } from '../tests.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8')).skills;
const skills = load('skills_math_ccss.json').map((s) => ({ ...s, active: true }));
const STUDENT = 's-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { pass_rate: 0.9, regress_rate: 0.7, tier3_slip_replacement: true } }];
const env = { MODEL_COACH: 'claude-fable-5-1', MODEL_GEN: 'claude-sonnet-5', MODEL_GUARD: 'claude-haiku-4-5-20251001' };
let repo;
const T0 = new Date('2026-09-10T08:00:00Z');
const ctx = (body, now = T0) => ({ env, repo, studentId: STUDENT, profile: profiles[0], body, now, url: new URL('http://x/') });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); });

describe('coach state machine (docs/02 §2)', () => {
  it('starts a session on a skill with the first representation and stores every turn', async () => {
    const r = await coachRoutes['POST /coach'](ctx({ skill_id: '5.NBT.5', event: { type: 'start' } }));
    expect(r.session_id).toBeTruthy(); expect(r.loop_state).toBe('EXPLAIN'); expect(r.cycle_number).toBe(1); expect(r.representation).toBe(REPRESENTATIONS[0]);
    expect(r.reply).toMatch(/first step|already know/i);
    const s = await repo.getCoachSession(r.session_id);
    expect(s.messages).toHaveLength(2); expect(s.messages[0].role).toBe('user'); expect(s.messages[1].role).toBe('assistant');
  });
  it('[READY_FOR_PRACTICE] moves to PRACTICE_10; practice pass → CONFIRM_5; confirm pass → SECURE (+10 points)', async () => {
    const s = await coachRoutes['POST /coach'](ctx({ skill_id: '5.NBT.5', event: { type: 'start' } }));
    const r1 = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, message: 'I think the first step is 12 times 5' }));
    expect(r1.loop_state).toBe('PRACTICE_10'); expect(r1.next_action).toBe('start_practice'); expect(r1.reply).not.toMatch(/\[READY_FOR_PRACTICE\]/);
    const r2 = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, event: { type: 'practice_done', correct: 9, items: 10, rate: 0.9, passed: true } }));
    expect(r2.loop_state).toBe('CONFIRM_5'); expect(r2.next_action).toBe('start_confirm');
    const r3 = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, event: { type: 'confirm_done', correct: 5, items: 5, passed: true } }));
    expect(r3.loop_state).toBe('SECURE'); expect(r3.outcome).toBe('secure'); expect(r3.points).toBe(10);
    expect((await repo.getPoints(STUDENT)).reduce((a, p) => a + p.delta, 0)).toBe(10);
  });
  it('a failed practice re-explains with a NEW representation; after 3 cycles it suggests a break and flags the parent', async () => {
    const s = await coachRoutes['POST /coach'](ctx({ skill_id: '5.OA.1', event: { type: 'start' } }));
    let r;
    for (let i = 0; i < 3; i++) r = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, event: { type: 'practice_done', correct: 6, items: 10, rate: 0.6, passed: false } }));
    expect(r.cycle_number).toBe(4); expect(r.next_action).toBe('suggest_break'); expect(r.flag_note).toMatch(/cycles/);
    const reps = new Set((await repo.getSkillStates(STUDENT)).find((x) => x.skill_id === '5.OA.1').representation_used);
    expect(reps.size).toBeGreaterThanOrEqual(3);
    expect((await repo.getEvents(STUDENT, '2000-01-01', 'flag_parent')).length).toBe(1);
  });
  it('a failed confirm re-explains; a single tier-3 slip offers a replacement item', async () => {
    const s = await coachRoutes['POST /coach'](ctx({ skill_id: '5.NBT.5', event: { type: 'start' } }));
    const r = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, event: { type: 'confirm_done', correct: 4, items: 5, passed: false, replacement: true } }));
    expect(r.next_action).toBe('replacement'); expect(r.loop_state).toBe('CONFIRM_5');
    // build a real confirm test with exactly one tier-3 miss
    const c = await testsRoutes['POST /generate-test'](ctx({ mode: 'confirm5', skill_id: '5.NBT.5', loop_id: s.session_id }));
    const rows = await repo.getTestItems(c.test_id);
    const t3 = rows.find((x) => x.tier === 3);
    const answers = rows.map((x) => ({ item_id: x.id, answer: x.id === t3.id ? 'wrong' : x.item.answer, time_s: 20 }));
    await testsRoutes['POST /submit-test'](ctx({ test_id: c.test_id, answers }));
    const rep = await coachRoutes['POST /coach/replacement'](ctx({ session_id: s.session_id, test_id: c.test_id }));
    expect(rep.replacement).toBe(true); expect(rep.item.tier).toBe(3); expect(rep.item.answer).toBeUndefined();
    const voided = await repo.getTestItem(t3.id); expect(voided.correct).toBeNull(); expect(voided.item.voided).toBe(true);
    // answer the replacement correctly → the confirm test finalises with 5/5 counted
    const newRow = (await repo.getTestItems(c.test_id)).find((x) => x.correct == null && !x.item.voided);
    const done = await testsRoutes['POST /next-item'](ctx({ test_id: c.test_id, last_answer: { item_id: newRow.id, answer: newRow.item.answer, time_s: 30 } }));
    expect(done.test_complete).toBe(true); expect(done.results.correct).toBe(5); expect(done.results.total).toBe(5);
  });
  it('guards: message length, block time, daily cap, ended sessions', async () => {
    const s = await coachRoutes['POST /coach'](ctx({ skill_id: '5.NBT.5', event: { type: 'start' } }));
    await expect(coachRoutes['POST /coach'](ctx({ session_id: s.session_id, message: 'x'.repeat(401) }))).rejects.toThrow(/400 characters/);
    const later = new Date(T0.getTime() + 31 * 60000);
    const r = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, message: 'ok' }, later));
    expect(r.next_action).toBe('suggest_break');
    const end = await coachRoutes['POST /coach'](ctx({ session_id: s.session_id, event: { type: 'end' } }, later));
    expect(end.ended).toBe(true); expect(end.parent_summary).toBeTruthy();
    await expect(coachRoutes['POST /coach'](ctx({ session_id: s.session_id, message: 'more' }))).rejects.toThrow(/ended/);
    // daily cap: 60 min of coach time today → refuse a new session
    await repo.updateCoachSession(s.session_id, { active_s: 61 * 60 });
    await expect(coachRoutes['POST /coach'](ctx({ skill_id: '5.OA.1', event: { type: 'start' } }, later))).rejects.toThrow(/used up/);
  });
  it('streams deltas and ends with the turn metadata', async () => {
    const s = await coachRoutes['POST /coach'](ctx({ skill_id: '5.NBT.5', event: { type: 'start' } }));
    const res = await coachRoutes['POST /coach/stream'](ctx({ session_id: s.session_id, message: '12' }));
    const text = await res.text();
    const events = text.split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')));
    expect(events.filter((e) => e.delta).length).toBeGreaterThan(2);
    const last = events[events.length - 1];
    expect(last.done).toBe(true); expect(last.meta.next_action).toBe('start_practice'); expect(last.meta.session_id).toBe(s.session_id);
  });
});
