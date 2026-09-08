// Adaptive diagnostic planner — docs/02 §1. Pure functions over a JSON `plan` stored in tests.plan.
// Per skill: ask ≥ 4, ≤ 8 items, start at tier 2; 4/4 → stop (secure candidate); 3 wrong in first 4 → stop (not yet);
// otherwise continue to 8. Wrong → next item one tier lower (min 1); right → one tier higher (max 3).
// Sittings: max 25 items, resumable; interleaved across skills; prerequisite gating pulls in Grade-4 prerequisites
// that have no data when a Grade-5 skill fails.

export const DIAG = { min: 4, max: 8, sitting_cap: 25, start_tier: 2 };

export function createPlan({ skills, states = {}, scope = 'A', skill_ids = null, kind = 'diagnostic' }) {
  let chosen = skills;
  if (skill_ids) chosen = skills.filter((s) => skill_ids.includes(s.id));
  else if (scope === 'A') chosen = skills.filter((s) => s.priority === 1);
  else if (scope === 'B') chosen = skills.filter((s) => s.priority >= 2);
  return {
    kind, scope,
    skills: chosen.map((s) => entry(s.id)),
    sitting_items: 0, total_items: 0, last_skill: null, gated: [],
  };
}
const entry = (id) => ({ id, asked: 0, correct: 0, wrong: 0, tier: DIAG.start_tier, done: false, result: null, history: [] });

/** Next item to serve, or a completion marker. */
export function nextSpec(plan, opts = {}) {
  const open = plan.skills.filter((s) => !s.done);
  if (open.length === 0) return { test_complete: true };
  if (plan.sitting_items >= (opts.sitting_cap ?? DIAG.sitting_cap)) return { sitting_complete: true };
  let pool = open.length > 1 ? open.filter((s) => s.id !== plan.last_skill) : open;
  const minAsked = Math.min(...pool.map((s) => s.asked));
  const s = pool.find((x) => x.asked === minAsked);           // fewest-asked first, original order as tie-break
  return { skill_id: s.id, tier: s.tier };
}

/** Record an answer; applies stop rules and tier movement; returns the updated plan (mutated for convenience). */
export function recordAnswer(plan, { skill_id, correct, tier }, ctx = {}) {
  const s = plan.skills.find((x) => x.id === skill_id);
  if (!s || s.done) return plan;
  s.asked++; s.history.push({ tier: tier ?? s.tier, correct: !!correct });
  if (correct) { s.correct++; s.tier = Math.min(3, s.tier + 1); } else { s.wrong++; s.tier = Math.max(1, s.tier - 1); }
  plan.sitting_items++; plan.total_items++; plan.last_skill = skill_id;
  if (s.asked === DIAG.min && s.correct === DIAG.min) { s.done = true; s.result = 'secure_candidate'; }
  else if (s.asked <= DIAG.min && s.wrong >= 3) { s.done = true; s.result = 'not_yet'; }
  else if (s.asked >= DIAG.max) { s.done = true; s.result = 'by_rate'; }
  if (s.done && s.result === 'not_yet') gatePrerequisites(plan, s.id, ctx);
  return plan;
}

/** Prerequisite gating: when a Grade-5 skill fails, add its prerequisites that have no evidence yet. */
function gatePrerequisites(plan, skillId, { skills = [], states = {} }) {
  const sk = skills.find((x) => x.id === skillId);
  if (!sk || sk.grade !== 5) return;
  for (const p of sk.prerequisites || []) {
    const hasData = states[p] && (states[p].attempts > 0 || states[p].status !== 'not_yet');
    if (!hasData && !plan.skills.some((x) => x.id === p)) { plan.skills.push(entry(p)); plan.gated.push({ from: skillId, added: p }); }
  }
}

export function startSitting(plan) { plan.sitting_items = 0; return plan; }

/** Per-skill evidence rows for mastery.recomputeSkillState. */
export function summarize(plan) {
  return plan.skills.filter((s) => s.asked > 0).map((s) => ({
    skill_id: s.id, items: s.asked, correct: s.correct, rate: s.asked ? s.correct / s.asked : null,
    tier3_correct: s.history.some((h) => h.tier === 3 && h.correct), result: s.result,
  }));
}

/** Targeted test: 15 items over not_yet/emerging skills, weighted by urgency (BRIEF §6). Returns [{skill_id, tier}]. */
export function targetedSpecs({ weak, count = 15, rng }) {
  // weak: [{skill_id, urgency, status}] — allocate items proportional to urgency, min 2 per chosen skill, tiers 1–3 mixed.
  const total = weak.reduce((a, w) => a + Math.max(1, w.urgency), 0) || 1;
  const alloc = weak.map((w) => ({ ...w, n: Math.max(2, Math.round((Math.max(1, w.urgency) / total) * count)) }));
  const specs = [];
  for (const a of alloc) for (let i = 0; i < a.n && specs.length < count * 2; i++) {
    const tier = a.status === 'not_yet' ? (i % 3 === 2 ? 2 : 1) : (i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3);
    specs.push({ skill_id: a.skill_id, tier });
  }
  // interleave: round-robin over skills
  const bySkill = new Map(); for (const s of specs) (bySkill.get(s.skill_id) ?? bySkill.set(s.skill_id, []).get(s.skill_id)).push(s);
  const out = []; while (out.length < count && [...bySkill.values()].some((q) => q.length)) for (const q of bySkill.values()) { if (q.length && out.length < count) out.push(q.shift()); }
  return out;
}
