// Item supply for tests: maths from template generators (fresh seed per student/test/position, deduplicated against the
// skill's last 300 stems — docs/03 §8), everything else from the verified item_bank buffer (BRIEF §6).
import { generateMathItem } from '../generators/math/index.js';

export const MATH = 'Mathematics';
const STRIP = ['answer', 'accept', 'working', 'explanation', 'params', 'distractor_rationale', 'rubric', 'seed', 'verification'];

/** What the browser may see before answering. */
export function publicItem(row) {
  const it = row.item || {};
  const pub = { id: row.id, position: row.position, skill_id: row.skill_id, tier: row.tier, format: row.format, stem: it.stem, options: it.options, time_limit_s: it.time_limit_s ?? null, passage: it.passage ?? null };
  return pub;
}
/** What the browser gets after marking. */
export function feedbackItem(row) { const it = row.item || {}; return { answer: it.answer, explanation: it.explanation, working: it.working, rule: it.rule }; }

export class NoItems extends Error { constructor(skill, tier) { super(`No verified items available yet for ${skill} (tier ${tier}). The item bank refills every 15 minutes once the LLM key is set.`); this.status = 503; } }

/**
 * Build test_items rows (unanswered) for the given specs [{skill_id, tier, position}].
 * @param {object} o { studentId, testId, subject, specs, skillsById }
 */
export async function makeItems(repo, { studentId, testId, subject, specs, skillsById = {} }) {
  const recentCache = new Map(), usedInTest = new Set(), rows = [];
  for (const spec of specs) {
    const skill = skillsById[spec.skill_id];
    const subj = skill?.subject || subject;
    let item = null;
    if (subj === MATH) {
      if (!recentCache.has(spec.skill_id)) recentCache.set(spec.skill_id, new Set(await repo.recentStemHashes(spec.skill_id, 300)));
      const recent = recentCache.get(spec.skill_id);
      for (let attempt = 0; attempt < 12 && !item; attempt++) {
        const cand = generateMathItem(spec.skill_id, spec.tier, `${studentId}|${testId}|${spec.position}|${attempt}`);
        if (!cand) throw new NoItems(spec.skill_id, spec.tier);
        if (recent.has(cand.stem_hash) || usedInTest.has(cand.stem_hash)) continue;
        item = cand;
      }
      if (!item) item = generateMathItem(spec.skill_id, spec.tier, `${studentId}|${testId}|${spec.position}|${Date.now()}`);   // extremely unlikely
    } else {
      const tiers = [spec.tier, spec.tier === 3 ? 2 : spec.tier + 1, spec.tier === 1 ? 2 : spec.tier - 1];
      let bankRow = null;
      for (const t of tiers) { const [r] = await repo.bankTake(spec.skill_id, t, 1); if (r) { bankRow = r; break; } }
      if (!bankRow) throw new NoItems(spec.skill_id, spec.tier);
      item = { ...bankRow.item, stem_hash: bankRow.stem_hash, tier: bankRow.tier, generated_by: bankRow.item.generated_by || 'llm' };
    }
    usedInTest.add(item.stem_hash);
    const { stem_hash, skill_id: _s, tier: itTier, ...payload } = item;
    rows.push({ test_id: testId, student_id: studentId, skill_id: spec.skill_id, position: spec.position, tier: itTier ?? spec.tier, format: item.format, item: payload, stem_hash, answer_given: null, correct: null });
  }
  return rows;
}

export function stripForClient(row) { const pub = publicItem(row); STRIP.forEach((k) => delete pub[k]); return pub; }
