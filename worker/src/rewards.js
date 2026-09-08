// Points ledger with parent-defined rewards (AUDIT.md Judge 1 → BRIEF §8 Phase 1; docs/02 §3b).
// The app only counts. Points per correct answer are tier-weighted (1/2/3), +10 per completed loop, +5 per review day.
export const rewardsRoutes = {
  'POST /rewards': async ({ repo, studentId, body }) => {
    const name = String(body?.name || '').trim(), cost = Number(body?.cost);
    if (!name || !(cost > 0)) throw Object.assign(new Error('name and positive cost required'), { status: 400 });
    return repo.insertReward({ student_id: studentId, name, cost: Math.round(cost) });
  },
  'POST /rewards/delete': async ({ repo, body }) => { await repo.deleteReward(Number(body?.id)); return { ok: true }; },
  'POST /rewards/redeem': async ({ repo, studentId, body, now }) => {
    const rewards = await repo.getRewards(studentId);
    const r = rewards.find((x) => x.id === Number(body?.id) && !x.redeemed_at);
    if (!r) throw Object.assign(new Error('reward not found'), { status: 404 });
    const balance = (await repo.getPoints(studentId)).reduce((a, p) => a + p.delta, 0);
    if (balance < r.cost) throw Object.assign(new Error(`not enough points (${balance} < ${r.cost})`), { status: 400 });
    await repo.addPoints({ student_id: studentId, delta: -r.cost, reason: `reward: ${r.name}` });
    await repo.updateReward(r.id, { redeemed_at: now.toISOString() });
    return { ok: true, balance: balance - r.cost };
  },
  'POST /points': async ({ repo, studentId, body }) => {              // parent manual adjustment
    const delta = Math.round(Number(body?.delta)), reason = String(body?.reason || 'parent adjustment').slice(0, 120);
    if (!delta) throw Object.assign(new Error('delta required'), { status: 400 });
    return repo.addPoints({ student_id: studentId, delta, reason });
  },
};
