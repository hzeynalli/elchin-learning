// 5.MP.1 — Choose a strategy, show working, estimate first, check reasonableness, explain reasoning (MP1/MP3/MP6)
import { ri, pick, fmt, mc4, chance, NAMES } from '../lib.js';
const round10 = (n) => Math.round(n / 10) * 10, round100 = (n) => Math.round(n / 100) * 100;

export function generate(tier, rng) {
  const name = pick(rng, NAMES);
  if (tier === 1) {
    const a = ri(rng, 21, 89), b = ri(rng, 12, 48);
    const est = round10(a) * round10(b);
    const m = mc4(rng, fmt(est), [{ v: fmt(est * 10), why: 'one zero too many' }, { v: fmt(Math.round(est / 10)), why: 'one zero too few' }, { v: fmt(round10(a) + round10(b)), why: 'added instead of multiplied' }]);
    return { ...m, stem: `Estimate ${a} × ${b} by rounding each number to the nearest ten.`, working: `${a} → ${round10(a)}, ${b} → ${round10(b)}.`, explanation: `${round10(a)} × ${round10(b)} = ${fmt(est)}.` };
  }
  if (tier === 2) {
    const a = ri(rng, 12, 48), b = ri(rng, 210, 490);
    const exact = a * b, est = round10(a) * round100(b);
    const reasonable = chance(rng, 0.5);
    const claim = reasonable ? exact : (chance(rng, 0.5) ? exact * 10 : Math.round(exact / 10));
    const correct = reasonable ? `Yes — ${round10(a)} × ${round100(b)} ≈ ${fmt(est)}, so ${fmt(claim)} is close.` : `No — ${round10(a)} × ${round100(b)} ≈ ${fmt(est)}, so ${fmt(claim)} is far off.`;
    const m = mc4(rng, correct, [
      { v: reasonable ? `No — ${round10(a)} × ${round100(b)} ≈ ${fmt(est)}, so ${fmt(claim)} is far off.` : `Yes — ${round10(a)} × ${round100(b)} ≈ ${fmt(est)}, so ${fmt(claim)} is close.`, why: 'compare the estimate with the answer' },
      { v: `Yes — you cannot check without a calculator.`, why: 'an estimate is a check' },
      { v: `No — the answer to a multiplication must end in 0.`, why: 'not a rule' }]);
    return { ...m, stem: `${name} worked out ${a} × ${b} and got ${fmt(claim)}. Is that reasonable? Use an estimate.`, working: 'Round both numbers and multiply in your head.', explanation: correct };
  }
  const tasks = [
    { q: (x, y) => `${x} × ${y}`, best: (x) => `Split ${x} into ${Math.floor(x / 10) * 10} and ${x % 10}, multiply each, add`, others: ['Add the number over and over', 'Guess, then check with a calculator', 'Multiply only the first digits'] },
    { q: (x, y) => `${x * y} ÷ ${y}`, best: (x, y) => `Ask "what times ${y} makes ${x * y}?"`, others: ['Subtract ' + 'the divisor once', 'Divide the digits separately', 'Guess a number'] },
  ];
  const t = pick(rng, tasks), x = ri(rng, 23, 89), y = ri(rng, 3, 9);
  const m = mc4(rng, t.best(x, y), t.others.map((o) => ({ v: o, why: 'not a reliable strategy' })));
  return { ...m, stem: `Which is the best first step to work out ${t.q(x, y)}?`, working: 'Good strategies use place value or a known fact.', explanation: t.best(x, y) + '.' };
}
