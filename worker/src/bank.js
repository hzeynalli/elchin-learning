// Item bank (BRIEF §6, docs/03 §4–6, §8): a verified buffer of ≥ 10 unused items per (skill, tier) for every
// non-maths skill, refilled by the 15-minute cron and topped up after submits. Every LLM item passes a second
// verification call ("is the marked answer the only correct one?") before it is usable. Maths never touches this.
import genPrompt from '../prompts/generate_items_prompt.md';
import { llm, BudgetExceeded } from './anthropic.js';
import { stemHash, itemKey, isDuplicate } from './items.js';
import { checkPassage } from './readability.js';

export const MIN_STOCK = 10;
const FORMATS = { 'Language Usage': ['mc4', 'fill_blank', 'short_text'], Science: ['mc4', 'short_text'], Reading: ['mc4', 'short_text'] };
const STYLES = { 'Language Usage': 'IXL-like', Science: 'NAEP', Reading: 'Smarter Balanced' };
const CONTEXTS = ['school', 'sport', 'animals', 'Baku places', 'recipes', 'space', 'the sea', 'a market'];
const NAMES = ['Elchin', 'Aysel', 'Rasim', 'Leyla', 'Nigar', 'Murad', 'Sara', 'Omar'];

const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));

function validItem(it, format) {
  if (!it || typeof it.stem !== 'string' || it.stem.length < 8) return false;
  if (!it.explanation) return false;
  if (it.format === 'mc4') return Array.isArray(it.options) && it.options.length === 4 && new Set(it.options).size === 4 && /^[A-D]$/.test(String(it.answer));
  if (it.format === 'short_text') return !!it.rubric || !!it.answer;
  if (it.format === 'fill_blank') return it.answer != null && String(it.answer).length > 0;
  if (it.format === 'multi_select') return Array.isArray(it.options) && Array.isArray(it.answer) && it.answer.length >= 1;
  if (it.format === 'ordering') return Array.isArray(it.options) && Array.isArray(it.answer);
  return false;
}

/** Generate n verified items for one (skill, tier). Returns the number stored. */
export async function generateBankItems(env, repo, { skill, tier, n = 5, passage = null }) {
  const formats = FORMATS[skill.subject] || ['mc4'];
  const format = formats[(tier + n) % formats.length];
  const [recentHashes, bankHashes] = await Promise.all([repo.recentStemHashes(skill.id, 300), repo.bankStems(skill.id)]);
  const [system, user] = genPrompt.split(/\n\s*User:\s*\n/);
  const [genSystem] = system.replace(/^#.*\n/, '').split('\n').filter(Boolean).join(' ').split('User:');
  const prompt = fill(user.split('# Verification prompt')[0], {
    skill_name: skill.name, standard: skill.standard || '', subject: skill.subject, tier, format, n, source_style: STYLES[skill.subject] || 'IXL-like',
    context: CONTEXTS[(tier * 7 + n) % CONTEXTS.length], names: NAMES.slice(0, 4).join(', '), recent_stems: '(none listed — the Worker checks hashes)',
    passage_block: passage ? `Passage (all items must be answerable from it):\n"""\n${passage.text}\n"""` : '',
  });
  const res = await llm(env, repo, { purpose: 'generate', model: env.MODEL_GEN, system: genSystem.replace('System:', '').trim(), messages: [{ role: 'user', content: prompt }], max_tokens: 4000, json: true, effort: 'medium' });
  const items = Array.isArray(res.json) ? res.json : Array.isArray(res.json?.items) ? res.json.items : [];
  const rows = [];
  for (const raw of items) {
    const it = { ...raw, format: raw.format || format };
    if (!validItem(it, format)) continue;
    const key = stemHash(itemKey(it));                                          // same identity the bank and test_items use
    if (recentHashes.includes(key) || bankHashes.includes(key) || isDuplicate(it.stem, [], rows.map((r) => r.item.stem))) continue;
    // second call, cold: is the marked answer the only correct one?
    let verification = { ok: true, reason: 'mock' };
    const ver = await llm(env, repo, { purpose: 'verify', model: env.MODEL_GEN, system: 'You check assessment items. Reply with JSON only.', messages: [{ role: 'user', content: `Check this item. Is the marked answer the only correct answer, and is the explanation correct? Reply JSON: {"ok": true|false, "reason": "..."}. Item: ${JSON.stringify(it)}` }], max_tokens: 300, json: true, effort: 'low' });
    verification = ver.json && typeof ver.json.ok === 'boolean' ? ver.json : { ok: false, reason: 'no verdict' };
    if (!verification.ok) continue;
    const item = { ...it, skill_id: skill.id, tier, generated_by: 'llm', source_style: STYLES[skill.subject] || 'IXL-like', verification: { ...verification, model: env.MODEL_GEN, at: new Date().toISOString() }, ...(passage ? { passage: passage.text, passage_id: passage.id, passage_title: passage.title } : {}) };
    rows.push({ skill_id: skill.id, tier, format: it.format, item, stem_hash: key, verified: true, used: false });
  }
  if (rows.length) await repo.bankInsert(rows);
  return rows.length;
}

/** Refill every non-maths skill below MIN_STOCK, priority-1 first. Budget-aware. */
export async function refillBank(env, repo, { min = MIN_STOCK, perCall = 5, maxCalls = 12 } = {}) {
  const skills = (await repo.getSkills()).filter((s) => s.subject !== 'Mathematics').sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const passages = await repo.getPassages().catch(() => []);
  const summary = { generated: 0, calls: 0, skipped: [], stopped: null };
  for (const skill of skills) {
    for (const tier of [1, 2, 3]) {
      if (summary.calls >= maxCalls) { summary.stopped = 'maxCalls'; return summary; }
      const count = await repo.bankCount(skill.id, tier);
      if (count >= min) continue;
      const passage = skill.subject === 'Reading' && passages.length ? passages[(summary.calls + tier) % passages.length] : null;
      try {
        summary.calls++;
        summary.generated += await generateBankItems(env, repo, { skill, tier, n: Math.min(perCall, min - count), passage });
      } catch (e) {
        if (e instanceof BudgetExceeded) { summary.stopped = 'budget'; return summary; }
        summary.skipped.push(`${skill.id} t${tier}: ${e.message}`);
      }
    }
  }
  return summary;
}

/** Load hand-written content (data/items/*.json, data/passages/*.json) into the bank. Idempotent by stem hash. */
export async function seedFromData(repo, { items = [], passages = [] }) {
  const out = { items: 0, passages: 0, rejected: [] };
  for (const p of passages) {
    const c = checkPassage(p.text, { tier: Math.max(...p.questions.map((q) => q.tier)) >= 3 ? 3 : 2 });
    if (!c.ok) { out.rejected.push(`${p.id}: ${c.problems.join('; ')}`); continue; }
    const existing = (await repo.getPassages()).find((x) => x.title === p.title);
    const id = existing?.id || (await repo.insertPassages([{ title: p.title, author: p.author || 'Elchin Learning (original)', origin: p.origin, genre: p.genre, topic: p.topic, text: p.text, word_count: c.words, fk_grade: c.fk_grade, lexile_est: c.lexile_est, questions: p.questions }]))[0].id;
    if (!existing) out.passages++;
    for (const q of p.questions) items.push({ ...q, passage_id: id, passage_title: p.title, generated_by: 'human' });   // text attached at serve time
  }
  const rows = [];
  const seen = new Map();
  for (const it of items) {
    const key = it.skill_id;
    if (!seen.has(key)) seen.set(key, new Set(await repo.bankStems(key)));
    const h = stemHash(itemKey(it));
    if (seen.get(key).has(h)) continue;
    seen.get(key).add(h);
    const { skill_id, tier, ...rest } = it;
    rows.push({ skill_id, tier, format: it.format, item: { ...rest, skill_id, tier, generated_by: it.generated_by || 'human', verification: { ok: true, reason: 'hand-written, owner-reviewed' } }, stem_hash: h, verified: true, used: false });
  }
  if (rows.length) { await repo.bankInsert(rows); out.items = rows.length; }
  return out;
}

export const bankRoutes = {
  'POST /admin/refill-bank': async ({ env, repo, body }) => refillBank(env, repo, { maxCalls: Number(body?.max_calls || 12) }),
  /** Load the bundled hand-written content (data/passages, data/items) into the live bank. Idempotent. */
  'POST /admin/seed': async ({ repo }) => {
    const [fables, informational, luGM, luW, sci] = await Promise.all([
      import('../../data/passages/fables.json', { with: { type: 'json' } }), import('../../data/passages/informational.json', { with: { type: 'json' } }),
      import('../../data/items/lu_grammar_mechanics.json', { with: { type: 'json' } }), import('../../data/items/lu_writing.json', { with: { type: 'json' } }), import('../../data/items/science.json', { with: { type: 'json' } }),
    ]);
    return seedFromData(repo, { passages: [...fables.default.passages, ...informational.default.passages], items: [...luGM.default.items, ...luW.default.items, ...sci.default.items] });
  },
  'GET /bank/status': async ({ repo }) => {
    const skills = (await repo.getSkills()).filter((s) => s.subject !== 'Mathematics');
    const rows = [];
    for (const s of skills) { const counts = []; for (const t of [1, 2, 3]) counts.push(await repo.bankCount(s.id, t)); rows.push({ skill_id: s.id, subject: s.subject, priority: s.priority, name: s.name, stock: counts }); }
    return { min: MIN_STOCK, skills: rows };
  },
};
