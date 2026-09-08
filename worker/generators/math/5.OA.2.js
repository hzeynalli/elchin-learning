// 5.OA.2 — Write and interpret numerical expressions from words without evaluating (5.OA.A.2)
import { ri, pick, mc4, chance } from '../lib.js';

export function generate(tier, rng) {
  const a = ri(rng, 3, 20), b = ri(rng, 2, 12), c = ri(rng, 2, 9);
  const forms = [
    { words: `the sum of ${a} and ${b}, multiplied by ${c}`, expr: `(${a} + ${b}) × ${c}`, value: (a + b) * c, wrong: [`${a} + ${b} × ${c}`, `${a} × ${c} + ${b}`, `(${a} × ${b}) + ${c}`] },
    { words: `subtract ${b} from ${a + b}, then multiply by ${c}`, expr: `(${a + b} − ${b}) × ${c}`, value: a * c, wrong: [`${a + b} − ${b} × ${c}`, `${b} − ${a + b} × ${c}`, `(${a + b} − ${c}) × ${b}`] },
    { words: `${c} times the difference between ${a + b} and ${b}`, expr: `${c} × (${a + b} − ${b})`, value: c * a, wrong: [`${c} × ${a + b} − ${b}`, `${c} × (${b} − ${a + b})`, `(${c} × ${a + b}) − ${b}`] },
    { words: `add ${a} to the product of ${b} and ${c}`, expr: `${a} + ${b} × ${c}`, value: a + b * c, wrong: [`(${a} + ${b}) × ${c}`, `${a} × ${b} + ${c}`, `${a} + ${b} + ${c}`] },
    { words: `divide ${a * b} by ${b}, then add ${c}`, expr: `${a * b} ÷ ${b} + ${c}`, value: a + c, wrong: [`${a * b} ÷ (${b} + ${c})`, `${b} ÷ ${a * b} + ${c}`, `${a * b} + ${b} ÷ ${c}`] },
  ];
  const f = pick(rng, forms);
  if (tier === 1) {
    const m = mc4(rng, f.expr, f.wrong.map((w) => ({ v: w, why: 'does not match the order of the words' })));
    return { ...m, stem: `Which expression means "${f.words}"?`, working: 'Find the first thing the words do; that goes in brackets if something else happens to the result.', explanation: `"${f.words}" is ${f.expr}.` };
  }
  if (tier === 2) {
    return { format: 'fill_blank', stem: `Write as a numerical expression (do not solve): ${f.words}.`, answer: f.expr, accept: [f.expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')], params: { check: { type: 'exprtext', value: f.value } }, working: 'Use brackets for the part that happens first.', explanation: `${f.expr}` };
  }
  if (chance(rng, 0.5)) {
    const big = ri(rng, 1000, 9999), small = ri(rng, 100, 999), k = ri(rng, 2, 5);
    const m = mc4(rng, `It is ${k} times as large.`, [{ v: `It is ${k} more.`, why: 'multiplying by ' + k + ' scales, it does not add ' + k }, { v: `It is the same.`, why: 'the bracket is multiplied by ' + k }, { v: `It is ${k} times smaller.`, why: 'multiplying makes it larger' }]);
    return { ...m, stem: `Without calculating: how does ${k} × (${big} + ${small}) compare with ${big} + ${small}?`, working: 'The bracket is the same in both; one is multiplied by ' + k + '.', explanation: `${k} × (a number) is ${k} times as large as that number.` };
  }
  const m = mc4(rng, f.words.charAt(0).toUpperCase() + f.words.slice(1), forms.filter((x) => x !== f).slice(0, 3).map((x) => ({ v: x.words.charAt(0).toUpperCase() + x.words.slice(1), why: 'describes ' + x.expr })));
  return { ...m, stem: `Which words describe the expression ${f.expr}?`, working: 'Read the brackets first, then what happens to them.', explanation: `${f.expr} means: ${f.words}.` };
}
