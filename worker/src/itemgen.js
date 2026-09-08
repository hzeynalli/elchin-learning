// Item supply for tests: maths from template generators (fresh seed per student/test/position, deduplicated against the
// skill's last 300 stems — docs/03 §8), everything else from the verified item_bank buffer (BRIEF §6).
import { generateMathItem } from '../generators/math/index.js';
import { llm, isMock } from './anthropic.js';
import { numericEqual } from './marking.js';
import { stemHash, itemKey } from './items.js';

export const MATH = 'Mathematics';

/**
 * docs/03 §3: the generator produces the skeleton (numbers, operations, answer computed in code); Claude writes the
 * story around it; a second, cold call solves the story; the reworded item ships only if the cold solve equals the
 * coded answer. Otherwise the template wording is kept. Skipped in mock mode.
 */
export async function rewordWordProblem(env, repo, item) {
  if (!env || isMock(env) || item.format !== 'numeric' || item.tier < 2 || !/[A-Za-z]{4,}[^.]*[A-Za-z]{4,}/.test(item.stem)) return item;
  try {
    const story = await llm(env, repo, { purpose: 'story', model: env.MODEL_GEN, max_tokens: 300, json: true, effort: 'low',
      system: 'You rewrite maths word problems for a 10-year-old in US Grade 5. Keep every number, every unit and exactly what is asked. Metric units. Reply with JSON only: {"stem": "..."}',
      messages: [{ role: 'user', content: `Rewrite this problem as a short, natural story of at most three sentences. Use a varied everyday context and a name from: Elchin, Aysel, Rasim, Leyla, Nigar, Murad. Do not change any number or the question.\n\n${item.stem}` }] });
    const stem = story.json?.stem;
    if (!stem || stem.length < 20 || stem.length > 600) return item;
    const solve = await llm(env, repo, { purpose: 'solve', model: env.MODEL_GEN, max_tokens: 200, json: true, effort: 'medium',
      system: 'Solve the maths problem. Reply with JSON only: {"answer": "<the final numeric answer, e.g. 1,058 or 3/4 or 492 r 5>"}', messages: [{ role: 'user', content: stem }] });
    const cold = solve.json?.answer;
    if (cold == null || !numericEqual(item.answer, String(cold))) {
      return { ...item, verification: { ok: false, method: 'cold-solve', reason: 'story rewording rejected: cold solve mismatch', llm_answer: cold } };
    }
    const out = { ...item, stem, generated_by: 'template+llm', verification: { ok: true, method: 'cold-solve', model: env.MODEL_GEN, coded_answer: item.answer } };
    return { ...out, stem_hash: stemHash(itemKey(out)) };
  } catch { return item; }
}
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
export async function makeItems(repo, { studentId, testId, subject, specs, skillsById = {}, env = null }) {
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
      item = await rewordWordProblem(env, repo, item);                          // Claude words the story; code owns the answer
    } else {
      const tiers = [spec.tier, spec.tier === 3 ? 2 : spec.tier + 1, spec.tier === 1 ? 2 : spec.tier - 1];
      let bankRow = null;
      for (const t of tiers) { const [r] = await repo.bankTake(spec.skill_id, t, 1); if (r) { bankRow = r; break; } }
      if (!bankRow) throw new NoItems(spec.skill_id, spec.tier);
      item = { ...bankRow.item, stem_hash: bankRow.stem_hash, tier: bankRow.tier, generated_by: bankRow.item.generated_by || 'llm' };
      if (item.passage_id && !item.passage) {                                  // reading items reference their passage
        const p = await repo.getPassage(item.passage_id).catch(() => null);
        if (p) { item.passage = p.text; item.passage_title = item.passage_title || p.title; }
      }
    }
    usedInTest.add(item.stem_hash);
    const { stem_hash, skill_id: _s, tier: itTier, ...payload } = item;
    rows.push({ test_id: testId, student_id: studentId, skill_id: spec.skill_id, position: spec.position, tier: itTier ?? spec.tier, format: item.format, item: payload, stem_hash, answer_given: null, correct: null });
  }
  return rows;
}

export function stripForClient(row) { const pub = publicItem(row); STRIP.forEach((k) => delete pub[k]); return pub; }
