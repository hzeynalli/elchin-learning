// G4.OA.1 — Factors, multiples, prime and composite to 100 (4.OA.B.4)
import { ri, pick, shuffle, isPrime, factors, lcm, mc4, numeric, chance } from '../lib.js';

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const smallFactor = (n) => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return i; return null; };

export function generate(tier, rng) {
  if (tier === 1) {
    const p = pick(rng, PRIMES.filter((x) => x > 5));
    const comps = new Set(); while (comps.size < 3) { const c = ri(rng, 6, 99); if (!isPrime(c) && c !== p) comps.add(c); }
    const m = mc4(rng, p, [...comps].map((c) => ({ v: c, why: `composite: ${smallFactor(c)} × ${c / smallFactor(c)}` })));
    return { ...m, tier, stem: 'Which of these numbers is prime?', working: 'A prime has exactly two factors: 1 and itself. Try dividing by 2, 3, 5, 7.', explanation: `${p} has no factors except 1 and ${p}. The others can be split into two smaller factors.` };
  }
  if (tier === 2) {
    const n = pick(rng, [12, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48, 50, 54, 56, 60, 63, 64, 72]);
    const fs = factors(n).filter((f) => f > 1 && f < n);
    const correct = shuffle(rng, fs).slice(0, 3);
    const wrong = new Set(); while (wrong.size < 3) { const w = ri(rng, 2, n - 1); if (n % w !== 0) wrong.add(w); }
    const options = shuffle(rng, [...correct, ...wrong]).map(String);
    const answer = options.map((o, i) => (correct.includes(Number(o)) ? 'ABCDEF'[i] : null)).filter(Boolean);
    return { format: 'multi_select', tier, stem: `Select ALL the numbers that are factors of ${n}.`, options, answer, params: { check: { type: 'set', correct: correct.map(String) } }, working: `A factor divides ${n} with no remainder. Test each option.`, explanation: `Factors of ${n}: ${factors(n).join(', ')}.` };
  }
  if (chance(rng, 0.5)) {
    const a = pick(rng, [4, 6, 8, 9, 10, 12]), b = pick(rng, [6, 8, 9, 10, 12, 15].filter((x) => x !== a));
    return numeric(`What is the smallest number that is a multiple of both ${a} and ${b}?`, lcm(a, b), `${a * b}/${(function g(x, y) { return y ? g(y, x % y) : x; })(a, b)}`, { tier, working: `List multiples of ${a} and of ${b}; find the first one in both lists.`, explanation: `Multiples of ${a}: ${[1, 2, 3, 4, 5, 6].map((k) => a * k).join(', ')}… The first shared one is ${lcm(a, b)}.` });
  }
  const n = pick(rng, [24, 30, 36, 40, 48, 60, 72, 84, 90, 96]);
  return numeric(`How many factors does ${n} have in total (including 1 and ${n})?`, factors(n).length, String(factors(n).length), { tier, working: 'Find factor pairs: 1 × n, 2 × …, until the pairs meet in the middle.', explanation: `Factors of ${n}: ${factors(n).join(', ')} — ${factors(n).length} of them.`, params: { check: { type: 'factorcount', n } } });
}
