// Parent settings (BRIEF §7 screen 5) and MAP RIT entry (docs/01). Mastery thresholds are read-only in the UI
// (CLAUDE.md #5): changing pass_rate / regress_rate needs a deliberate decision, so this endpoint refuses them.
const EDITABLE = new Set(['daily_minutes', 'voice', 'russian_fallback', 'tier3_slip_replacement', 'coach_block_minutes', 'daily_cap_minutes', 'auto_read', 'unlocked_skills', 'shop_prices', 'boss_points', 'bosses']);

export const settingsRoutes = {
  'POST /settings': async ({ repo, studentId, body }) => {
    const student = await repo.getProfile(studentId);
    const patch = {};
    for (const [k, v] of Object.entries(body || {})) {
      if (!EDITABLE.has(k)) throw Object.assign(new Error(`setting "${k}" is read-only (mastery thresholds are data, not opinion)`), { status: 400 });
      patch[k] = v;
    }
    const settings = { ...(student.settings || {}), ...patch };
    if (settings.daily_minutes != null && !(settings.daily_minutes >= 10 && settings.daily_minutes <= 180)) throw Object.assign(new Error('daily_minutes 10–180'), { status: 400 });
    // unlocked_skills: the parent's list of topics Elchin may be tested on (null = everything). Validated against the skill map.
    if (settings.unlocked_skills != null) {
      if (!Array.isArray(settings.unlocked_skills) || !settings.unlocked_skills.every((x) => typeof x === 'string')) throw Object.assign(new Error('unlocked_skills must be a list of skill ids'), { status: 400 });
      const known = new Set((await repo.getSkills()).map((s) => s.id));
      settings.unlocked_skills = [...new Set(settings.unlocked_skills.filter((id) => known.has(id)))];
    }
    await repo.updateProfile(studentId, { settings });
    return { settings };
  },
  'POST /map-results': async ({ repo, studentId, body }) => {
    const { term, subject, rit, area_scores, tested_at } = body || {};
    if (!term || !subject || !(Number(rit) > 100)) throw Object.assign(new Error('term, subject and rit required'), { status: 400 });
    const row = await repo.insertMapResult({ student_id: studentId, term, subject, rit: Math.round(Number(rit)), area_scores: area_scores || null, tested_at: tested_at || null });
    const col = { Mathematics: 'map_rit_math', Reading: 'map_rit_reading', 'Language Usage': 'map_rit_language', Science: 'map_rit_science' }[subject];
    if (col) await repo.updateProfile(studentId, { [col]: row.rit });
    return row;
  },
};
