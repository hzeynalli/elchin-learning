#!/usr/bin/env node
// Runs the readability check (docs/03 §4) and question-set sanity checks over every data/passages/*.json.
// Exit 1 if any passage or question fails — used before seeding and in CI.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkPassage } from '../worker/src/readability.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'data/passages');
const REQUIRED = ['RD.RL.1|RD.RI.1', 'RD.RL.2|RD.RI.2', 'RD.V.1|RD.RI.4'];
let bad = 0, total = 0, questions = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const p of d.passages || []) {
    total++;
    const tier = Math.max(...p.questions.map((q) => q.tier));
    const c = checkPassage(p.text, { tier: tier >= 3 ? 3 : 2 });
    const probs = [...c.problems];
    if (!p.id || !p.title || !p.origin || !p.genre) probs.push('missing id/title/origin/genre');
    if (p.questions.length < 5 || p.questions.length > 6) probs.push(`${p.questions.length} questions (need 5–6)`);
    for (const need of REQUIRED) if (!p.questions.some((q) => need.split('|').includes(q.skill_id))) probs.push(`no question for ${need}`);
    if (!p.questions.some((q) => q.format === 'short_text')) probs.push('no short_text "quote the sentence" item');
    for (const q of p.questions) {
      questions++;
      if (!q.skill_id || !q.tier || !q.stem || !q.format) probs.push(`question missing fields: ${(q.stem || '').slice(0, 40)}`);
      if (q.format === 'mc4') {
        if (!Array.isArray(q.options) || q.options.length !== 4) probs.push(`mc4 needs 4 options: ${q.stem.slice(0, 40)}`);
        else if (new Set(q.options).size !== 4) probs.push(`duplicate options: ${q.stem.slice(0, 40)}`);
        if (!/^[A-D]$/.test(q.answer)) probs.push(`mc4 answer must be A–D: ${q.stem.slice(0, 40)}`);
        if (!q.explanation) probs.push(`mc4 without explanation: ${q.stem.slice(0, 40)}`);
      }
      if (q.format === 'short_text') {
        if (!q.rubric) probs.push(`short_text without rubric: ${q.stem.slice(0, 40)}`);
        const quoted = (q.rubric.match(/"([^"]{12,})"/g) || []).map((s) => s.replace(/"/g, ''));
        for (const s of quoted) if (!p.text.includes(s)) probs.push(`rubric quote not found in text: "${s.slice(0, 40)}…"`);
      }
    }
    const line = `${p.id.padEnd(5)} ${p.title.padEnd(34).slice(0, 34)} ${String(c.words).padStart(3)}w FK ${String(c.fk_grade).padStart(4)} msl ${String(c.mean_sentence_len).padStart(4)}`;
    if (probs.length) { bad++; console.log(`✗ ${line}\n    ${probs.join('\n    ')}`); } else console.log(`✓ ${line}`);
  }
}
console.log(`\n${total} passages, ${questions} questions, ${bad} failing`);
process.exit(bad ? 1 : 0);
