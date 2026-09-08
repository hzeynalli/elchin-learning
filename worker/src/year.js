// Year engine (docs/06, BRIEF §8 Phase 6): review outcomes → FSRS-lite, implicit repetition, monthly Knowledge Check
// ("Memory game" in the student UI), MAP-style mock by instructional area, learn-ahead candidates.
import { onReview, implicitRepetition, timingCredit, learnAheadCandidates } from './scheduler.js';
import { expectedSeconds } from './marking.js';
import { makeItems, publicItem } from './itemgen.js';
import { rngFor, shuffle } from './rng.js';
import confusables from '../../data/confusables.json' with { type: 'json' };

const isSecure = (s) => s === 'secure' || s === 'mastered';
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
export const CONFUSABLE_PAIRS = confusables.pairs;
export const IMPLICIT_SUBJECTS = (sk) => sk.subject === 'Mathematics' || (sk.subject === 'Language Usage' && /Mechanics|Grammar/.test(sk.strand));

/**
 * Called by finalizeTest before mastery recompute. For review-type tests: apply the FSRS outcome per skill.
 * For any passed test: give 0.5 implicit credit to direct prerequisites (maths / grammar mechanics only).
 */
export async function applyReviewOutcomes(repo, { studentId, test, items, per, skillsById, states, settings, now }) {
  const passRate = Number(settings?.pass_rate ?? 0.9);
  const stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  const touched = [];
  const isReviewKind = test.kind === 'review' || test.kind === 'knowledge_check' || test.kind === 'daily_review';
  for (const [skillId, p] of Object.entries(per)) {
    const st = stateBy[skillId] || null;                       // may not exist yet on a first practice set
    const rate = p.items ? p.correct / p.items : 0;
    const rows = items.filter((i) => i.skill_id === skillId && i.correct != null);
    const credits = rows.map((i) => timingCredit({ correct: !!i.correct, time_s: i.time_s, expected_s: expectedSeconds({ format: i.format, tier: i.tier, time_limit_s: i.item?.time_limit_s }) }));
    const credit = credits.length ? Math.min(1, credits.reduce((a, b) => a + b, 0) / Math.max(1, rows.filter((i) => i.correct).length || 1)) : 1;
    if (st && isReviewKind && isSecure(st.status) && st.stability) {
      const r = onReview(st, { passed: rate >= passRate, credit, now });
      await repo.upsertSkillState({ ...st, stability: r.stability, difficulty: r.difficulty, last_review_at: r.last_review_at, next_review_at: r.next_review_at, review_stage: r.review_stage, updated_at: now });
      touched.push({ skill_id: skillId, kind: 'review', passed: rate >= passRate, next_review_at: r.next_review_at });
    }
    // implicit repetition: a pass on this skill reviews its direct prerequisites (maths & mechanics), half credit
    const sk = skillsById[skillId];
    if (sk && rate >= passRate && IMPLICIT_SUBJECTS(sk)) {
      for (const pid of sk.prerequisites || []) {
        const ps = stateBy[pid];
        if (!ps || !isSecure(ps.status) || !ps.stability) continue;
        const r = implicitRepetition(ps, now);
        if (!r) continue;
        await repo.upsertSkillState({ ...ps, stability: r.stability, difficulty: r.difficulty, last_review_at: r.last_review_at, next_review_at: r.next_review_at, updated_at: now });
        touched.push({ skill_id: pid, kind: 'implicit', from: skillId, next_review_at: r.next_review_at });
      }
    }
  }
  return touched;
}

/** Learn-ahead (docs/06 §1): from the 15th, propose ≤ 2 skills of next month whose prerequisites are Secure. */
export function learnAheadFor(skills, statusOf, now) {
  const d = new Date(now);
  if (d.getUTCDate() < 15) return [];
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  return learnAheadCandidates(skills, statusOf, next, 2);
}

export const yearRoutes = {
  /** Monthly blind check over Mastered skills (Secure if too few): 20 items, 5 in school style, no hints. */
  'POST /knowledge-check': async ({ env, repo, studentId, body, now }) => {
    const [skills, states] = await Promise.all([repo.getSkills(), repo.getSkillStates(studentId)]);
    const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
    const stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
    let pool = states.filter((s) => s.status === 'mastered').map((s) => s.skill_id);
    if (pool.length < 4) pool = states.filter((s) => isSecure(s.status)).map((s) => s.skill_id);
    if (!pool.length) throw bad('Nothing to check yet — secure some skills first.');
    const rng = rngFor(studentId, 'kc', now.toISOString().slice(0, 7));
    const chosen = shuffle(rng, pool).slice(0, 10);
    const specs = []; let i = 0;
    while (specs.length < 20) { const id = chosen[i % chosen.length]; specs.push({ skill_id: id, tier: specs.length % 4 === 3 ? 3 : 2, position: specs.length + 1, school_style: specs.length < 5 }); i++; }
    const subject = body?.subject || byId[chosen[0]]?.subject || 'Mathematics';
    const test = await repo.insertTest({ student_id: studentId, subject: 'Mixed', kind: 'knowledge_check', status: 'open', started_at: now.toISOString(), plan: { month: now.toISOString().slice(0, 7), skills: chosen } });
    const rows = await makeItems(repo, { studentId, testId: test.id, subject, specs, skillsById: byId, env });
    rows.forEach((r, k) => { if (specs[k].school_style) r.item.school_style = true; });
    const inserted = await repo.insertTestItems(rows);
    return { test_id: test.id, mode: 'knowledge_check', label: 'Memory game', items: inserted.map(publicItem), expected_s: inserted.map((r) => expectedSeconds({ format: r.format, tier: r.tier })) };
  },
  /** MAP-style mock: 40 items across all skills of a subject, mixed strands, tiers 1–3; results by instructional area. */
  'POST /map-mock': async ({ env, repo, studentId, body, now }) => {
    const subject = body?.subject || 'Mathematics';
    const skills = (await repo.getSkills()).filter((s) => s.subject === subject);
    if (!skills.length) throw bad('unknown subject');
    const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
    const rng = rngFor(studentId, 'map', now.toISOString());
    const order = shuffle(rng, skills);
    const specs = []; let i = 0;
    while (specs.length < 40) { const s = order[i % order.length]; specs.push({ skill_id: s.id, tier: [1, 2, 2, 3][specs.length % 4], position: specs.length + 1 }); i++; }
    const test = await repo.insertTest({ student_id: studentId, subject, kind: 'map_mock', status: 'open', started_at: now.toISOString(), plan: { areas: [...new Set(skills.map((s) => s.map_area))] } });
    const rows = await makeItems(repo, { studentId, testId: test.id, subject, specs, skillsById: byId, env });
    const inserted = await repo.insertTestItems(rows);
    return { test_id: test.id, mode: 'map_mock', subject, items: inserted.map(publicItem), expected_s: inserted.map((r) => expectedSeconds({ format: r.format, tier: r.tier })) };
  },
};

/** Per instructional area summary for a finished map_mock (used by finalizeTest). */
export function areaSummary(items, skillsById) {
  const areas = {};
  for (const i of items) { if (i.correct == null) continue; const a = skillsById[i.skill_id]?.map_area || 'Other'; const x = (areas[a] ??= { items: 0, correct: 0 }); x.items++; if (i.correct) x.correct++; }
  return Object.entries(areas).map(([area, x]) => ({ area, items: x.items, correct: x.correct, rate: Math.round((100 * x.correct) / x.items) / 100 })).sort((a, b) => a.rate - b.rate);
}
