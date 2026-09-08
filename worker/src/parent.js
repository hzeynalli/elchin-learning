// Parent marking queue (BRIEF §0, §6, docs/03 §7): LLM-marked open answers with confidence < 0.8 plus a 10 % random
// sample. The parent's decision replaces the LLM mark and the skill state is recomputed.
import { recomputeSkills } from './recompute.js';

const sampled = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 10 === 0; };

export const parentRoutes = {
  'GET /marking-queue': async ({ repo, studentId }) => {
    const low = await repo.markingQueue(studentId);
    const recent = await repo.getAnsweredSince(studentId, new Date(Date.now() - 30 * 86400000).toISOString());
    const sampleIds = recent.filter((i) => i.marked_by === 'llm' && i.confidence != null && i.confidence >= 0.8 && sampled(i.id)).map((i) => i.id);
    const sample = [];
    for (const id of sampleIds.slice(0, 20)) { const row = await repo.getTestItem(id); if (row) sample.push(row); }
    const shape = (r, why) => ({ id: r.id, test_id: r.test_id, skill_id: r.skill_id, tier: r.tier, format: r.format, stem: r.item?.stem, passage_title: r.item?.passage_title || null, rubric: r.item?.rubric || r.item?.answer || null, answer_given: r.answer_given, llm_correct: r.correct, llm_partial: r.partial, confidence: r.confidence, llm_feedback: r.feedback, answered_at: r.answered_at, why });
    return { queue: [...low.map((r) => shape(r, 'low_confidence')), ...sample.map((r) => shape(r, 'random_sample'))] };
  },
  /** body: { item_id, correct: boolean, partial?: 0..1, feedback?: string } */
  'POST /parent-mark': async ({ repo, studentId, profile, body, now }) => {
    const row = await repo.getTestItem(body?.item_id);
    if (!row || row.student_id !== studentId) throw Object.assign(new Error('item not found'), { status: 404 });
    const correct = body.correct === true;
    await repo.updateTestItem(row.id, { correct, partial: body.partial != null ? Number(body.partial) : correct ? 1 : 0, marked_by: 'parent', confidence: 1, feedback: body.feedback ? String(body.feedback).slice(0, 300) : row.feedback });
    const student = await repo.getProfile(studentId);
    await recomputeSkills(repo, { studentId, skillIds: [row.skill_id], settings: student?.settings || {}, now: now.toISOString() });
    await repo.insertEvent({ student_id: studentId, kind: 'parent_mark', payload: { item_id: row.id, correct, by: profile.id } });
    return { ok: true, item_id: row.id, correct };
  },
};
