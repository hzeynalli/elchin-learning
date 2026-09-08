// Effort from in-app telemetry (docs/07 §2). Events: {kind: visible|hidden|idle|active|answer|coach_turn, at}.
// Active time = tab visible AND an answer/coach turn/activity within the last idle_s seconds.

export function activeSeconds(events, { idle_s = 90, now = null } = {}) {
  const ev = [...(events || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
  if (ev.length === 0) return 0;
  let visible = true, lastAction = null, active = 0;
  const end = now ? new Date(now).getTime() : new Date(ev[ev.length - 1].at).getTime();
  for (let i = 0; i < ev.length; i++) {
    const t = new Date(ev[i].at).getTime();
    const tNext = i + 1 < ev.length ? new Date(ev[i + 1].at).getTime() : end;
    const k = ev[i].kind;
    if (k === 'visible') visible = true;
    else if (k === 'hidden') visible = false;
    else if (k === 'idle') lastAction = null;
    else if (k === 'answer' || k === 'coach_turn' || k === 'active') lastAction = t;
    if (visible && lastAction != null) {
      const window = Math.max(0, idle_s * 1000 - (t - lastAction));      // remaining active window at time t
      active += Math.min(tNext - t, window);
    }
  }
  return Math.round(active / 1000);
}

export function sessionStats(events, opts = {}) {
  const ev = [...(events || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
  if (ev.length === 0) return { active_s: 0, elapsed_s: 0, focus_ratio: 0, answers: 0 };
  const elapsed = Math.round((new Date(opts.now ?? ev[ev.length - 1].at) - new Date(ev[0].at)) / 1000);
  const active = activeSeconds(ev, opts);
  const answers = ev.filter((e) => e.kind === 'answer').length;
  return { active_s: active, elapsed_s: elapsed, focus_ratio: elapsed ? Math.round((active / elapsed) * 100) / 100 : 0, answers };
}
