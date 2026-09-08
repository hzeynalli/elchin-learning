// GET /dashboard — everything the front-end needs in one call (BRIEF §6, §7; docs/07 §3 KPIs).
import { urgencyScore } from './mastery.js';
import { dueSkills } from './scheduler.js';
import { activeSeconds } from './telemetry.js';
import { learnAheadFor } from './year.js';
import units from '../../data/qsi_engaged_units.json' with { type: 'json' };

const DAY = 86400000;
const isSecure = (s) => s === 'secure' || s === 'mastered';
const iso = (d) => new Date(d).toISOString();

export async function dashboard({ repo, profile, studentId, env, now = new Date() }) {
  const nowIso = iso(now);
  const weekAgo = iso(now.getTime() - 7 * DAY), twoWeeksAgo = iso(now.getTime() - 14 * DAY);
  const [skills, states, points, rewards, answered, telemetry, secureEvents, sessions, mapResults, student] = await Promise.all([
    repo.getSkills(), repo.getSkillStates(studentId), repo.getPoints(studentId), repo.getRewards(studentId),
    repo.getAnsweredSince(studentId, weekAgo), repo.getTelemetry(studentId, weekAgo), repo.getEvents(studentId, twoWeeksAgo, 'skill_secure'),
    repo.getCoachSessions(studentId, { limit: 10 }), repo.getMapResults(studentId), profile.role === 'parent' ? repo.getProfile(studentId) : Promise.resolve(profile),
  ]);
  const stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  const rows = skills.map((sk) => ({ ...sk, state: stateBy[sk.id] || { status: 'not_yet', attempts: 0 } }));
  const statusOf = Object.fromEntries(rows.map((r) => [r.id, r.state.status]));

  // urgency (BRIEF §7)
  const dependents = {};
  for (const r of rows) if (!isSecure(r.state.status)) for (const p of r.prerequisites || []) dependents[p] = (dependents[p] || 0) + 1;
  const urgency = rows.map((r) => {
    const overdue = r.state.next_review_at ? Math.max(0, (now.getTime() - new Date(r.state.next_review_at).getTime()) / DAY) : 0;
    return { id: r.id, name: r.name, subject: r.subject, priority: r.priority, status: r.state.status, last_rate: r.state.last_rate,
      score: urgencyScore({ priority: r.priority, status: r.state.status, dependents_not_secure: dependents[r.id] || 0, days_overdue: Math.round(overdue) }) };
  }).filter((u) => u.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // headline metrics
  const due = new Date(env.DUE_DATE || '2026-10-01T00:00:00+04:00');
  const p1 = rows.filter((r) => r.priority === 1), p1Secure = p1.filter((r) => isSecure(r.state.status)).length;
  const daysToDue = Math.ceil((due.getTime() - now.getTime()) / DAY);
  const velocityPerWeek = secureEvents.length / 2;                                  // secure transitions in the last 14 days
  const remaining = p1.length - p1Secure;
  const projectedDate = remaining === 0 ? nowIso : velocityPerWeek > 0 ? iso(now.getTime() + (remaining / velocityPerWeek) * 7 * DAY) : null;
  const activeMin = Math.round(activeSeconds(telemetry, { now }) / 60);
  const minutesFromTests = Math.round(answered.reduce((a, i) => a + (Number(i.time_s) || 0), 0) / 60);
  const minutesThisWeek = Math.max(activeMin, minutesFromTests);
  const target = Number(student?.settings?.daily_minutes || 50) * 7;
  const balance = points.reduce((a, p) => a + p.delta, 0);
  const daysActive = new Set(answered.map((i) => (i.answered_at || '').slice(0, 10)));
  let streak = 0; for (let d = 0; d < 60; d++) { const day = new Date(now.getTime() - d * DAY).toISOString().slice(0, 10); if (daysActive.has(day) || (d === 0 && streak === 0 && false)) streak++; else if (d > 0) break; }
  const guessing = answered.filter((i) => i.correct === false && i.time_s != null && i.time_s < 8).length;

  // QSI unit rollup (labels only — docs/01)
  const tracked = (units.units || []).filter((u) => u.track);
  const qsi = tracked.map((u) => { const us = rows.filter((r) => r.qsi_unit === u.id); const sec = us.filter((r) => isSecure(r.state.status)).length; return { id: u.id, course: u.course, unit: u.unit, due: u.due, skills: us.length, secure: sec, pct: us.length ? Math.round((100 * sec) / us.length) : null }; });

  // today plan (Phase 1 shape; Phase 4 fills the fixed daily order)
  const reviewDue = dueSkills(states, nowIso).map((s) => s.skill_id);
  const learnAhead = learnAheadFor(skills, statusOf, nowIso).map((id) => ({ id, name: rows.find((r) => r.id === id)?.name || id }));
  const today = { urgent: urgency.slice(0, 3), review_due: reviewDue.slice(0, 10), learn_ahead: learnAhead };
  // retention rate (docs/07 §3): mastered skills that held vs those that regressed in the last 30 days
  const regressed30 = (await repo.getEvents(studentId, iso(now.getTime() - 30 * DAY), 'skill_regressed')).length;
  const masteredNow = rows.filter((r) => r.state.status === 'mastered').length;
  const retention = masteredNow + regressed30 ? Math.round((100 * masteredNow) / (masteredNow + regressed30)) / 100 : null;

  return {
    now: nowIso, role: profile.role, student: { id: studentId, name: student?.display_name || 'Elchin', settings: student?.settings || {} },
    metrics: { p1_total: p1.length, p1_secure: p1Secure, p1_pct: p1.length ? Math.round((100 * p1Secure) / p1.length) : 0, days_to_due: daysToDue, due_date: env.DUE_DATE || '2026-10-01',
      velocity_per_week: velocityPerWeek, projected_date: projectedDate, minutes_this_week: minutesThisWeek, minutes_target_week: target, items_this_week: answered.length,
      focus_ratio: telemetry.length ? Math.round((activeSeconds(telemetry, { now }) / Math.max(1, (now.getTime() - new Date(telemetry[0].at).getTime()) / 1000)) * 100) / 100 : null,
      guessing_rate: answered.length ? Math.round((100 * guessing) / answered.length) / 100 : 0, streak_days: streak, retention_rate: retention,
      secure_total: rows.filter((r) => isSecure(r.state.status)).length, mastered_total: rows.filter((r) => r.state.status === 'mastered').length, skills_total: rows.length },
    skills: rows.map((r) => ({ id: r.id, subject: r.subject, strand: r.strand, qsi_unit: r.qsi_unit, standard: r.standard, name: r.name, grade: r.grade, priority: r.priority, prerequisites: r.prerequisites, planned_month: r.planned_month, fluency: r.fluency, map_area: r.map_area,
      status: r.state.status, last_rate: r.state.last_rate, attempts: r.state.attempts || 0, items_seen: r.state.items_seen || 0, time_spent_s: r.state.time_spent_s || 0, next_review_at: r.state.next_review_at || null, fast: r.state.fast ?? null, loop_state: r.state.loop_state || null, stability: r.state.stability ?? null })),
    urgency: urgency.slice(0, 15), qsi_units: qsi, today,
    points: { balance, ledger: points.slice(0, 30) }, rewards,
    coach_sessions: sessions.map((s) => ({ id: s.id, skill_id: s.skill_id, started_at: s.started_at, ended_at: s.ended_at, loop_state: s.loop_state, cycle_number: s.cycle_number, outcome: s.outcome, parent_summary: s.parent_summary, turns: (s.messages || []).length })),
    map_results: mapResults,
    marking_queue_count: profile.role === 'parent' ? (await repo.markingQueue(studentId)).length : undefined,
    llm_mode: env.ANTHROPIC_API_KEY ? 'live' : 'mock', repo_mode: repo.mode,
  };
}
