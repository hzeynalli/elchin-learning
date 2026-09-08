/* Elchin Learning — single-page app (BRIEF §7). No framework, no build step. Talks to Supabase Auth directly and to the
   Cloudflare Worker for everything else. Student UI words: Learn, Check, Try again, Next, Done for today. */
(() => {
  const CFG = window.ELCHIN_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: CFG.TIMEZONE }) : '—');
  const pct = (r) => (r == null ? '—' : Math.round(r * 100) + '%');
  const STATUS = { not_yet: 'Not yet', emerging: 'Emerging', secure: 'Secure', mastered: 'Mastered' };
  const SUBJECT_ORDER = ['Mathematics', 'Reading', 'Language Usage', 'Science'];

  const state = { session: null, dash: null, tab: localStorage.getItem('elchin.tab') || 'today', ptab: 'overview', error: null, busy: false, template: null, manual: { marks: {}, minutes: '', q4: '', date: '' }, notice: null };

  // ---------------------------------------------------------------- api
  async function api(path, body, method) {
    const token = state.session?.access_token;
    const res = await fetch(CFG.WORKER_URL + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
    return data;
  }
  async function loadDash() { state.dash = await api('/dashboard'); document.body.className = `role-${state.dash.role}`; }
  async function refresh() { try { await loadDash(); } catch (e) { state.error = e.message; } render(); }

  // ---------------------------------------------------------------- auth
  async function init() {
    const { data } = await sb.auth.getSession();
    state.session = data.session;
    sb.auth.onAuthStateChange((_e, s) => { state.session = s; if (!s) { state.dash = null; render(); } });
    if (state.session) await refresh(); else render();
  }
  async function login(email, password) {
    state.busy = true; state.error = null; render();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    state.busy = false;
    if (error) { state.error = error.message; render(); return; }
    const { data } = await sb.auth.getSession(); state.session = data.session;
    await refresh();
  }

  // ---------------------------------------------------------------- render
  function render() {
    const app = $('#app');
    if (!state.session) { app.innerHTML = viewLogin(); bind(app); return; }
    if (!state.dash) { app.innerHTML = state.error ? `<div class="card"><div class="error">${esc(state.error)}</div><button class="btn secondary" data-act="retry">Try again</button> <button class="btn secondary" data-act="logout">Sign out</button></div>` : '<div class="loading">Loading…</div>'; bind(app); return; }
    const d = state.dash, m = d.metrics, isParent = d.role === 'parent';
    const tabs = [['today', 'Today'], ['checks', 'Checks'], ['coach', 'Coach'], ['progress', 'Progress'], ...(isParent ? [['parent', 'Parent']] : [])];
    app.innerHTML = `
      <header class="top">
        <div class="brand">Elchin <span>Learning</span></div>
        <div class="headline">
          <div><div class="big">${m.days_to_due}</div><div class="lbl">days to 1 October</div></div>
          <div><div class="big">${m.p1_secure} <span class="muted" style="font-size:.55em">of ${m.p1_total}</span></div><div class="lbl">priority skills secure</div></div>
          <div><div class="big">${d.points.balance}</div><div class="lbl">points</div></div>
          ${m.streak_days ? `<div><div class="big">${m.streak_days}</div><div class="lbl">day streak</div></div>` : ''}
        </div>
        <div class="row"><span class="muted small">${esc(d.role === 'parent' ? 'Parent view' : d.student.name)}</span><button class="btn secondary small" data-act="logout">Sign out</button></div>
      </header>
      <nav class="tabs">${tabs.map(([k, l]) => `<button class="tab ${state.tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
      ${state.error ? `<div class="error">${esc(state.error)}</div>` : ''}
      ${state.notice ? `<div class="notice">${state.notice}</div>` : ''}
      <main>${({ today: viewToday, checks: viewChecks, coach: viewCoach, progress: viewProgress, parent: viewParent })[state.tab]?.(d) || ''}</main>
      <footer class="muted small" style="margin:30px 0 10px">${d.llm_mode === 'mock' ? 'Coach is in preview mode (no AI key yet). ' : ''}${d.repo_mode === 'user-rls' ? 'Worker is read-only until the service key is set. ' : ''}</footer>`;
    bind(app);
  }

  function viewLogin() {
    return `<div class="login card"><h1>Elchin Learning</h1><p class="muted">Sign in to continue.</p>
      ${state.error ? `<div class="error">${esc(state.error)}</div>` : ''}
      <form data-form="login" class="stack">
        <label class="f"><span>Email</span><input type="email" name="email" autocomplete="username" required></label>
        <label class="f"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn full" ${state.busy ? 'disabled' : ''}>Sign in</button>
      </form></div>`;
  }

  function chip(s, extra = '') { return `<span class="chip ${s} ${extra}">${STATUS[s] || s}</span>`; }
  function skillName(d, id) { return d.skills.find((s) => s.id === id)?.name || id; }

  function viewToday(d) {
    const u = d.today.urgent;
    return `<div class="grid">
      <section class="card"><h2>Your plan today</h2>
        <p class="muted">Three things, in this order. Start with the first.</p>
        <ol class="stack">
          <li><strong>Daily review</strong> — ${d.today.review_due.length ? `${d.today.review_due.length} skills due for a quick review.` : 'nothing due yet — it fills up once skills are secure.'} <span class="muted small">(arrives with Phase 4)</span></li>
          ${u.map((s, i) => `<li><strong>${esc(s.name)}</strong> ${chip(s.status)} <div class="row" style="margin-top:8px"><button class="btn small" data-act="coach" data-skill="${esc(s.id)}">Learn with coach</button><button class="btn small secondary" data-act="check" data-skill="${esc(s.id)}">Take a check</button></div></li>`).join('')}
          ${u.length === 0 ? '<li>Every priority skill is secure. Time for a memory game.</li>' : ''}
        </ol>
      </section>
      <section class="card"><h2>This week</h2>
        <div class="metric"><div class="big">${d.metrics.minutes_this_week} <span class="muted" style="font-size:.5em">/ ${d.metrics.minutes_target_week} min</span></div><div class="lbl">active minutes</div></div>
        <div class="bar"><i style="width:${Math.min(100, Math.round((100 * d.metrics.minutes_this_week) / Math.max(1, d.metrics.minutes_target_week)))}%"></i></div>
        <div class="metric" style="margin-top:14px"><div class="big">${d.metrics.items_this_week}</div><div class="lbl">questions answered</div></div>
        ${viewRewards(d)}
      </section></div>`;
  }
  function viewRewards(d) {
    const open = d.rewards.filter((r) => !r.redeemed_at);
    if (!open.length) return '<p class="muted small" style="margin-top:16px">No rewards set yet.</p>';
    return `<h3 style="margin-top:18px">Rewards</h3>${open.map((r) => `<div class="row spread" style="padding:6px 0;border-top:1px solid var(--hair)"><span>${esc(r.name)} <span class="muted small">${r.cost} pts</span></span>${d.role === 'student' ? `<button class="btn small secondary" data-act="redeem" data-id="${r.id}" ${d.points.balance < r.cost ? 'disabled' : ''}>Redeem</button>` : ''}</div>`).join('')}`;
  }
  function viewChecks() { return `<section class="card"><h2>Checks</h2><p>Checks (general and targeted) arrive in Phase 2. They will show one question at a time with a small timer and immediate feedback.</p></section>`; }
  function viewCoach() { return `<section class="card"><h2>Coach</h2><p>The coach arrives in Phase 4: explain → practice 10 → confirm 5, with voice.</p></section>`; }

  function viewProgress(d) {
    const m = d.metrics;
    const bySubject = {};
    for (const s of d.skills) ((bySubject[s.subject] ??= {})[s.strand] ??= []).push(s);
    const subjects = Object.keys(bySubject).sort((a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b));
    const isSec = (s) => s.status === 'secure' || s.status === 'mastered';
    return `<section class="card"><div class="grid">
        <div class="metric"><div class="big">${m.p1_pct}%</div><div class="lbl">priority-1 skills secure (${m.p1_secure} of ${m.p1_total})</div><div class="bar"><i style="width:${m.p1_pct}%"></i></div></div>
        <div class="metric"><div class="big">${m.days_to_due}</div><div class="lbl">days to ${fmtDate(m.due_date)}</div></div>
        <div class="metric"><div class="big">${m.projected_date ? fmtDate(m.projected_date) : '—'}</div><div class="lbl">projected date at current pace${m.velocity_per_week ? ` (${m.velocity_per_week}/week)` : ''}</div></div>
        <div class="metric"><div class="big">${m.minutes_this_week}</div><div class="lbl">minutes this week (target ${m.minutes_target_week})</div></div>
      </div></section>
      <section class="card"><h2>QSI units due 1 October</h2><table><tr><th>Unit</th><th class="num">Skills</th><th class="num">Secure</th><th style="width:30%"></th></tr>
        ${d.qsi_units.map((u) => `<tr><td>${esc(u.unit)} <span class="muted small">${esc(u.course)}</span></td><td class="num">${u.skills}</td><td class="num">${u.secure}</td><td><div class="bar"><i style="width:${u.pct || 0}%"></i></div></td></tr>`).join('')}</table>
        <p class="muted small">Unit names are labels; the full Grade-5 map below is what is taught (docs/01).</p></section>
      <section class="card"><h2>All skills <span class="muted" style="font-size:.6em">${m.secure_total} of ${m.skills_total} secure</span></h2>
        ${subjects.map((sub) => { const strands = bySubject[sub]; const all = Object.values(strands).flat(); const sec = all.filter(isSec).length; return `
          <details class="subject" ${sub === 'Mathematics' ? 'open' : ''}><summary><h3 style="margin:0">${esc(sub)}</h3><span class="muted small">${sec} of ${all.length} secure</span></summary>
          ${Object.entries(strands).map(([strand, skills]) => `<details class="strand" open><summary>${esc(strand)} <span class="muted small">(${skills.filter(isSec).length}/${skills.length})</span></summary>
            ${skills.map((s) => `<div class="skill"><div><div>${esc(s.name)} ${s.priority === 1 ? '<span class="chip p1" title="due 1 October">due 1 Oct</span>' : ''}</div>
              <div class="meta">${esc(s.standard || '')} · last ${pct(s.last_rate)} · ${s.attempts} attempt${s.attempts === 1 ? '' : 's'} · ${Math.round(s.time_spent_s / 60)} min${s.next_review_at ? ` · review ${fmtDate(s.next_review_at)}` : ''}${s.fast === true ? ' · fast ✓' : s.fast === false ? ' · not yet fast' : ''}</div></div>
              <div>${chip(s.status)}</div></div>`).join('')}</details>`).join('')}</details>`; }).join('')}
      </section>`;
  }

  // ---------------------------------------------------------------- parent
  function viewParent(d) {
    const tabs = [['overview', 'Overview'], ['manual', 'Paper diagnostic'], ['queue', `Marking queue${d.marking_queue_count ? ` (${d.marking_queue_count})` : ''}`], ['transcripts', 'Coach transcripts'], ['rewards', 'Points & rewards'], ['map', 'MAP scores'], ['settings', 'Settings'], ['exports', 'Exports']];
    const body = { overview: pOverview, manual: pManual, queue: pQueue, transcripts: pTranscripts, rewards: pRewards, map: pMap, settings: pSettings, exports: pExports }[state.ptab]?.(d) || '';
    return `<div class="subtabs">${tabs.map(([k, l]) => `<button class="tab ${state.ptab === k ? 'active' : ''}" data-ptab="${k}">${l}</button>`).join('')}</div>${body}`;
  }
  function pOverview(d) {
    const m = d.metrics;
    return `<section class="card"><h2>KPIs</h2><div class="grid">
        <div class="metric"><div class="big">${m.minutes_this_week}/${m.minutes_target_week}</div><div class="lbl">active minutes vs target (week)</div></div>
        <div class="metric"><div class="big">${m.focus_ratio ?? '—'}</div><div class="lbl">focus ratio</div></div>
        <div class="metric"><div class="big">${m.velocity_per_week}</div><div class="lbl">skills → secure per week</div></div>
        <div class="metric"><div class="big">${m.projected_date ? fmtDate(m.projected_date) : '—'}</div><div class="lbl">projected: all priority-1 secure</div></div>
        <div class="metric"><div class="big">${Math.round(m.guessing_rate * 100)}%</div><div class="lbl">guessing rate (fast + wrong)</div></div>
        <div class="metric"><div class="big">${m.mastered_total}</div><div class="lbl">mastered (retained)</div></div>
      </div></section>
      <section class="card"><h2>Urgency — top 15</h2><table><tr><th>#</th><th>Skill</th><th>Subject</th><th class="num">Priority</th><th>Status</th><th class="num">Last</th><th class="num">Score</th></tr>
        ${d.urgency.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.name)} <span class="muted small">${esc(u.id)}</span></td><td>${esc(u.subject)}</td><td class="num">${u.priority}</td><td>${chip(u.status)}</td><td class="num">${pct(u.last_rate)}</td><td class="num">${u.score}</td></tr>`).join('')}</table>
        <p class="muted small">score = 3·(priority 1 and not secure) + 2·(blocked dependents) + 1·(days overdue) + 1·(not yet)</p></section>`;
  }
  function pManual(d) {
    const t = state.template;
    if (!t) { api('/manual-entry/template').then((x) => { state.template = x; render(); }).catch((e) => { state.error = e.message; render(); }); return '<section class="card">Loading the scorecard…</section>'; }
    const mk = state.manual.marks;
    const done = d.skills.some((s) => s.attempts > 0);
    return `<section class="card"><h2>${esc(t.title)}</h2>
      <p class="muted">Mark each question ✓ or ✗ from the answer key (docs/Elchin_Math_Diagnostic_1_ANSWER_KEY.pdf). Leave blank if it was skipped. ${done ? '<strong>Already entered once — entering again adds a second attempt.</strong>' : ''}</p>
      <table><tr><th>#</th><th>Question</th><th>Expected</th><th>Skill</th><th>Mark</th></tr>
      ${t.questions.map((q) => `<tr><td>${q.q}</td><td>${esc(q.stem)}</td><td class="muted small">${esc(q.answer)}</td><td class="small">${esc(q.qsi)} → ${esc(q.skill_id)} <span class="muted">t${q.tier}</span></td>
        <td><span class="tri"><button data-mark="${q.q}" data-val="yes" class="${mk[q.q] === true ? 'on-yes' : ''}">✓</button><button data-mark="${q.q}" data-val="no" class="${mk[q.q] === false ? 'on-no' : ''}">✗</button></span></td></tr>`).join('')}</table>
      <div class="grid" style="margin-top:16px">
        <label class="f"><span>Total minutes taken</span><input type="number" data-manual="minutes" value="${esc(state.manual.minutes)}" min="1" max="120"></label>
        <label class="f"><span>Q4 times-tables row: seconds taken (key: under 20 s)</span><input type="number" data-manual="q4" value="${esc(state.manual.q4)}" min="1" max="300"></label>
        <label class="f"><span>Date taken</span><input type="date" data-manual="date" value="${esc(state.manual.date)}"></label>
      </div>
      <div class="row"><button class="btn" data-act="submit-manual" ${state.busy ? 'disabled' : ''}>Save scorecard</button><span class="muted small">${Object.keys(mk).length} of ${t.questions.length} marked</span></div></section>`;
  }
  function pQueue(d) { return `<section class="card"><h2>Marking queue</h2><p class="muted">Open answers the AI marked with confidence below 0.8 plus a 10 % sample appear here (Phase 3). ${d.marking_queue_count ? `${d.marking_queue_count} waiting.` : 'Nothing waiting.'}</p></section>`; }
  function pTranscripts(d) {
    if (!d.coach_sessions.length) return '<section class="card"><h2>Coach transcripts</h2><p class="muted">No coach sessions yet.</p></section>';
    return `<section class="card"><h2>Coach transcripts</h2><table><tr><th>Date</th><th>Skill</th><th>State</th><th class="num">Cycle</th><th class="num">Turns</th><th>Outcome</th><th>Parent summary</th></tr>
      ${d.coach_sessions.map((s) => `<tr><td>${fmtDate(s.started_at)}</td><td>${esc(skillName(d, s.skill_id))}</td><td>${esc(s.loop_state)}</td><td class="num">${s.cycle_number}</td><td class="num">${s.turns}</td><td>${esc(s.outcome || '')}</td><td class="small">${esc(s.parent_summary || '')}</td></tr>`).join('')}</table></section>`;
  }
  function pRewards(d) {
    return `<div class="grid"><section class="card"><h2>Rewards</h2><p class="muted small">You define what points buy; the app only counts. Points: +1/+2/+3 per correct answer by tier, +10 per completed coach loop, +5 per review day.</p>
        <table><tr><th>Reward</th><th class="num">Cost</th><th></th></tr>${d.rewards.map((r) => `<tr><td>${esc(r.name)}${r.redeemed_at ? ` <span class="muted small">redeemed ${fmtDate(r.redeemed_at)}</span>` : ''}</td><td class="num">${r.cost}</td><td>${r.redeemed_at ? '' : `<button class="btn small secondary" data-act="del-reward" data-id="${r.id}">Remove</button>`}</td></tr>`).join('')}</table>
        <form data-form="reward" class="row" style="margin-top:12px"><input type="text" name="name" placeholder="Reward (e.g. cinema)" required style="flex:2"><input type="number" name="cost" placeholder="Cost" min="1" required style="flex:1"><button class="btn small">Add</button></form></section>
      <section class="card"><h2>Points · balance ${d.points.balance}</h2>
        <form data-form="points" class="row"><input type="number" name="delta" placeholder="+/- points" required style="flex:1"><input type="text" name="reason" placeholder="Reason" required style="flex:2"><button class="btn small">Adjust</button></form>
        <table style="margin-top:12px"><tr><th>When</th><th>Reason</th><th class="num">Δ</th></tr>${d.points.ledger.map((p) => `<tr><td>${fmtDate(p.at)}</td><td>${esc(p.reason)}</td><td class="num">${p.delta > 0 ? '+' : ''}${p.delta}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No points yet.</td></tr>'}</table></section></div>`;
  }
  function pMap(d) {
    return `<section class="card"><h2>MAP Growth results</h2><p class="muted small">Enter RIT scores from the school's Family Report. They re-weight priorities toward the two RIT bands around his score (docs/01).</p>
      <table><tr><th>Term</th><th>Subject</th><th class="num">RIT</th><th>Tested</th></tr>${d.map_results.map((r) => `<tr><td>${esc(r.term)}</td><td>${esc(r.subject)}</td><td class="num">${r.rit}</td><td>${fmtDate(r.tested_at)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None entered yet.</td></tr>'}</table>
      <form data-form="map" class="grid" style="margin-top:12px"><label class="f"><span>Term</span><input type="text" name="term" placeholder="Fall 2026" required></label>
        <label class="f"><span>Subject</span><select name="subject">${SUBJECT_ORDER.map((s) => `<option>${s}</option>`).join('')}</select></label>
        <label class="f"><span>RIT</span><input type="number" name="rit" min="100" max="300" required></label>
        <label class="f"><span>Date</span><input type="date" name="tested_at"></label><div><button class="btn small">Save</button></div></form></section>`;
  }
  function pSettings(d) {
    const s = d.student.settings;
    return `<section class="card"><h2>Settings</h2><form data-form="settings" class="grid">
        <label class="f"><span>Daily minutes target</span><input type="number" name="daily_minutes" value="${s.daily_minutes ?? 50}" min="10" max="180"></label>
        <label class="f"><span>Voice</span><select name="voice"><option value="true" ${s.voice !== false ? 'selected' : ''}>On</option><option value="false" ${s.voice === false ? 'selected' : ''}>Off</option></select></label>
        <label class="f"><span>Russian fallback (one sentence when stuck twice)</span><select name="russian_fallback"><option value="true" ${s.russian_fallback !== false ? 'selected' : ''}>On</option><option value="false" ${s.russian_fallback === false ? 'selected' : ''}>Off</option></select></label>
        <label class="f"><span>Tier-3 slip → one replacement item instead of re-explain</span><select name="tier3_slip_replacement"><option value="true" ${s.tier3_slip_replacement !== false ? 'selected' : ''}>On</option><option value="false" ${s.tier3_slip_replacement === false ? 'selected' : ''}>Off</option></select></label>
        <div><button class="btn small">Save settings</button></div></form>
      <h3 style="margin-top:20px">Mastery thresholds (read-only)</h3><p class="muted small">Pass rate ${s.pass_rate ?? 0.9} · regression below ${s.regress_rate ?? 0.7} · qualifying test ≥ 3 items · fluency ≤ 3 s per item. These are data, not opinion (docs/02 §3); change them only by a deliberate decision in the schema.</p></section>`;
  }
  function pExports() { return '<section class="card"><h2>Exports</h2><p class="muted">Weekly one-page PDF for the teacher and CSV export arrive in Phase 5.</p></section>'; }

  // ---------------------------------------------------------------- events
  function bind(root) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; localStorage.setItem('elchin.tab', state.tab); state.error = null; state.notice = null; render(); }));
    root.querySelectorAll('[data-ptab]').forEach((b) => b.addEventListener('click', () => { state.ptab = b.dataset.ptab; state.error = null; state.notice = null; render(); }));
    root.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', () => { const q = b.dataset.mark, v = b.dataset.val === 'yes'; if (state.manual.marks[q] === v) delete state.manual.marks[q]; else state.manual.marks[q] = v; render(); }));
    root.querySelectorAll('[data-manual]').forEach((i) => i.addEventListener('input', () => { state.manual[i.dataset.manual] = i.value; }));
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset)));
    root.querySelectorAll('form[data-form]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); submit(f.dataset.form, Object.fromEntries(new FormData(f).entries())); }));
  }
  async function act(name, ds) {
    try {
      state.error = null;
      if (name === 'logout') { await sb.auth.signOut(); state.session = null; state.dash = null; render(); }
      else if (name === 'retry') await refresh();
      else if (name === 'coach') { state.tab = 'coach'; render(); }
      else if (name === 'check') { state.tab = 'checks'; render(); }
      else if (name === 'redeem') { const r = await api('/rewards/redeem', { id: Number(ds.id) }); state.notice = `Redeemed. Balance ${r.balance}.`; await refresh(); }
      else if (name === 'del-reward') { await api('/rewards/delete', { id: Number(ds.id) }); await refresh(); }
      else if (name === 'submit-manual') {
        if (!Object.keys(state.manual.marks).length) throw new Error('Mark at least one question first.');
        state.busy = true; render();
        const r = await api('/manual-entry', { source: 'diagnostic_1', marks: state.manual.marks, minutes: Number(state.manual.minutes) || undefined, q4_seconds: Number(state.manual.q4) || undefined, date: state.manual.date || undefined });
        state.busy = false; state.manual = { marks: {}, minutes: '', q4: '', date: '' };
        state.notice = `Saved: ${r.score} of ${r.total} correct. Skill states updated: ${r.skill_states.map((s) => `${esc(s.skill_id)} → ${STATUS[s.status]}`).join(', ')}.`;
        state.ptab = 'overview'; await refresh();
      }
    } catch (e) { state.busy = false; state.error = e.message; render(); }
  }
  async function submit(form, v) {
    try {
      state.error = null;
      if (form === 'login') return login(v.email, v.password);
      if (form === 'reward') await api('/rewards', { name: v.name, cost: Number(v.cost) });
      if (form === 'points') await api('/points', { delta: Number(v.delta), reason: v.reason });
      if (form === 'map') await api('/map-results', { term: v.term, subject: v.subject, rit: Number(v.rit), tested_at: v.tested_at || null });
      if (form === 'settings') await api('/settings', { daily_minutes: Number(v.daily_minutes), voice: v.voice === 'true', russian_fallback: v.russian_fallback === 'true', tier3_slip_replacement: v.tier3_slip_replacement === 'true' });
      await refresh();
    } catch (e) { state.error = e.message; render(); }
  }

  init();
})();
