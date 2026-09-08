import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { manualEntry, manualTemplate } from '../manual.js';
import { dashboard } from '../dashboard.js';
import { rewardsRoutes } from '../rewards.js';
import { settingsRoutes } from '../settings.js';
import { evidenceFromItems } from '../recompute.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8')).skills;
const skills = [...load('skills_math_ccss.json'), ...load('skills_reading.json'), ...load('skills_language_usage.json'), ...load('skills_science.json')].map((s) => ({ ...s, fluency: ['G4.OA.F', '5.FLU'].includes(s.id), active: true }));
const STUDENT = 's-1', PARENT = 'p-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: { daily_minutes: 50, pass_rate: 0.9, regress_rate: 0.7 } }, { id: PARENT, role: 'parent', display_name: 'Huseyn', student_id: STUDENT, settings: {} }];
const env = { DUE_DATE: '2026-10-01' };
let repo, parent;
beforeEach(() => { repo = memoryRepo({ skills, profiles }); parent = profiles[1]; });

describe('manual entry of Diagnostic 1', () => {
  it('template lists the 29 paper questions mapped to canonical skills', () => {
    const t = manualTemplate();
    expect(t.questions).toHaveLength(29);
    expect(t.questions.find((q) => q.q === 22)).toMatchObject({ qsi: 'E02.5', skill_id: '5.NBT.5', tier: 3 });
  });
  it('writes a manual test, items on canonical skills, and recomputes states', async () => {
    const marks = {}; for (let q = 1; q <= 29; q++) marks[q] = true;
    marks[26] = false; marks[27] = false;                 // 5.OA.1: 1/3 → not_yet
    marks[14] = false;                                    // 5.NBT.RW: 2/3 → emerging
    const r = await manualEntry({ repo, studentId: STUDENT, profile: parent, body: { source: 'diagnostic_1', marks, minutes: 38, q4_seconds: 16 }, now: new Date('2026-09-09T10:00:00Z') });
    expect(r.total).toBe(34); expect(r.score).toBe(31);   // 29 questions, the timed row stored as 6 facts
    const st = Object.fromEntries((await repo.getSkillStates(STUDENT)).map((s) => [s.skill_id, s]));
    expect(st['5.OA.1'].status).toBe('not_yet');
    expect(st['5.NBT.RW'].status).toBe('emerging');
    expect(st['5.NBT.2'].status).toBe('emerging');        // 3/3 but a single test → emerging (needs confirmation)
    expect(st['G4.OA.F'].fast).toBe(true);                // 16 s / 6 facts ≈ 2.7 s ≤ 3 s
    expect(st['G4.OA.F'].status).toBe('emerging');
    expect(st['G4.NBT.1']).toMatchObject({ status: 'not_yet', attempts: 0 });   // 2 items → not a qualifying test
    const slow = memoryRepo({ skills, profiles });
    await manualEntry({ repo: slow, studentId: STUDENT, profile: parent, body: { source: 'diagnostic_1', marks, q4_seconds: 30 } });
    expect((await slow.getSkillStates(STUDENT)).find((s) => s.skill_id === 'G4.OA.F').fast).toBe(false);
  });
  it('one-item skills stay not_yet (no qualifying evidence)', async () => {
    const marks = {}; for (let q = 1; q <= 29; q++) marks[q] = true;
    await manualEntry({ repo, studentId: STUDENT, profile: parent, body: { source: 'diagnostic_1', marks } });
    const st = Object.fromEntries((await repo.getSkillStates(STUDENT)).map((s) => [s.skill_id, s]));
    expect(st['5.NBT.5'].status).toBe('not_yet'); expect(st['5.NBT.5'].attempts).toBe(0);
  });
});

describe('evidence from items', () => {
  it('practice retry counts 0.5, confirm retry counts 0, partial marks count', () => {
    const items = [
      { test_id: 't1', tier: 2, correct: true, retry_used: true, tests: { kind: 'practice10' }, answered_at: '2026-09-01T00:00:00Z' },
      { test_id: 't1', tier: 2, correct: true, retry_used: false, tests: { kind: 'practice10' }, answered_at: '2026-09-01T00:00:01Z' },
      { test_id: 't2', tier: 3, correct: true, retry_used: true, tests: { kind: 'confirm5' }, answered_at: '2026-09-02T00:00:00Z' },
      { test_id: 't2', tier: 2, correct: false, partial: 0.5, tests: { kind: 'confirm5' }, answered_at: '2026-09-02T00:00:01Z' },
    ];
    const ev = evidenceFromItems(items);
    expect(ev[0]).toMatchObject({ kind: 'practice10', items: 2, correct: 1.5 });
    expect(ev[1]).toMatchObject({ kind: 'confirm5', items: 2, correct: 0.5, tier3_correct: false });
  });
});

describe('dashboard', () => {
  it('returns headline metrics, grouped skills, urgency and QSI rollup', async () => {
    const d = await dashboard({ repo, profile: parent, studentId: STUDENT, env, now: new Date('2026-09-09T10:00:00Z') });
    expect(d.metrics.p1_total).toBe(35); expect(d.metrics.days_to_due).toBe(22);
    expect(d.skills).toHaveLength(102);
    expect(d.urgency[0].priority).toBe(1);
    expect(d.qsi_units.map((u) => u.id)).toContain('MATH-E02');
    expect(d.marking_queue_count).toBe(0);
  });
});

describe('rewards and settings', () => {
  it('parent defines a reward; student redeems only with enough points', async () => {
    await rewardsRoutes['POST /rewards']({ repo, studentId: STUDENT, body: { name: 'Cinema', cost: 30 } });
    const [r] = await repo.getRewards(STUDENT);
    await expect(rewardsRoutes['POST /rewards/redeem']({ repo, studentId: STUDENT, body: { id: r.id }, now: new Date() })).rejects.toThrow(/not enough/);
    await rewardsRoutes['POST /points']({ repo, studentId: STUDENT, body: { delta: 40, reason: 'paper diagnostic' } });
    const out = await rewardsRoutes['POST /rewards/redeem']({ repo, studentId: STUDENT, body: { id: r.id }, now: new Date() });
    expect(out.balance).toBe(10);
  });
  it('mastery thresholds are read-only', async () => {
    await expect(settingsRoutes['POST /settings']({ repo, studentId: STUDENT, body: { pass_rate: 0.5 } })).rejects.toThrow(/read-only/);
    const s = await settingsRoutes['POST /settings']({ repo, studentId: STUDENT, body: { daily_minutes: 45 } });
    expect(s.settings.daily_minutes).toBe(45); expect(s.settings.pass_rate).toBe(0.9);
  });
  it('MAP results update the profile RIT', async () => {
    await settingsRoutes['POST /map-results']({ repo, studentId: STUDENT, body: { term: 'Fall 2026', subject: 'Mathematics', rit: 208 } });
    expect((await repo.getProfile(STUDENT)).map_rit_math).toBe(208);
  });
});
