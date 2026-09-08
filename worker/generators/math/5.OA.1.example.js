// Example generator: 5.OA.1 — evaluate expressions with parentheses/brackets, order of operations.
// The answer is computed in code. The LLM never touches it. rng is a seeded PRNG in [0,1).
export function generate(tier, rng) {
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  let expr, answer;
  if (tier === 1) {                      // a + b × c
    const a = ri(2, 20), b = ri(2, 9), c = ri(2, 9);
    expr = `${a} + ${b} × ${c}`; answer = a + b * c;
  } else if (tier === 2) {               // (a + b) × c − d  or  a ÷ (b + c) × d
    if (rng() < 0.5) { const a = ri(3, 30), b = ri(2, 20), c = ri(2, 6), d = ri(1, 15);
      expr = `(${a} + ${b}) × ${c} − ${d}`; answer = (a + b) * c - d; }
    else { const b = ri(2, 6), c = ri(1, 6), k = ri(2, 9), d = ri(2, 6); const a = (b + c) * k;
      expr = `${a} ÷ (${b} + ${c}) × ${d}`; answer = k * d; }
  } else {                               // [(a − b) ÷ c] + d × e   with a−b divisible by c
    const c = ri(2, 6), q = ri(2, 9), b = ri(1, 12), a = b + c * q, d = ri(2, 9), e = ri(2, 9);
    expr = `[(${a} − ${b}) ÷ ${c}] + ${d} × ${e}`; answer = q + d * e;
  }
  return {
    format: "numeric", tier,
    stem: `Work out ${expr}.`,
    answer: String(answer),
    working: `Brackets first, then × and ÷ left to right, then + and − left to right.`,
    misconception_distractors: tier >= 2 ? { left_to_right: null } : null // filled by test if mc4 needed
  };
}
