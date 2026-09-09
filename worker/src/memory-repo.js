// In-memory implementation of the repo interface (src/repo.js) for unit tests of the handlers. No Supabase needed.
let seq = 1;
const uuid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;
const clone = (x) => JSON.parse(JSON.stringify(x));

export function memoryRepo({ skills = [], profiles = [] } = {}) {
  const db = { profiles: clone(profiles), skills: clone(skills), skill_state: [], tests: [], test_items: [], coach_sessions: [], item_bank: [], points: [], rewards: [], telemetry: [], events: [], map_results: [], passages: [], explanations: [], llm_usage: [] };
  const byId = (t, id) => db[t].find((r) => r.id === id) || null;
  const patch = (t, id, p) => { const r = byId(t, id); if (!r) throw new Error(`${t} ${id} not found`); Object.assign(r, p); return clone(r); };
  return {
    db, mode: 'memory',
    getProfile: async (id) => clone(byId('profiles', id)),
    updateProfile: async (id, p) => patch('profiles', id, p),
    getSkills: async () => clone(db.skills.filter((s) => s.active !== false)),
    getSkillStates: async (sid) => clone(db.skill_state.filter((s) => s.student_id === sid)),
    upsertSkillState: async (row) => { const i = db.skill_state.findIndex((s) => s.student_id === row.student_id && s.skill_id === row.skill_id); if (i >= 0) Object.assign(db.skill_state[i], row); else db.skill_state.push({ ...row }); return clone(row); },
    getTests: async (sid, { limit = 50, kind = null, status = null } = {}) => clone(db.tests.filter((t) => t.student_id === sid && (!kind || t.kind === kind) && (!status || t.status === status)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit)),
    getTest: async (id) => clone(byId('tests', id)),
    insertTest: async (row) => { const r = { id: uuid(), created_at: new Date().toISOString(), status: 'open', ...row }; db.tests.push(r); return clone(r); },
    updateTest: async (id, p) => patch('tests', id, p),
    getTestItems: async (testId) => clone(db.test_items.filter((i) => i.test_id === testId).sort((a, b) => a.position - b.position)),
    getTestItem: async (id) => clone(byId('test_items', id)),
    insertTestItems: async (rows) => { const out = rows.map((r) => ({ id: uuid(), retry_used: false, ...r })); db.test_items.push(...out); return clone(out); },
    updateTestItem: async (id, p) => patch('test_items', id, p),
    getSkillEvidence: async (sid, skillId) => clone(db.test_items.filter((i) => i.student_id === sid && i.skill_id === skillId && i.correct != null).sort((a, b) => (a.answered_at < b.answered_at ? -1 : 1)).map((i) => { const t = byId('tests', i.test_id); return { ...i, tests: { kind: t.kind, loop_id: t.loop_id ?? null, status: t.status, submitted_at: t.submitted_at } }; })),
    getAnsweredSince: async (sid, since) => clone(db.test_items.filter((i) => i.student_id === sid && i.answered_at && i.answered_at >= since)),
    recentStemHashes: async (skillId, n = 300) => db.test_items.filter((i) => i.skill_id === skillId).map((i) => i.stem_hash).slice(-n),
    markingQueue: async (sid) => clone(db.test_items.filter((i) => i.student_id === sid && i.marked_by === 'llm' && i.confidence != null && i.confidence < 0.8)),
    getCoachSessions: async (sid, { limit = 30 } = {}) => clone(db.coach_sessions.filter((s) => s.student_id === sid).sort((a, b) => (a.started_at < b.started_at ? 1 : -1)).slice(0, limit)),
    getCoachSession: async (id) => clone(byId('coach_sessions', id)),
    insertCoachSession: async (row) => { const r = { id: uuid(), started_at: new Date().toISOString(), loop_state: 'EXPLAIN', cycle_number: 1, messages: [], off_topic_hits: 0, active_s: 0, ...row }; db.coach_sessions.push(r); return clone(r); },
    updateCoachSession: async (id, p) => patch('coach_sessions', id, p),
    bankCount: async (skillId, tier) => db.item_bank.filter((b) => b.skill_id === skillId && b.tier === tier && !b.used && b.verified).length,
    bankTake: async (skillId, tier, n = 1) => { const rows = db.item_bank.filter((b) => b.skill_id === skillId && b.tier === tier && !b.used && b.verified).slice(0, n); rows.forEach((r) => (r.used = true)); return clone(rows); },
    bankInsert: async (rows) => { const out = rows.map((r) => ({ id: uuid(), verified: false, used: false, created_at: new Date().toISOString(), ...r })); db.item_bank.push(...out); return out.map((r) => ({ id: r.id })); },
    bankStems: async (skillId) => db.item_bank.filter((b) => b.skill_id === skillId).map((b) => b.stem_hash),
    bankStemsAll: async () => { const m = new Map(); for (const b of db.item_bank) (m.get(b.skill_id) || m.set(b.skill_id, new Set()).get(b.skill_id)).add(b.stem_hash); return m; },
    bankStock: async () => { const m = {}; for (const b of db.item_bank) if (!b.used && b.verified) m[`${b.skill_id}|${b.tier}`] = (m[`${b.skill_id}|${b.tier}`] || 0) + 1; return m; },
    bankLowStock: async () => [],
    getPoints: async (sid) => clone(db.points.filter((p) => p.student_id === sid)),
    addPoints: async (row) => { const r = { id: seq++, at: new Date().toISOString(), ...row }; db.points.push(r); return clone(r); },
    getRewards: async (sid) => clone(db.rewards.filter((r) => r.student_id === sid).sort((a, b) => a.cost - b.cost)),
    insertReward: async (row) => { const r = { id: seq++, redeemed_at: null, ...row }; db.rewards.push(r); return clone(r); },
    updateReward: async (id, p) => patch('rewards', id, p),
    deleteReward: async (id) => { db.rewards = db.rewards.filter((r) => r.id !== id); return null; },
    insertTelemetry: async (rows) => { db.telemetry.push(...rows.map((r) => ({ id: seq++, ...r }))); return null; },
    getTelemetry: async (sid, since) => clone(db.telemetry.filter((t) => t.student_id === sid && t.at >= since)),
    insertEvent: async (row) => { db.events.push({ id: seq++, at: new Date().toISOString(), ...row }); return null; },
    getEvents: async (sid, since, kind = null) => clone(db.events.filter((e) => e.student_id === sid && e.at >= since && (!kind || e.kind === kind))),
    getMapResults: async (sid) => clone(db.map_results.filter((m) => m.student_id === sid)),
    insertMapResult: async (row) => { const r = { id: seq++, ...row }; db.map_results.push(r); return clone(r); },
    getPassages: async () => clone(db.passages),
    getPassage: async (id) => clone(byId('passages', id)),
    insertPassages: async (rows) => { const out = rows.map((r) => ({ id: uuid(), used_count: 0, ...r })); db.passages.push(...out); return out.map((r) => ({ id: r.id })); },
    updatePassage: async (id, p) => patch('passages', id, p),
    getExplanation: async (skillId) => clone(db.explanations.find((e) => e.skill_id === skillId) || null),
    upsertExplanation: async (row) => { const i = db.explanations.findIndex((e) => e.skill_id === row.skill_id); if (i >= 0) Object.assign(db.explanations[i], row); else db.explanations.push({ ...row }); return null; },
    usageToday: async () => db.llm_usage.reduce((a, r) => a + Number(r.usd || 0), 0),
    recordUsage: async (row) => { db.llm_usage.push({ id: seq++, day: new Date().toISOString().slice(0, 10), ...row }); return null; },
    usageByDay: async () => clone(db.llm_usage),
  };
}
