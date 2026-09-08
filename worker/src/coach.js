// The coach — docs/02 §2 state machine, §5 voice and moves, prompts/coach_system_prompt.md (server-side, CLAUDE.md #3),
// BRIEF §6 guards. Every turn is stored in coach_sessions.messages (CLAUDE.md #4). Practice/confirm sets are tests
// (kind practice10 / confirm5, loop_id = session id) served by /generate-test + /next-item; the coach comments on
// each answer. Mastery is decided by mastery.js from the stored tests, never by the coach.
import coachPrompt from '../prompts/coach_system_prompt.md';
import explanations from './explanations.json' with { type: 'json' };
import { llm, llmStreamResponse } from './anthropic.js';
import { recomputeSkills } from './recompute.js';
import { makeItems, publicItem } from './itemgen.js';

export const REPRESENTATIONS = ['words', 'picture or number line', 'area model or table', 'story context', 'teach it to a younger kid'];
const MAX_INPUT = 400, BLOCK_MIN = 30, DAILY_CAP_MIN = 60, CYCLES_BEFORE_BREAK = 3, CONTEXT_TURNS = 40;
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const isSecure = (s) => s === 'secure' || s === 'mastered';

// ---- prompt assembly: static rules first (cached), runtime header + canonical explanation second
const RULES_START = coachPrompt.indexOf('## How you coach');
const RULES = coachPrompt.slice(RULES_START);
const HEADER_TEMPLATE = coachPrompt.slice(0, RULES_START);
const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));

async function buildSystem(repo, { skill, session, state, prereqs, voice, settings }) {
  const dbExpl = await repo.getExplanation(skill.id).catch(() => null);
  const canonical = dbExpl?.body || explanations[skill.id] || '';
  const header = fill(HEADER_TEMPLATE, {
    skill_name: skill.name, skill_id: skill.id, standard: skill.standard || '', subject: skill.subject,
    loop_state: session.loop_state, cycle_number: session.cycle_number, representation: session.representation,
    last_rate: state?.last_rate != null ? Math.round(state.last_rate * 100) + '%' : 'no data yet', error_notes: state?.error_notes || 'none recorded',
    prereq_status: prereqs.map((p) => `${p.name}: ${p.status}`).join('; ') || 'none', voice_mode: voice ? 'true' : 'false',
  });
  const extras = [];
  if (canonical) extras.push(`## Canonical explanation for this skill (follow its steps, representation sequence and anticipated errors; use the representation assigned for this cycle)\n${canonical}`);
  if (settings?.russian_fallback === false) extras.push('## Russian fallback is OFF for this student: stay in English.');
  return [RULES, [header, ...extras].join('\n\n')];
}

function parseTags(text) {
  const tags = { ready: /\[READY_FOR_PRACTICE\]/.test(text), brk: /\[SUGGEST_BREAK\]/.test(text) };
  let reply = text, parent_summary = null;
  const m = /\[PARENT_SUMMARY\]\s*([\s\S]*)$/.exec(text);
  if (m) { parent_summary = m[1].trim(); reply = text.slice(0, m.index); }
  reply = reply.replace(/\[(READY_FOR_PRACTICE|SUGGEST_BREAK|SESSION_END)\]/g, '').trim();
  return { ...tags, reply, parent_summary, ru_fallback: /[Ѐ-ӿ]/.test(reply) };
}

async function todayCoachMinutes(repo, studentId, now) {
  const sessions = await repo.getCoachSessions(studentId, { limit: 20 });
  const day = now.slice(0, 10);
  return sessions.filter((s) => (s.started_at || '').slice(0, 10) === day).reduce((a, s) => a + (s.active_s || 0), 0) / 60;
}

async function offTopic(env, repo, message, skill) {
  if (message.length < 3) return false;
  const res = await llm(env, repo, { purpose: 'guard', model: env.MODEL_GUARD, max_tokens: 60, json: true,
    system: 'You classify whether a child\'s message to a maths/reading/science tutor is about the lesson. Greetings, "I don\'t know", questions about the skill, answers, and asking for help are ON topic. Reply with JSON only: {"off_topic": true|false}',
    messages: [{ role: 'user', content: `Skill being taught: ${skill.name} (${skill.subject}).\nMessage: ${message}` }] });
  return res.json?.off_topic === true;
}

/** Load an open session or start one. */
async function getOrCreate(repo, { studentId, body, byId, stateBy, now, settings }) {
  if (body?.session_id) {
    const s = await repo.getCoachSession(body.session_id);
    if (!s || s.student_id !== studentId) throw bad('session not found', 404);
    if (s.ended_at) throw bad('session already ended');
    return s;
  }
  const skill = byId[body?.skill_id];
  if (!skill) throw bad('skill_id required');
  const cap = Number(settings?.daily_cap_minutes || DAILY_CAP_MIN);
  if ((await todayCoachMinutes(repo, studentId, now)) >= cap) throw bad(`Coach time for today is used up (${cap} min). Come back tomorrow — or do a reading passage.`, 429);
  const used = stateBy[skill.id]?.representation_used || [];
  const representation = REPRESENTATIONS.find((r) => !used.includes(r)) || REPRESENTATIONS[used.length % REPRESENTATIONS.length];
  return repo.insertCoachSession({ student_id: studentId, skill_id: skill.id, loop_state: 'EXPLAIN', cycle_number: 1, representation, messages: [], outcome: 'in_progress', started_at: now });
}

/** Turn the request into the user content the model sees. Events come from the app, not the child. */
function userContent(body) {
  if (body?.event) {
    const e = body.event;
    switch (e.type) {
      case 'start': return '[START] Begin the cycle: one question to activate what he already knows about this skill. Keep it short.';
      case 'practice_answer': return `[APP] Practice question ${e.position ?? ''}: "${e.stem}". He answered "${e.answer_given}" — ${e.correct ? 'correct' : 'not correct'}${e.retry ? ' on the retry' : ''}${e.hint_used ? ' after a hint' : ''}. Comment in at most two sentences: name the specific move that was right, or point to the specific step to recheck. No answers.`;
      case 'show_step': return `[APP] He has got question "${e.stem}" wrong twice. Reveal exactly ONE step (not the answer), then ask him to do the next step.`;
      case 'practice_done': return `[APP] Practice set finished: ${e.correct} of ${e.items} (${Math.round(e.rate * 100)}%). ${e.passed ? 'That is a pass — tell him so in one sentence and say a harder 5-question check comes next.' : 'That is not a pass. Say one specific thing he did well, then start a fresh explanation using a NEW representation as instructed.'}`;
      case 'confirm_done': return `[APP] Confirmation set finished: ${e.correct} of ${e.items}. ${e.passed ? 'He has secured this skill. Celebrate in one sentence naming the strategy he used, then say what is next.' : e.replacement ? 'One tier-3 slip with a correct method: tell him he gets one more hard question, then we see.' : 'Not passed. One encouraging sentence, then re-explain with a NEW representation.'}`;
      case 'end': return '[SESSION_END]';
      default: return `[APP] ${JSON.stringify(e)}`;
    }
  }
  return String(body?.message ?? '').trim();
}

/** Core turn: prepare everything, return { session, skill, system, messages, content, transitions } */
async function prepareTurn({ env, repo, studentId, profile, body, now }) {
  const nowIso = now.toISOString();
  const [skills, states] = await Promise.all([repo.getSkills(), repo.getSkillStates(studentId)]);
  const byId = Object.fromEntries(skills.map((s) => [s.id, s])), stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  const student = profile.role === 'student' ? profile : await repo.getProfile(studentId);
  const settings = student?.settings || {};
  const session = await getOrCreate(repo, { studentId, body, byId, stateBy, now: nowIso, settings });
  const skill = byId[session.skill_id];
  const content = userContent(body);
  if (!content) throw bad('message or event required');
  if (!body?.event && content.length > MAX_INPUT) throw bad(`Keep it under ${MAX_INPUT} characters — say the one thing you are stuck on.`);
  // 30-minute block guard
  const elapsedMin = (now.getTime() - new Date(session.started_at).getTime()) / 60000;
  const blockOver = elapsedMin > Number(settings.coach_block_minutes || BLOCK_MIN) && body?.event?.type !== 'end';
  // off-topic guard: two hits → pause + parent note
  let paused = null;
  if (!body?.event && await offTopic(env, repo, content, skill)) {
    const hits = (session.off_topic_hits || 0) + 1;
    await repo.updateCoachSession(session.id, { off_topic_hits: hits });
    session.off_topic_hits = hits;
    if (hits >= 2) paused = `Paused after two off-topic messages during ${skill.name}. Last message: "${content.slice(0, 120)}"`;
  }
  const prereqs = (skill.prerequisites || []).map((p) => ({ name: byId[p]?.name || p, status: stateBy[p]?.status || 'not_yet' }));
  const system = await buildSystem(repo, { skill, session, state: stateBy[skill.id], prereqs, voice: !!body?.voice_mode, settings });
  const history = (session.messages || []).slice(-CONTEXT_TURNS).map((m) => ({ role: m.role, content: m.content }));
  const messages = [...history, { role: 'user', content }];
  if (messages[0].role !== 'user') messages.unshift({ role: 'user', content: '[START]' });
  return { nowIso, session, skill, settings, stateBy, byId, system, messages, content, blockOver, paused, student };
}

/** After the reply: store the turn, apply state transitions, return the response payload. */
async function commitTurn(ctx, prep, replyText, usage) {
  const { repo, studentId, body, env } = ctx;
  const { nowIso, session, skill, settings, stateBy, content, blockOver, paused } = prep;
  const t = parseTags(replyText);
  const ev = body?.event;
  let loop_state = session.loop_state, cycle = session.cycle_number, representation = session.representation, outcome = session.outcome || 'in_progress';
  let next_action = 'continue', flag_note = session.flag_note || null, ended_at = null, parent_summary = t.parent_summary, replacement_item = null, points = 0;

  if (paused) { next_action = 'suggest_break'; outcome = 'flagged'; flag_note = paused; ended_at = nowIso; }
  else if (ev?.type === 'end') { ended_at = nowIso; next_action = 'done'; if (outcome === 'in_progress') outcome = loop_state === 'SECURE' ? 'secure' : 'in_progress'; }
  else if (ev?.type === 'practice_done') {
    if (ev.passed) { loop_state = 'CONFIRM_5'; next_action = 'start_confirm'; }
    else { cycle += 1; representation = REPRESENTATIONS[(cycle - 1) % REPRESENTATIONS.length]; loop_state = 'EXPLAIN'; next_action = cycle > CYCLES_BEFORE_BREAK ? 'suggest_break' : 'reexplain'; if (cycle > CYCLES_BEFORE_BREAK) flag_note = `${cycle - 1} explanation cycles without a pass on ${skill.name}. Sticking point (last practice ${Math.round(ev.rate * 100)}%): ${ev.error_notes || 'see transcript'}.`; }
  } else if (ev?.type === 'confirm_done') {
    if (ev.passed) { loop_state = 'SECURE'; outcome = 'secure'; next_action = 'done'; points = 10; }
    else if (ev.replacement) { next_action = 'replacement'; loop_state = 'CONFIRM_5'; }
    else { cycle += 1; representation = REPRESENTATIONS[(cycle - 1) % REPRESENTATIONS.length]; loop_state = 'EXPLAIN'; next_action = cycle > CYCLES_BEFORE_BREAK ? 'suggest_break' : 'reexplain'; }
  } else if (t.ready && loop_state === 'EXPLAIN') { loop_state = 'PRACTICE_10'; next_action = 'start_practice'; }
  if (t.brk && next_action === 'continue') next_action = 'suggest_break';
  if (blockOver && next_action === 'continue') next_action = 'suggest_break';

  const msgs = [...(session.messages || []), { role: 'user', content, ts: nowIso, voice: !!body?.voice_mode, event: ev?.type || null }, { role: 'assistant', content: t.reply, ts: nowIso, tags: { ready: t.ready, brk: t.brk } }];
  const active_s = Math.max(session.active_s || 0, Math.round((new Date(nowIso).getTime() - new Date(session.started_at).getTime()) / 1000));
  await repo.updateCoachSession(session.id, { messages: msgs, loop_state, cycle_number: cycle, representation, outcome, flag_note, ended_at, parent_summary: parent_summary || session.parent_summary || null, active_s });
  const prev = stateBy[skill.id] || {};
  const usedReps = Array.from(new Set([...(prev.representation_used || []), representation]));
  await repo.upsertSkillState({ ...prev, student_id: studentId, skill_id: skill.id, status: prev.status || 'not_yet', loop_state: loop_state === 'SECURE' ? 'SECURE' : loop_state, cycle_number: cycle, representation_used: usedReps, updated_at: nowIso }).catch(() => {});
  if (points) await repo.addPoints({ student_id: studentId, delta: points, reason: `coach loop complete: ${skill.name}` });
  if (t.ru_fallback) await repo.insertEvent({ student_id: studentId, kind: 'ru_fallback', payload: { session_id: session.id, skill_id: skill.id } }).catch(() => {});
  if (flag_note && flag_note !== session.flag_note) await repo.insertEvent({ student_id: studentId, kind: 'flag_parent', payload: { session_id: session.id, skill_id: skill.id, note: flag_note } }).catch(() => {});
  return { session_id: session.id, skill_id: skill.id, skill_name: skill.name, reply: t.reply, loop_state, cycle_number: cycle, representation, next_action, outcome, parent_summary: parent_summary || null, flag_note, points, ended: !!ended_at, mock: !env.ANTHROPIC_API_KEY };
}

export const coachRoutes = {
  /** body: { session_id?, skill_id?, message?, event?, voice_mode? } */
  'POST /coach': async (ctx) => {
    const prep = await prepareTurn(ctx);
    const res = await llm(ctx.env, ctx.repo, { purpose: 'coach', model: ctx.env.MODEL_COACH, system: prep.system, messages: prep.messages, max_tokens: 500, effort: 'medium' });
    const text = res.refusal ? "Let's get back to our skill. What do you think the first step is?" : res.text;
    return commitTurn(ctx, prep, text, res.usage);
  },
  /** Same, streamed as SSE: deltas, then {done, text, meta} where meta is the /coach payload. */
  'POST /coach/stream': async (ctx) => {
    const prep = await prepareTurn(ctx);
    return llmStreamResponse(ctx.env, ctx.repo, { purpose: 'coach', model: ctx.env.MODEL_COACH, system: prep.system, messages: prep.messages, max_tokens: 500, effort: 'medium' }, (text, usage) => commitTurn(ctx, prep, text, usage));
  },
  /** Confirm set with a single tier-3 slip and correct method (docs/02 §2 exception): void the slip, serve one replacement. */
  'POST /coach/replacement': async ({ env, repo, studentId, profile, body, now }) => {
    const session = await repo.getCoachSession(body?.session_id);
    if (!session || session.student_id !== studentId) throw bad('session not found', 404);
    const test = await repo.getTest(body?.test_id);
    if (!test || test.student_id !== studentId || test.kind !== 'confirm5') throw bad('confirm test not found', 404);
    const student = profile.role === 'student' ? profile : await repo.getProfile(studentId);
    if (student?.settings?.tier3_slip_replacement === false) throw bad('replacement disabled by parent setting');
    const items = await repo.getTestItems(test.id);
    const misses = items.filter((i) => i.correct === false);
    if (misses.length !== 1 || misses[0].tier !== 3) throw bad('replacement only applies to a single tier-3 miss');
    const miss = misses[0];
    // the coach judges: slip or misconception?
    const judge = await llm(env, repo, { purpose: 'verify', model: env.MODEL_GEN, max_tokens: 120, json: true, effort: 'low',
      system: 'You judge whether a wrong answer shows a correct method with a small slip, or a misconception. Reply JSON only: {"slip": true|false, "reason": "..."}',
      messages: [{ role: 'user', content: `Question: ${miss.item.stem}\nCorrect answer: ${miss.item.answer}\nStudent answer: ${miss.answer_given}\nWorking notes: ${miss.item.working || ''}` }] });
    if (judge.json?.slip !== true) return { replacement: false, reason: judge.json?.reason || 'misconception' };
    await repo.updateTestItem(miss.id, { correct: null, item: { ...miss.item, voided: true, voided_reason: 'tier-3 slip, replaced' } });
    const [row] = await makeItems(repo, { studentId, testId: test.id, subject: test.subject, specs: [{ skill_id: test.skill_id, tier: 3, position: items.length + 1 }], skillsById: Object.fromEntries((await repo.getSkills()).map((s) => [s.id, s])), env });
    const [inserted] = await repo.insertTestItems([row]);
    await repo.updateTest(test.id, { status: 'open', submitted_at: null });
    return { replacement: true, reason: judge.json.reason, item: publicItem(inserted), test_id: test.id };
  },
  'GET /coach/session': async ({ repo, studentId, url }) => {
    const s = await repo.getCoachSession(url.searchParams.get('id'));
    if (!s || s.student_id !== studentId) throw bad('session not found', 404);
    return s;
  },
  'GET /coach/open': async ({ repo, studentId }) => {
    const open = (await repo.getCoachSessions(studentId, { limit: 5 })).find((s) => !s.ended_at && s.outcome === 'in_progress');
    return { session: open || null };
  },
};
