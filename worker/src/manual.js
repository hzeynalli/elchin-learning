// Manual entry of the paper Diagnostic 1 scorecard (BRIEF §0 Phase 0 / §8 Phase 1). The parent ticks each of the 29
// questions; the Worker writes a `manual` test with proper test_items on the canonical skills (data/qsi_crosswalk.json)
// and recomputes mastery. The app never starts empty.
import crosswalk from '../../data/qsi_crosswalk.json' with { type: 'json' };
import { recomputeSkills } from './recompute.js';
import { stemHash } from './items.js';

export function manualTemplate() {
  const d = crosswalk.diagnostic_1;
  return { source: 'diagnostic_1', title: d.title, questions: d.questions.map((q) => ({ q: q.q, qsi: q.qsi, skill_id: q.skill_id, tier: q.tier, stem: q.stem, answer: q.answer, timed_s: q.timed_s || null })) };
}

/** body: { source: 'diagnostic_1', marks: { "1": true, "2": false, ... }, minutes?: number, q4_seconds?: number, date?: 'YYYY-MM-DD' } */
export async function manualEntry({ repo, studentId, profile, body, now = new Date() }) {
  if (body?.source !== 'diagnostic_1') throw Object.assign(new Error('unknown source'), { status: 400 });
  const marks = body.marks || {};
  const qs = crosswalk.diagnostic_1.questions;
  const answeredAt = body.date ? new Date(`${body.date}T12:00:00+04:00`).toISOString() : now.toISOString();
  const test = await repo.insertTest({ student_id: studentId, subject: 'Mathematics', kind: 'manual', status: 'complete', started_at: answeredAt, submitted_at: answeredAt, duration_s: body.minutes ? Math.round(body.minutes * 60) : null, plan: { source: 'diagnostic_1', entered_by: profile.id } });
  const rows = []; let pos = 0;
  for (const q of qs) {
    const mark = marks[String(q.q)];
    const correct = mark === true;
    const base = { test_id: test.id, student_id: studentId, skill_id: q.skill_id, tier: q.tier, format: 'numeric', marked_by: 'parent', answered_at: answeredAt, correct: mark == null ? null : correct };
    if (q.timed_s) {
      // The timed row is six multiplication facts — store six items so the fluency skill gets qualifying evidence and
      // a per-fact time (paper threshold 20 s / 6 ≈ 3.3 s; the app's `fast` rule is ≤ 3 s per fact, docs/02 §3).
      const facts = q.stem.split(/[:,]/).slice(1).map((s) => s.replace(/\(.*\)/, '').trim()).filter((s) => /×/.test(s));
      const answers = q.answer.split(',').map((s) => s.trim());
      const perFact = body.q4_seconds ? Math.round((Number(body.q4_seconds) / facts.length) * 10) / 10 : null;
      facts.forEach((f, k) => rows.push({ ...base, position: ++pos, stem_hash: stemHash(f), time_s: perFact, answer_given: mark == null ? null : correct ? answers[k] : '✗',
        item: { stem: `${f} = ?`, answer: answers[k], format: 'numeric', generated_by: 'paper', source_style: 'GoMath', qsi: q.qsi, paper_q: q.q, time_limit_s: 3 } }));
    } else {
      rows.push({ ...base, position: ++pos, stem_hash: stemHash(q.stem), time_s: null, answer_given: mark == null ? null : correct ? q.answer : '✗',
        item: { stem: q.stem, answer: q.answer, format: 'numeric', generated_by: 'paper', source_style: 'GoMath', qsi: q.qsi, paper_q: q.q } });
    }
  }
  await repo.insertTestItems(rows);
  const per = {}; for (const r of rows) { if (r.correct == null) continue; const p = (per[r.skill_id] ??= { items: 0, correct: 0 }); p.items++; if (r.correct) p.correct++; }
  const total = rows.filter((r) => r.correct != null).length, right = rows.filter((r) => r.correct).length;
  await repo.updateTest(test.id, { score: total ? Math.round((100 * right) / total) / 100 : null, per_skill: per });
  const results = await recomputeSkills(repo, { studentId, skillIds: Object.keys(per), settings: profile.settings, now: now.toISOString() });
  await repo.insertEvent({ student_id: studentId, kind: 'manual_entry', payload: { test_id: test.id, source: 'diagnostic_1', score: right, total } });
  return { test_id: test.id, score: right, total, per_skill: per, skill_states: results.map((r) => ({ skill_id: r.row.skill_id, status: r.row.status, last_rate: r.row.last_rate })) };
}
