// Parent exports (BRIEF §6, §8 Phase 5; AUDIT Judge 3): one-page weekly PDF for the teacher and CSV of any table.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const isSecure = (s) => s === 'secure' || s === 'mastered';
const DAY = 86400000;
const csvCell = (v) => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = (rows) => { if (!rows.length) return ''; const cols = Object.keys(rows[0]); return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'); };

export async function weeklyReport({ repo, studentId, now = new Date() }) {
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const [student, skills, states, answered, sessions, events] = await Promise.all([repo.getProfile(studentId), repo.getSkills(), repo.getSkillStates(studentId), repo.getAnsweredSince(studentId, weekAgo), repo.getCoachSessions(studentId, { limit: 30 }), repo.getEvents(studentId, weekAgo)]);
  const stateBy = Object.fromEntries(states.map((s) => [s.skill_id, s]));
  const status = (id) => stateBy[id]?.status || 'not_yet';
  const bySubject = {};
  for (const sk of skills) { const b = (bySubject[sk.subject] ??= { secure: 0, emerging: 0, not_yet: 0, total: 0, p1_open: [] }); b.total++; const st = status(sk.id); if (isSecure(st)) b.secure++; else if (st === 'emerging') b.emerging++; else b.not_yet++; if (sk.priority === 1 && !isSecure(st)) b.p1_open.push(sk); }
  const minutes = Math.round(answered.reduce((a, i) => a + (i.time_s || 0), 0) / 60) + Math.round(sessions.filter((s) => s.started_at >= weekAgo).reduce((a, s) => a + (s.active_s || 0), 0) / 60);
  const secured = events.filter((e) => e.kind === 'skill_secure').map((e) => skills.find((s) => s.id === e.payload?.skill_id)?.name || e.payload?.skill_id);
  const flags = events.filter((e) => e.kind === 'flag_parent').map((e) => e.payload?.note);
  const nextSteps = skills.filter((s) => s.priority === 1 && !isSecure(status(s.id))).sort((a, b) => (status(a.id) === 'not_yet' ? -1 : 1)).slice(0, 5);
  return { student: student?.display_name || 'Elchin', week_ending: now.toISOString().slice(0, 10), bySubject, minutes, items: answered.length, secured, flags, nextSteps, sessions: sessions.filter((s) => s.started_at >= weekAgo).length };
}

export async function weeklyPdf(report) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);                       // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.21, 0.22, 0.23), copper = rgb(0.62, 0.42, 0.28), ash = rgb(0.56, 0.56, 0.54);
  let y = 800;
  const line = (text, { size = 11, f = font, color = ink, x = 48 } = {}) => { page.drawText(String(text).replace(/[^\x20-\x7E]/g, '?'), { x, y, size, font: f, color }); y -= size + 6; };
  line(`Weekly learning report — ${report.student}`, { size: 20, f: bold });
  line(`Week ending ${report.week_ending} · prepared by E.Z.QUIZY for the class teacher`, { size: 10, color: ash });
  y -= 8;
  line(`Active time this week: ${report.minutes} minutes · questions answered: ${report.items} · coach sessions: ${report.sessions}`, { size: 11 });
  y -= 6;
  line('Skills by subject', { size: 14, f: bold, color: copper });
  for (const [subject, b] of Object.entries(report.bySubject)) {
    line(`${subject}: ${b.secure} secure · ${b.emerging} emerging · ${b.not_yet} not yet (of ${b.total})`, { size: 11, f: bold });
    for (const sk of b.p1_open.slice(0, 6)) line(`   – still working on: ${sk.name}`, { size: 10, color: ash });
  }
  y -= 6;
  line('Secured this week', { size: 14, f: bold, color: copper });
  if (report.secured.length) report.secured.forEach((s) => line(`   ✓ ${s}`, { size: 11 })); else line('   (none yet this week)', { size: 11, color: ash });
  y -= 6;
  line('Next steps at home', { size: 14, f: bold, color: copper });
  report.nextSteps.forEach((s) => line(`   • ${s.name}`, { size: 11 }));
  if (report.flags.length) { y -= 6; line('Where school could help', { size: 14, f: bold, color: copper }); report.flags.slice(0, 3).forEach((f) => line(`   ${f}`, { size: 10 })); }
  y = 40; line('Mastery = 90 % on two checks, then spaced review. Generated automatically; the parent reviews open answers.', { size: 8, color: ash });
  return pdf.save();
}

export const exportRoutes = {
  'GET /export/weekly.pdf': async ({ repo, studentId, now }) => {
    const report = await weeklyReport({ repo, studentId, now });
    const bytes = await weeklyPdf(report);
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="elchin-week-${report.week_ending}.pdf"` } });
  },
  'GET /export/weekly.json': async ({ repo, studentId, now }) => weeklyReport({ repo, studentId, now }),
  'GET /export/csv': async ({ repo, studentId, url }) => {
    const table = url.searchParams.get('table') || 'skill_state';
    let rows;
    if (table === 'skill_state') rows = await repo.getSkillStates(studentId);
    else if (table === 'tests') rows = await repo.getTests(studentId, { limit: 1000 });
    else if (table === 'test_items') { const tests = await repo.getTests(studentId, { limit: 1000 }); rows = []; for (const t of tests) for (const i of await repo.getTestItems(t.id)) rows.push({ ...i, item: i.item?.stem, kind: t.kind }); }
    else if (table === 'coach_sessions') rows = (await repo.getCoachSessions(studentId, { limit: 1000 })).map((s) => ({ ...s, messages: (s.messages || []).length }));
    else if (table === 'points') rows = await repo.getPoints(studentId);
    else if (table === 'map_results') rows = await repo.getMapResults(studentId);
    else throw Object.assign(new Error('unknown table'), { status: 400 });
    return new Response(toCSV(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${table}.csv"` } });
  },
};
