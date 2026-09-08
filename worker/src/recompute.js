// Turns stored test_items into mastery evidence, recomputes a skill's state (docs/02 §3) and keeps the retention
// fields (docs/06 §2) consistent with status transitions. Called after every marked test and coach check.
import { recomputeSkillState } from './mastery.js';
import { onSecure } from './scheduler.js';

const isSecure = (s) => s === 'secure' || s === 'mastered';

/** Group answered items by test → one evidence event per (test, skill). */
export function evidenceFromItems(items) {
  const byTest = new Map();
  for (const it of items) {
    const t = it.tests || {};
    if (!byTest.has(it.test_id)) byTest.set(it.test_id, { kind: t.kind, loop_id: t.loop_id ?? null, items: 0, correct: 0, tier3_correct: false, times: [], at: t.submitted_at || it.answered_at });
    const ev = byTest.get(it.test_id);
    ev.items++;
    let credit = 0;
    if (it.correct) credit = it.retry_used ? (t.kind === 'practice10' ? 0.5 : t.kind === 'confirm5' ? 0 : 1) : 1;
    else if (it.partial != null) credit = Math.max(0, Math.min(1, Number(it.partial)));
    ev.correct += credit;
    if (it.tier === 3 && it.correct && !it.retry_used) ev.tier3_correct = true;
    if (it.time_s != null) ev.times.push(Number(it.time_s));
    if (it.answered_at && (!ev.at || it.answered_at > ev.at)) ev.at = it.answered_at;
  }
  return [...byTest.values()].map((e) => ({ ...e, mean_time_s: e.times.length ? e.times.reduce((a, b) => a + b, 0) / e.times.length : null }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Recompute one skill for one student and persist. Returns { row, transition } */
export async function recomputeSkill(repo, { studentId, skill, settings, now = new Date().toISOString(), prev = null }) {
  const items = await repo.getSkillEvidence(studentId, skill.id);
  const events = evidenceFromItems(items);
  const st = recomputeSkillState(events, { settings, fluency: !!skill.fluency });
  const p = prev || {};
  const row = {
    student_id: studentId, skill_id: skill.id,
    status: st.status, last_rate: st.last_rate, clean_streak: st.clean_streak, attempts: st.attempts, items_seen: items.length,
    fast: st.fast, reviews_passed: st.reviews_passed, updated_at: now,
    time_spent_s: items.reduce((a, i) => a + (Number(i.time_s) || 0), 0),
    loop_state: st.loop_state === 'CONFIRM_5' ? 'CONFIRM_5' : (p.loop_state ?? null),
    cycle_number: p.cycle_number ?? 0, representation_used: p.representation_used ?? [], error_notes: p.error_notes ?? null,
    difficulty: p.difficulty ?? 5, planned_month: skill.planned_month ?? null,
  };
  let transition = null;
  if (isSecure(st.status) && !isSecure(p.status)) { Object.assign(row, onSecure(now)); transition = 'secure'; }
  else if (isSecure(st.status)) { Object.assign(row, { stability: p.stability ?? 2, next_review_at: p.next_review_at ?? null, last_review_at: p.last_review_at ?? null, review_stage: p.review_stage ?? 0 }); if (st.status === 'mastered' && p.status !== 'mastered') transition = 'mastered'; }
  else { Object.assign(row, { stability: null, next_review_at: null, last_review_at: p.last_review_at ?? null, review_stage: 0 }); if (isSecure(p.status)) transition = 'regressed'; }
  await repo.upsertSkillState(row);
  if (transition) await repo.insertEvent({ student_id: studentId, kind: `skill_${transition}`, payload: { skill_id: skill.id, status: st.status, last_rate: st.last_rate } }).catch(() => {});
  return { row, transition };
}

/** Recompute a set of skills (after a submitted test). */
export async function recomputeSkills(repo, { studentId, skillIds, settings, now }) {
  const [skills, states] = await Promise.all([repo.getSkills(), repo.getSkillStates(studentId)]);
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
  const prevBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  const out = [];
  for (const id of new Set(skillIds)) {
    const skill = byId[id]; if (!skill) continue;
    out.push(await recomputeSkill(repo, { studentId, skill, settings, now, prev: prevBy[id] || null }));
  }
  return out;
}
