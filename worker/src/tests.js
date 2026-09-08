// Tests: /generate-test, /next-item (adaptive + immediate feedback), /answer-item (autosave), /submit-test (BRIEF §6).
import { createPlan, nextSpec, recordAnswer, startSitting, summarize, targetedSpecs } from './adaptive.js';
import { urgencyScore } from './mastery.js';
import { dueSkills } from './scheduler.js';
import { markRule, expectedSeconds, cadenceFlag } from './marking.js';
import { makeItems, publicItem, feedbackItem } from './itemgen.js';
import { recomputeSkills } from './recompute.js';
import { pointsFor } from './items.js';
import { llm } from './anthropic.js';
import { shuffle, rngFor } from './rng.js';
import markPrompt from '../prompts/mark_prompt.md';

const ADAPTIVE = new Set(['diagnostic']);
const isSecure = (s) => s === 'secure' || s === 'mastered';
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

async function loadSkills(repo, studentId) {
  const [skills, states] = await Promise.all([repo.getSkills(), repo.getSkillStates(studentId)]);
  const stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  return { skills, states, stateBy, byId: Object.fromEntries(skills.map((s) => [s.id, s])) };
}

/** Mark one answer: rule-based in code, else LLM against the rubric (docs/03 §7). Returns the patch for test_items. */
export async function markAnswer(env, repo, row, given, { time_s = null, retry = false, now } = {}) {
  const item = row.item;
  const rule = markRule({ ...item, format: row.format, tier: row.tier }, given);
  const base = { answer_given: given == null ? null : String(given), time_s: time_s ?? row.time_s ?? null, answered_at: now, retry_used: retry || row.retry_used || false };
  if (rule) return { ...base, correct: rule.correct, marked_by: 'rule', partial: rule.correct ? 1 : 0, confidence: 1, feedback: null };
  // short_text / writing → LLM (mock mode returns a low-confidence heuristic → parent queue)
  const prompt = markPrompt.replace('{{stem}}', item.stem).replace('{{rubric}}', item.rubric || item.answer || '').replace('{{answer}}', String(given ?? ''));
  const res = await llm(env, repo, { purpose: 'mark', model: env.MODEL_MARK || env.MODEL_GEN, system: 'You mark short answers. Reply with JSON only.', messages: [{ role: 'user', content: prompt }], max_tokens: 300, json: true, effort: 'low' });
  const j = res.json || {};
  const correct = j.correct === true, confidence = Math.max(0, Math.min(1, Number(j.confidence ?? 0.5)));
  return { ...base, correct, partial: j.partial != null ? Number(j.partial) : correct ? 1 : 0, confidence, feedback: j.feedback || null, marked_by: 'llm' };
}

function specsForMode({ mode, skills, stateBy, subject, skillId, rng }) {
  const inSubject = skills.filter((s) => s.subject === subject);
  if (mode === 'targeted') {
    const notSecure = new Set(inSubject.filter((s) => !isSecure(stateBy[s.id]?.status)).map((s) => s.id));
    const dependents = {}; for (const s of inSubject) if (notSecure.has(s.id)) for (const p of s.prerequisites) dependents[p] = (dependents[p] || 0) + 1;
    const weak = inSubject.filter((s) => { const st = stateBy[s.id]?.status || 'not_yet'; return st === 'not_yet' || st === 'emerging'; })
      .map((s) => ({ skill_id: s.id, status: stateBy[s.id]?.status || 'not_yet', urgency: urgencyScore({ priority: s.priority, status: stateBy[s.id]?.status || 'not_yet', dependents_not_secure: dependents[s.id] || 0 }) }))
      .sort((a, b) => b.urgency - a.urgency).slice(0, 6);
    if (!weak.length) throw bad('No weak skills in this subject — every skill is secure. Try a review instead.');
    return targetedSpecs({ weak, count: 15, rng }).map((s, i) => ({ ...s, position: i + 1 }));
  }
  if (mode === 'practice10') {
    const tiers = shuffle(rng, [2, 2, 2, 2, 2, 2, 2, 1, 1, 1]);
    return tiers.map((tier, i) => ({ skill_id: skillId, tier, position: i + 1 }));
  }
  if (mode === 'confirm5') {
    const tiers = shuffle(rng, [3, 3, 3, 2, 2]);
    return tiers.map((tier, i) => ({ skill_id: skillId, tier, position: i + 1 }));
  }
  if (mode === 'review' || mode === 'daily_review') {
    const pool = mode === 'review' ? dueSkills(Object.values(stateBy), new Date().toISOString()).map((s) => s.skill_id)
      : skills.filter((s) => ['emerging', 'secure', 'mastered'].includes(stateBy[s.id]?.status)).map((s) => s.id);
    if (!pool.length) throw bad('Nothing to review yet — secure a skill first.');
    const chosen = shuffle(rng, pool).slice(0, 10);
    const specs = []; let i = 0;
    while (specs.length < 10) { const id = chosen[i % chosen.length]; specs.push({ skill_id: id, tier: specs.length % 3 === 2 ? 3 : 2, position: specs.length + 1 }); i++; }
    return specs;
  }
  throw bad(`unknown mode ${mode}`);
}

export const testsRoutes = {
  /** body: { subject, mode, skill_ids?, scope?: 'A'|'B'|'all', skill_id?, loop_id? } */
  'POST /generate-test': async ({ env, repo, studentId, profile, body, now }) => {
    const subject = body?.subject || 'Mathematics', mode = body?.mode || 'diagnostic';
    const { skills, stateBy, byId } = await loadSkills(repo, studentId);
    const nowIso = now.toISOString();
    if (mode === 'diagnostic') {
      const open = (await repo.getTests(studentId, { kind: 'diagnostic', limit: 5 })).find((t) => t.subject === subject && t.status !== 'complete');
      let test = open;
      if (!test || body?.restart) {
        const inSubject = skills.filter((s) => s.subject === subject);
        const plan = createPlan({ skills: inSubject, states: stateBy, scope: body?.scope || 'A', skill_ids: body?.skill_ids || null });
        if (!plan.skills.length) throw bad('No skills match this scope');
        test = await repo.insertTest({ student_id: studentId, subject, kind: 'diagnostic', status: 'open', plan, started_at: nowIso });
      } else { startSitting(test.plan); test = await repo.updateTest(test.id, { plan: test.plan, status: 'open' }); }
      const next = await serveNext(repo, { env, studentId, test, byId, states: stateBy, now: nowIso });
      return { test_id: test.id, mode, subject, resumed: !!open && !body?.restart, progress: progressOf(test.plan), ...next };
    }
    if (mode === 'reading') {                                   // one passage, its whole question set (docs/02 §4 step 3)
      const passages = (await repo.getPassages()).filter((p) => Array.isArray(p.questions) && p.questions.length);
      if (!passages.length) throw bad('No passages in the bank yet', 503);
      const p = body?.passage_id ? passages.find((x) => x.id === body.passage_id) || passages[0] : passages[0];   // least used first
      const test = await repo.insertTest({ student_id: studentId, subject: 'Reading', kind: 'reading', status: 'open', started_at: nowIso, plan: { passage_id: p.id, title: p.title, mode } });
      const rows = p.questions.map((q, i) => { const { skill_id, tier, ...rest } = q; return { test_id: test.id, student_id: studentId, skill_id, position: i + 1, tier, format: q.format, item: { ...rest, passage: p.text, passage_id: p.id, passage_title: p.title, generated_by: 'human' }, stem_hash: `${p.id}-${i}`, answer_given: null, correct: null }; });
      const inserted = await repo.insertTestItems(rows);
      await repo.updatePassage(p.id, { used_count: (p.used_count || 0) + 1 }).catch(() => {});
      return { test_id: test.id, mode, subject: 'Reading', passage: { id: p.id, title: p.title, text: p.text, genre: p.genre }, items: inserted.map(publicItem), expected_s: inserted.map((r) => expectedSeconds({ format: r.format, tier: r.tier })) };
    }
    const rng = rngFor(studentId, mode, nowIso);
    const specs = specsForMode({ mode, skills, stateBy, subject, skillId: body?.skill_id, rng });
    if ((mode === 'practice10' || mode === 'confirm5') && !byId[body?.skill_id]) throw bad('skill_id required');
    const kind = mode;
    const test = await repo.insertTest({ student_id: studentId, subject: byId[body?.skill_id]?.subject || subject, kind, skill_id: body?.skill_id || null, loop_id: body?.loop_id || null, status: 'open', started_at: nowIso, plan: { specs: specs.length, mode } });
    const rows = await makeItems(repo, { studentId, testId: test.id, subject, specs, skillsById: byId, env });
    const inserted = await repo.insertTestItems(rows);
    return { test_id: test.id, mode, subject, items: inserted.map(publicItem), expected_s: inserted.map((r) => expectedSeconds({ format: r.format, tier: r.tier, time_limit_s: r.item.time_limit_s })) };
  },

  /** Adaptive step. body: { test_id, last_answer?: { item_id, answer, time_s, retry? } } */
  'POST /next-item': async ({ env, repo, studentId, profile, body, now }) => {
    const test = await repo.getTest(body?.test_id);
    if (!test || test.student_id !== studentId) throw bad('test not found', 404);
    if (test.status === 'complete') throw bad('test already complete');
    const { byId, stateBy } = await loadSkills(repo, studentId);
    const nowIso = now.toISOString();
    let last = null;
    if (body?.last_answer?.item_id) {
      const row = await repo.getTestItem(body.last_answer.item_id);
      if (!row || row.test_id !== test.id) throw bad('item not found', 404);
      if (row.correct != null && !(test.kind === 'practice10' && !row.retry_used && row.correct === false)) throw bad('item already answered');
      const patch = await markAnswer(env, repo, row, body.last_answer.answer, { time_s: body.last_answer.time_s, retry: row.correct === false, now: nowIso });
      const updated = await repo.updateTestItem(row.id, patch);
      const fb = feedbackItem(row);
      // practice sets: one retry after a scaffold hint (docs/02 §2)
      if (test.kind === 'practice10' && !patch.correct && !row.retry_used && row.correct == null) {
        return { last: { item_id: row.id, correct: false, retry: true, hint: fb.working || 'Look again at the first step.' }, progress: progressOf(test.plan) };
      }
      last = { item_id: row.id, correct: patch.correct, ...fb, retry_used: patch.retry_used, cadence: cadenceFlag({ correct: patch.correct, time_s: patch.time_s, expected_s: expectedSeconds({ format: row.format, tier: row.tier, time_limit_s: row.item.time_limit_s }) }) };
      if (test.kind === 'diagnostic') { recordAnswer(test.plan, { skill_id: row.skill_id, correct: patch.correct, tier: row.tier }, { skills: Object.values(byId), states: stateBy }); await repo.updateTest(test.id, { plan: test.plan }); }
    }
    if (test.kind !== 'diagnostic') {                          // practice/confirm sets are pre-generated: serve the next unanswered
      const items = await repo.getTestItems(test.id);
      const open = items.filter((i) => i.correct == null && !i.item?.voided);   // voided = tier-3 slip replaced by the coach
      const next = open[0];
      if (!next) { const results = await finalizeTest(env, repo, { test, studentId, profile, now: nowIso }); return { last, test_complete: true, results }; }
      return { last, item: publicItem(next), remaining: open.length };
    }
    const next = await serveNext(repo, { env, studentId, test, byId, states: stateBy, now: nowIso, profile });
    return { last, progress: progressOf(test.plan), ...next };
  },

  /** Autosave for non-adaptive tests. body: { test_id, item_id, answer, time_s } */
  'POST /answer-item': async ({ repo, studentId, body }) => {
    const row = await repo.getTestItem(body?.item_id);
    if (!row || row.student_id !== studentId || row.test_id !== body?.test_id) throw bad('item not found', 404);
    if (row.correct != null) throw bad('item already marked');
    await repo.updateTestItem(row.id, { answer_given: body.answer == null ? null : String(body.answer), time_s: body.time_s ?? null });
    return { ok: true };
  },

  /** body: { test_id, answers: [{item_id, answer, time_s}], started_at?, submitted_at? } */
  'POST /submit-test': async ({ env, repo, studentId, profile, body, now }) => {
    const test = await repo.getTest(body?.test_id);
    if (!test || test.student_id !== studentId) throw bad('test not found', 404);
    if (test.status === 'complete') throw bad('test already complete');
    const nowIso = now.toISOString();
    const items = await repo.getTestItems(test.id);
    const answers = Object.fromEntries((body?.answers || []).map((a) => [a.item_id, a]));
    for (const row of items) {
      if (row.correct != null) continue;
      const a = answers[row.id] || { answer: row.answer_given, time_s: row.time_s };
      const patch = await markAnswer(env, repo, row, a?.answer ?? null, { time_s: a?.time_s, now: nowIso });
      await repo.updateTestItem(row.id, patch);
    }
    const started = body?.started_at || test.started_at || nowIso, submitted = body?.submitted_at || nowIso;
    const results = await finalizeTest(env, repo, { test: { ...test, started_at: started }, studentId, profile, now: submitted });
    return { test_id: test.id, results };
  },

  'GET /tests': async ({ repo, studentId, url }) => {
    const tests = await repo.getTests(studentId, { limit: Number(url.searchParams.get('limit') || 30) });
    return { tests: tests.map((t) => ({ id: t.id, subject: t.subject, kind: t.kind, status: t.status, score: t.score, per_skill: t.per_skill, started_at: t.started_at, submitted_at: t.submitted_at, duration_s: t.duration_s, progress: t.kind === 'diagnostic' ? progressOf(t.plan) : null })) };
  },
  'GET /test': async ({ repo, studentId, url }) => {
    const test = await repo.getTest(url.searchParams.get('id'));
    if (!test || test.student_id !== studentId) throw bad('test not found', 404);
    const items = await repo.getTestItems(test.id);
    return { test, items: items.map((r) => ({ ...publicItem(r), answer_given: r.answer_given, correct: r.correct, time_s: r.time_s, feedback: r.feedback, marked_by: r.marked_by, confidence: r.confidence, ...(r.correct != null ? feedbackItem(r) : {}) })) };
  },
};

function progressOf(plan) {
  if (!plan?.skills) return null;
  return { skills_total: plan.skills.length, skills_done: plan.skills.filter((s) => s.done).length, items_total: plan.total_items || 0, sitting_items: plan.sitting_items || 0, sitting_cap: 25 };
}

async function serveNext(repo, { env, studentId, test, byId, states, now, profile }) {
  const spec = nextSpec(test.plan);
  if (spec.sitting_complete) { await repo.updateTest(test.id, { status: 'sitting_complete', plan: test.plan }); return { sitting_complete: true, summary: summarize(test.plan) }; }
  if (spec.test_complete) { const results = await finalizeTest(env, repo, { test, studentId, profile, now }); return { test_complete: true, results }; }
  const position = (test.plan.total_items || 0) + 1;
  const [row] = await makeItems(repo, { studentId, testId: test.id, subject: test.subject, specs: [{ ...spec, position }], skillsById: byId, env });
  const [inserted] = await repo.insertTestItems([row]);
  return { item: publicItem(inserted) };
}

/** Mark-up complete: per-skill summary, score, mastery recompute, points, results payload with status transitions. */
export async function finalizeTest(env, repo, { test, studentId, profile, now }) {
  const items = await repo.getTestItems(test.id);
  const { byId, stateBy } = await loadSkills(repo, studentId);
  const per = {};
  for (const r of items) { if (r.correct == null) continue; const p = (per[r.skill_id] ??= { items: 0, correct: 0, tier3_correct: false }); p.items++; if (r.correct) p.correct++; if (r.tier === 3 && r.correct) p.tier3_correct = true; }
  const answered = items.filter((r) => r.correct != null), right = answered.filter((r) => r.correct).length;
  const before = Object.fromEntries(Object.keys(per).map((id) => [id, stateBy[id]?.status || 'not_yet']));
  const student = profile.role === 'student' ? profile : await repo.getProfile(studentId);
  const settings = student?.settings || {};
  const recomputed = await recomputeSkills(repo, { studentId, skillIds: Object.keys(per), settings, now });
  const after = Object.fromEntries(recomputed.map((r) => [r.row.skill_id, r.row.status]));
  const durationS = test.started_at ? Math.max(0, Math.round((new Date(now) - new Date(test.started_at)) / 1000)) : answered.reduce((a, r) => a + (r.time_s || 0), 0);
  const score = answered.length ? Math.round((100 * right) / answered.length) / 100 : null;
  await repo.updateTest(test.id, { status: 'complete', submitted_at: now, duration_s: durationS, score, per_skill: per });
  const pts = answered.reduce((a, r) => a + pointsFor(r.tier, r.correct), 0);
  if (pts > 0) await repo.addPoints({ student_id: studentId, delta: pts, reason: `${test.kind}: ${right} correct` });
  await repo.insertEvent({ student_id: studentId, kind: 'test_complete', payload: { test_id: test.id, kind: test.kind, score, items: answered.length } });
  const per_skill = Object.entries(per).map(([id, p]) => ({ skill_id: id, name: byId[id]?.name || id, priority: byId[id]?.priority, items: p.items, correct: p.correct, rate: Math.round((100 * p.correct) / p.items) / 100, status_before: before[id], status_after: after[id] || before[id] }));
  const weak = per_skill.filter((s) => s.rate < 0.9).sort((a, b) => a.rate - b.rate);
  return { test_id: test.id, kind: test.kind, subject: test.subject, score, correct: right, total: answered.length, duration_s: durationS, points: pts, per_skill,
    items: items.map((r) => ({ ...publicItem(r), answer_given: r.answer_given, correct: r.correct, time_s: r.time_s, ...feedbackItem(r), feedback: r.feedback })),
    next_steps: weak.slice(0, 3).map((s) => ({ skill_id: s.skill_id, name: s.name, action: 'coach' })),
    secured: per_skill.filter((s) => !isSecure(s.status_before) && isSecure(s.status_after)).map((s) => s.name) };
}
