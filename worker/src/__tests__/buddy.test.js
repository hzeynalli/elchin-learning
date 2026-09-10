import { describe, it, expect, beforeEach } from 'vitest';
import { memoryRepo } from '../memory-repo.js';
import { buddyRoutes, APP_MANUAL } from '../buddy.js';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), 'utf8')).skills;
const skills = load('skills_math_ccss.json').map((s) => ({ ...s, active: true }));
const STUDENT = 's-1';
const profiles = [{ id: STUDENT, role: 'student', display_name: 'Elchin', settings: {} }];
const env = { MODEL_COACH: 'claude-fable-5-1' };
let repo;
const ctx = (body) => ({ env, repo, studentId: STUDENT, profile: profiles[0], body, now: new Date('2026-09-10T08:00:00Z') });
beforeEach(() => { repo = memoryRepo({ skills, profiles }); });

describe('Nala the buddy', () => {
  it('stores every turn in a coach session marked nala and keeps the session across turns', async () => {
    const a = await buddyRoutes['POST /buddy'](ctx({ message: 'Where is the map?', context: { screen: 'home' } }));
    expect(a.session_id).toBeTruthy(); expect(a.reply.length).toBeGreaterThan(0);
    const b = await buddyRoutes['POST /buddy'](ctx({ session_id: a.session_id, message: 'And how do I beat a boss?', context: { screen: 'quests', skill_id: '5.NBT.5' } }));
    expect(b.session_id).toBe(a.session_id);
    const s = await repo.getCoachSession(a.session_id);
    expect(s.representation).toBe('nala'); expect(s.outcome).toBe('buddy'); expect(s.messages).toHaveLength(4); expect(s.skill_id).toBe('5.NBT.5');
  });
  it('files a bug report for Dad when Elchin says something is broken', async () => {
    await buddyRoutes['POST /buddy'](ctx({ message: 'The timer is broken, it keeps going after I pressed Check', context: { screen: 'quest', stem: '6 × 7' } }));
    const notes = await buddyRoutes['GET /buddy/notes'](ctx());
    expect(notes.notes).toHaveLength(1); expect(notes.notes[0].screen).toBe('quest'); expect(notes.notes[0].summary).toMatch(/timer/i);
  });
  it('rejects an empty message and caps long ones', async () => {
    await expect(buddyRoutes['POST /buddy'](ctx({ message: '   ' }))).rejects.toThrow(/message required/);
    const r = await buddyRoutes['POST /buddy'](ctx({ message: 'x'.repeat(2000) }));
    const s = await repo.getCoachSession(r.session_id); expect(s.messages[0].content).toHaveLength(500);
  });
  it('the manual mentions every screen and the boss rules', () => { for (const w of ['HOME', 'QUESTS', 'MAP', 'BOSSES', 'SHOP', 'Dragon King', '25 points']) expect(APP_MANUAL).toContain(w); });
});
