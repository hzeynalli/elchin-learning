// Data access. Two Supabase clients:
//  - admin (service key): all writes and cross-user reads (item_bank, llm_usage). Bypasses RLS.
//  - user (anon key + the caller's JWT): reads on behalf of the user, RLS-scoped. Least privilege, and it lets the
//    read-only endpoints run locally before the service key is configured (repo.mode === 'user-rls').
// Every handler talks to this interface only; src/memory-repo.js implements the same interface for unit tests.
import { createClient } from '@supabase/supabase-js';

const opts = (jwt) => ({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(jwt ? { global: { headers: { Authorization: `Bearer ${jwt}` } } } : {}) });
export const todayIn = (tz = 'Asia/Baku', d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export function makeRepo(env, userJwt) {
  const url = env.SUPABASE_URL;
  const admin = env.SUPABASE_SERVICE_KEY ? createClient(url, env.SUPABASE_SERVICE_KEY, opts()) : null;
  const user = userJwt ? createClient(url, env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY, opts(userJwt)) : null;
  const rw = admin, ro = user || admin;
  const need = (what) => { if (!rw) throw Object.assign(new Error(`${what} needs SUPABASE_SERVICE_KEY on the Worker`), { status: 503 }); return rw; };
  const one = async (q) => { const { data, error } = await q; if (error) throw Object.assign(new Error(error.message), { status: 500, detail: error }); return data; };
  const tz = env.TIMEZONE || 'Asia/Baku';

  return {
    mode: admin ? 'service' : 'user-rls',
    // ---- profiles / settings
    getProfile: (id) => one(ro.from('profiles').select('*').eq('id', id).maybeSingle()),
    updateProfile: (id, patch) => one(need('updateProfile').from('profiles').update(patch).eq('id', id).select().single()),
    // ---- skills & state
    getSkills: () => one(ro.from('skills').select('*').eq('active', true).order('id')),
    getSkillStates: (sid) => one(ro.from('skill_state').select('*').eq('student_id', sid)),
    upsertSkillState: (row) => one(need('upsertSkillState').from('skill_state').upsert(row, { onConflict: 'student_id,skill_id' }).select().single()),
    // ---- tests & items
    getTests: (sid, { limit = 50, kind = null, status = null } = {}) => { let q = ro.from('tests').select('*').eq('student_id', sid).order('created_at', { ascending: false }).limit(limit); if (kind) q = q.eq('kind', kind); if (status) q = q.eq('status', status); return one(q); },
    getTest: (id) => one(ro.from('tests').select('*').eq('id', id).maybeSingle()),
    insertTest: (row) => one(need('insertTest').from('tests').insert(row).select().single()),
    updateTest: (id, patch) => one(need('updateTest').from('tests').update(patch).eq('id', id).select().single()),
    getTestItems: (testId) => one(ro.from('test_items').select('*').eq('test_id', testId).order('position')),
    getTestItem: (id) => one(ro.from('test_items').select('*').eq('id', id).maybeSingle()),
    insertTestItems: (rows) => one(need('insertTestItems').from('test_items').insert(rows).select()),
    updateTestItem: (id, patch) => one(need('updateTestItem').from('test_items').update(patch).eq('id', id).select().single()),
    /** answered items for one student+skill with their test's kind/loop — the evidence for mastery.js */
    getSkillEvidence: (sid, skillId) => one(ro.from('test_items').select('test_id, tier, correct, partial, retry_used, time_s, answered_at, tests!inner(kind, loop_id, status, submitted_at)').eq('student_id', sid).eq('skill_id', skillId).not('correct', 'is', null).order('answered_at')),
    getAnsweredSince: (sid, sinceIso) => one(ro.from('test_items').select('id, skill_id, tier, correct, time_s, answered_at, marked_by, confidence').eq('student_id', sid).gte('answered_at', sinceIso)),
    recentStemHashes: async (skillId, n = 300) => (await one(ro.from('test_items').select('stem_hash').eq('skill_id', skillId).order('answered_at', { ascending: false, nullsFirst: false }).limit(n))).map((r) => r.stem_hash),
    markingQueue: (sid) => one(ro.from('test_items').select('id, test_id, skill_id, tier, format, item, answer_given, correct, partial, confidence, feedback, marked_by, answered_at').eq('student_id', sid).eq('marked_by', 'llm').lt('confidence', 0.8).order('answered_at', { ascending: false }).limit(100)),
    // ---- coach
    getCoachSessions: (sid, { limit = 30 } = {}) => one(ro.from('coach_sessions').select('*').eq('student_id', sid).order('started_at', { ascending: false }).limit(limit)),
    getCoachSession: (id) => one(ro.from('coach_sessions').select('*').eq('id', id).maybeSingle()),
    insertCoachSession: (row) => one(need('insertCoachSession').from('coach_sessions').insert(row).select().single()),
    updateCoachSession: (id, patch) => one(need('updateCoachSession').from('coach_sessions').update(patch).eq('id', id).select().single()),
    // ---- item bank (admin only: invisible to clients)
    bankCount: async (skillId, tier) => { const { count, error } = await need('bank').from('item_bank').select('id', { count: 'exact', head: true }).eq('skill_id', skillId).eq('tier', tier).eq('used', false).eq('verified', true); if (error) throw new Error(error.message); return count || 0; },
    bankTake: async (skillId, tier, n = 1) => {
      const rows = await one(need('bank').from('item_bank').select('*').eq('skill_id', skillId).eq('tier', tier).eq('used', false).eq('verified', true).order('created_at').limit(n));
      if (rows.length) await one(rw.from('item_bank').update({ used: true }).in('id', rows.map((r) => r.id)));
      return rows;
    },
    bankInsert: (rows) => one(need('bank').from('item_bank').insert(rows).select('id')),
    bankStems: async (skillId) => (await one(need('bank').from('item_bank').select('stem_hash').eq('skill_id', skillId))).map((r) => r.stem_hash),
    // one round-trip each (the free Cloudflare plan allows 50 subrequests per invocation — never loop these per skill)
    bankStemsAll: async () => { const m = new Map(); for (const r of await one(need('bank').from('item_bank').select('skill_id,stem_hash').limit(20000))) (m.get(r.skill_id) || m.set(r.skill_id, new Set()).get(r.skill_id)).add(r.stem_hash); return m; },
    bankStock: async () => { const m = {}; for (const r of await one(need('bank').from('item_bank').select('skill_id,tier').eq('used', false).eq('verified', true).limit(20000))) m[`${r.skill_id}|${r.tier}`] = (m[`${r.skill_id}|${r.tier}`] || 0) + 1; return m; },
    bankLowStock: async (min = 10) => one(need('bank').rpc('bank_low_stock', { min_count: min })).catch(() => []),
    // ---- points & rewards
    getPoints: (sid) => one(ro.from('points').select('*').eq('student_id', sid).order('at', { ascending: false }).limit(200)),
    addPoints: (row) => one(need('addPoints').from('points').insert(row).select().single()),
    getRewards: (sid) => one(ro.from('rewards').select('*').eq('student_id', sid).order('cost')),
    insertReward: (row) => one(need('insertReward').from('rewards').insert(row).select().single()),
    updateReward: (id, patch) => one(need('updateReward').from('rewards').update(patch).eq('id', id).select().single()),
    deleteReward: (id) => one(need('deleteReward').from('rewards').delete().eq('id', id)),
    // ---- telemetry & events
    insertTelemetry: (rows) => one(need('insertTelemetry').from('telemetry').insert(rows)),
    getTelemetry: (sid, sinceIso) => one(ro.from('telemetry').select('session_id, kind, at, payload').eq('student_id', sid).gte('at', sinceIso).order('at')),
    insertEvent: (row) => one(need('insertEvent').from('events').insert(row)),
    getEvents: (sid, sinceIso, kind = null) => { let q = ro.from('events').select('*').eq('student_id', sid).gte('at', sinceIso).order('at'); if (kind) q = q.eq('kind', kind); return one(q); },
    // ---- MAP, passages, explanations
    getMapResults: (sid) => one(ro.from('map_results').select('*').eq('student_id', sid).order('tested_at')),
    insertMapResult: (row) => one(need('insertMapResult').from('map_results').insert(row).select().single()),
    getPassages: ({ genre = null, minUsed = false } = {}) => { let q = ro.from('passages').select('*').order('used_count'); if (genre) q = q.eq('genre', genre); return one(q); },
    getPassage: (id) => one(ro.from('passages').select('*').eq('id', id).maybeSingle()),
    insertPassages: (rows) => one(need('insertPassages').from('passages').insert(rows).select('id')),
    updatePassage: (id, patch) => one(need('updatePassage').from('passages').update(patch).eq('id', id)),
    getExplanation: (skillId) => one(ro.from('explanations').select('*').eq('skill_id', skillId).maybeSingle()),
    upsertExplanation: (row) => one(need('upsertExplanation').from('explanations').upsert(row, { onConflict: 'skill_id' })),
    // ---- LLM cost ledger
    usageToday: async () => { if (!rw) return 0; const rows = await one(rw.from('llm_usage').select('usd').eq('day', todayIn(tz))); return rows.reduce((a, r) => a + Number(r.usd || 0), 0); },
    recordUsage: (row) => one(need('recordUsage').from('llm_usage').insert({ day: todayIn(tz), ...row })),
    usageByDay: async (days = 30) => { const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10); return one(need('usage').from('llm_usage').select('day, model, usd').gte('day', since)); },
  };
}
