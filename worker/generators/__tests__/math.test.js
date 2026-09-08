// Every maths generator: 3 tiers × 20 seeds → shape, determinism, variety, and an INDEPENDENT re-computation of the
// answer from item.params.check using this file's own evaluator (docs/03 §3, BRIEF §8 Phase 2 acceptance).
import { describe, it, expect } from 'vitest';
import { registry } from '../math/index.js';
import { rngFor } from '../../src/rng.js';
import { markRule } from '../../src/marking.js';

// --- independent arithmetic: recursive-descent parser, no shared code with generators or marking.js
function evaluate(src) {
  const s = String(src).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/,(?=\d{3}\b)/g, '');
  let i = 0;
  const peek = () => s[i], next = () => s[i++];
  function number() {
    if (peek() === '(') { next(); const v = expr(); if (next() !== ')') throw new Error('paren'); return v; }
    if (peek() === '-') { next(); return -number(); }
    const fn = /^(floor|ceil|round)\(/.exec(s.slice(i));
    if (fn) { i += fn[1].length + 1; const v = expr(); if (next() !== ')') throw new Error('fn'); return Math[fn[1]](v); }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (!m) throw new Error('num at ' + i + ' in ' + s); i += m[0].length; return Number(m[0]);
  }
  function term() { let v = number(); while (peek() === '*' || peek() === '/') { const op = next(); const r = number(); v = op === '*' ? v * r : v / r; } return v; }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  const v = expr(); if (i !== s.length) throw new Error('trailing in ' + s); return v;
}
const parseNum = (t) => {
  t = String(t).trim().replace(/,(?=\d{3}\b)/g, '');
  let m;
  if ((m = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(t))) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if ((m = /^(-?\d+)\/(\d+)$/.exec(t))) return Number(m[1]) / Number(m[2]);
  if ((m = /^10\^(\d+)$/.exec(t))) return 10 ** Number(m[1]);
  return Number(t);
};
const close = (a, b) => Math.abs(a - b) < 1e-6;
const LETTERS = 'ABCDEFGH';

const verify = {
  expr: (it, c) => close(parseNum(it.answer), evaluate(c.expr)),
  multi: (it, c) => { const parts = String(it.answer).split(';').map((x) => x.trim()); return parts.length === c.exprs.length && parts.every((p, k) => close(parseNum(p), evaluate(c.exprs[k]))); },
  divrem: (it, c) => it.answer === `${Math.floor(c.a / c.b)} r ${c.a % c.b}` && c.a % c.b !== 0,
  sort: (it, c) => { const want = c.labels.map((l, k) => [l, c.values[k]]).sort((x, y) => x[1] - y[1]).map((x) => x[0]); return JSON.stringify(it.answer) === JSON.stringify(want) && new Set(c.values).size === c.values.length; },
  set: (it, c) => { const chosen = it.answer.map((L) => it.options[LETTERS.indexOf(L)]); return chosen.length === c.correct.length && c.correct.every((x) => chosen.includes(x)); },
  choice: (it, c) => it.options[LETTERS.indexOf(it.answer)] === c.correct && new Set(it.options).size === it.options.length,
  exprtext: (it, c) => close(evaluate(it.answer), c.value),
  factorcount: (it, c) => { let k = 0; for (let d = 1; d <= c.n; d++) if (c.n % d === 0) k++; return Number(it.answer) === k; },
  text: () => true,
};

describe('maths generators registry', () => {
  it('covers every maths skill in data/skills_math_ccss.json', async () => {
    const { readFileSync } = await import('node:fs');
    const ids = JSON.parse(readFileSync(new URL('../../../data/skills_math_ccss.json', import.meta.url), 'utf8')).skills.map((s) => s.id);
    for (const id of ids) expect(registry[id], `missing generator for ${id}`).toBeDefined();
    expect(Object.keys(registry)).toHaveLength(ids.length);
  });
});

for (const [id, gen] of Object.entries(registry)) {
  describe(`generator ${id}`, () => {
    for (const tier of [1, 2, 3]) {
      it(`tier ${tier}: 20 seeded items are well-formed, deterministic, varied and independently verified`, () => {
        const stems = new Set();
        for (let seed = 0; seed < 20; seed++) {
          const item = gen.generate(tier, rngFor(id, tier, seed));
          expect(item.stem, `${id} t${tier} s${seed} stem`).toBeTruthy();
          expect(['numeric', 'mc4', 'multi_select', 'ordering', 'fill_blank']).toContain(item.format);
          expect(item.answer, `${id} t${tier} s${seed} answer`).toBeDefined();
          if (item.format === 'mc4') { expect(item.options).toHaveLength(4); expect(item.answer).toMatch(/^[A-D]$/); }
          const c = item.params?.check;
          expect(c, `${id} t${tier} s${seed} has params.check`).toBeDefined();
          expect(verify[c.type], `unknown check type ${c.type}`).toBeDefined();
          expect(verify[c.type](item, c), `${id} t${tier} s${seed} independent check failed: ${item.stem} → ${JSON.stringify(item.answer)} (${JSON.stringify(c)})`).toBe(true);
          // the item's own answer must be accepted by the rule marker
          if (item.format !== 'fill_blank' || item.params.check.type !== 'text') {
            const mark = markRule({ ...item, tier }, item.answer);
            expect(mark?.correct, `${id} t${tier} s${seed} self-mark: ${item.stem} → ${JSON.stringify(item.answer)}`).toBe(true);
          }
          const again = gen.generate(tier, rngFor(id, tier, seed));
          expect(again).toEqual(item);
          stems.add(item.stem + '|' + (item.options || []).join('|'));
        }
        expect(stems.size, `${id} t${tier} variety`).toBeGreaterThanOrEqual(5);
      });
    }
  });
}
