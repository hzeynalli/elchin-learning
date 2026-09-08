/* Elchin Learning — single-page app (BRIEF §7). No framework, no build step. Talks to Supabase Auth directly and to the
   Cloudflare Worker for everything else. Student UI words: Learn, Check, Try again, Next, Done for today. */
(() => {
  const CFG = window.ELCHIN_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: CFG.TIMEZONE }) : '—');
  const pct = (r) => (r == null ? '—' : Math.round(r * 100) + '%');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: CFG.TIMEZONE });
  const STATUS = { not_yet: 'Not yet', emerging: 'Emerging', secure: 'Secure', mastered: 'Mastered' };
  const SUBJECT_ORDER = ['Mathematics', 'Reading', 'Language Usage', 'Science'];
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

  const state = { session: null, dash: null, tab: localStorage.getItem('elchin.tab') || 'today', ptab: 'overview', error: null, busy: false, template: null, manual: { marks: {}, minutes: '', q4: '', date: '' }, notice: null, run: null, recent: null, queue: null, bank: null, coach: null, tour: 0 };

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

  // ---------------------------------------------------------------- telemetry (docs/07 §2) — visible to Elchin too
  const tele = { session_id: uuid(), buf: [] };
  function track(kind, payload) { if (!state.session) return; tele.buf.push({ kind, at: new Date().toISOString(), payload }); }
  document.addEventListener('visibilitychange', () => track(document.hidden ? 'hidden' : 'visible'));
  let lastActivity = Date.now();
  ['keydown', 'pointerdown'].forEach((ev) => document.addEventListener(ev, () => { const t = Date.now(); if (t - lastActivity > 90000) track('active'); lastActivity = t; }));
  setInterval(() => { if (Date.now() - lastActivity > 90000) track('idle'); }, 30000);
  setInterval(async () => { if (!tele.buf.length || !state.session || state.dash?.role !== 'student') return; const events = tele.buf.splice(0); try { await api('/telemetry', { session_id: tele.session_id, events }); } catch { tele.buf.unshift(...events.slice(-50)); } }, 30000);

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
    track('visible');
    await refresh();
  }

  // ---------------------------------------------------------------- render
  function render() {
    const app = $('#app');
    if (!state.session) { app.innerHTML = viewLogin(); bind(app); return; }
    if (!state.dash) { app.innerHTML = state.error ? `<div class="card"><div class="error">${esc(state.error)}</div><button class="btn secondary" data-act="retry">Try again</button> <button class="btn secondary" data-act="logout">Sign out</button></div>` : '<div class="loading">Loading…</div>'; bind(app); return; }
    const d = state.dash, m = d.metrics, isParent = d.role === 'parent';
    const tabs = [['today', 'Today'], ['checks', 'Checks'], ['coach', 'Coach'], ['progress', 'Progress'], ...(isParent ? [['parent', 'Parent']] : [])];
    const tour = !isParent && !localStorage.getItem('elchin.tour_done') ? viewTour() : '';
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
      <footer class="muted small" style="margin:30px 0 10px">${d.llm_mode === 'mock' ? 'Coach is in preview mode (no AI key yet). ' : ''}${d.repo_mode === 'user-rls' ? 'Worker is read-only until the service key is set. ' : ''}</footer>
      ${tour}`;
    bind(app);
    afterRender();
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
  function viewTour() {
    const steps = [
      ['Welcome', 'This is your learning place. Every day has three parts, always in the same order: a quick review, learning with the coach, and a reading passage.'],
      ['Today', 'The Today tab shows your plan. Press Start on the first item and work down the list. You never have to choose what to do.'],
      ['Coach', 'The coach explains one skill at a time, then gives you 10 practice questions and a 5-question check. Getting something wrong is normal — that is how we find what to practise.'],
      ['Points', 'Correct answers and finished loops earn points. Your dad decides what points can buy. Streaks are never punished.'],
    ];
    const [t, txt] = steps[state.tour];
    return `<div class="overlay"><div class="card tour"><div class="muted small">${state.tour + 1} of ${steps.length}</div><h2>${t}</h2><p>${txt}</p><div class="row spread"><button class="btn secondary small" data-act="tour-skip">Skip</button><button class="btn" data-act="tour-next">${state.tour === steps.length - 1 ? 'Start' : 'Next'}</button></div></div></div>`;
  }

  function chip(s, extra = '') { return `<span class="chip ${s} ${extra}">${STATUS[s] || s}</span>`; }
  function skillName(d, id) { return d.skills.find((s) => s.id === id)?.name || id; }

  // ---------------------------------------------------------------- today (docs/02 §4 fixed daily order)
  function viewToday(d) {
    if (!state.recent) { api('/tests?limit=20').then((r) => { state.recent = r.tests; render(); }).catch(() => { state.recent = []; render(); }); }
    const today = todayKey();
    const doneKinds = new Set((state.recent || []).filter((t) => t.status === 'complete' && (t.submitted_at || t.started_at || '').slice(0, 10) === today).map((t) => t.kind));
    const coachToday = d.coach_sessions.some((s) => (s.started_at || '').slice(0, 10) === today && (s.turns || 0) > 2);
    const hasReviewable = d.skills.some((s) => ['emerging', 'secure', 'mastered'].includes(s.status));
    const urgent = d.today.urgent[0];
    const openDiag = (state.recent || []).find((t) => t.kind === 'diagnostic' && t.status !== 'complete');
    const step = (n, title, sub, done, btn) => `<li class="step ${done ? 'done' : ''}"><div><div class="stitle">${n}. ${title} ${done ? '<span class="ok">✓</span>' : ''}</div><div class="muted small">${sub}</div></div><div>${done ? '' : btn}</div></li>`;
    return `<div class="grid">
      <section class="card"><h2>Your plan today</h2><p class="muted">Three things, always in this order. Start with the first.</p>
        <ol class="steps">
          ${step(1, 'Daily review', d.today.review_due.length ? `${d.today.review_due.length} skills are due — 10 quick questions.` : hasReviewable ? '10 quick questions on skills you already know.' : 'Nothing to review yet — it starts once you have some skills going.', doneKinds.has('review') || doneKinds.has('daily_review'), hasReviewable ? `<button class="btn small" data-act="start" data-mode="${d.today.review_due.length ? 'review' : 'daily_review'}" data-subject="Mathematics">Start</button>` : '')}
          ${step(2, 'Learn with the coach', urgent ? `${esc(urgent.name)} ${chip(urgent.status)}` : 'Every priority skill is secure — pick any skill in the Coach tab.', coachToday, urgent ? `<button class="btn small" data-act="coach" data-skill="${esc(urgent.id)}">Start</button>` : '')}
          ${step(3, 'Read a passage', 'One short passage, 5–6 questions. At least four days a week.', doneKinds.has('reading'), `<button class="btn small" data-act="start" data-mode="reading" data-subject="Reading">Start</button>`)}
          ${openDiag ? step(4, 'Continue your check', `${openDiag.progress?.skills_done ?? 0} of ${openDiag.progress?.skills_total ?? '?'} skills done.`, false, `<button class="btn small secondary" data-act="start" data-mode="diagnostic" data-subject="${esc(openDiag.subject)}">Continue</button>`) : ''}
          ${d.today.learn_ahead?.length ? step(openDiag ? 5 : 4, 'Learn ahead', `Get a head start on next month: ${d.today.learn_ahead.map((s) => esc(s.name)).join(' · ')}`, false, `<button class="btn small secondary" data-act="coach" data-skill="${esc(d.today.learn_ahead[0].id)}">Start</button>`) : ''}
        </ol>
        ${doneKinds.has('reading') && coachToday && (doneKinds.has('review') || doneKinds.has('daily_review') || !hasReviewable) ? '<p class="celebrate">Done for today ✓</p>' : ''}
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

  // ---------------------------------------------------------------- coach (docs/02 §2, §5)
  function viewCoach(d) {
    const c = state.coach;
    if (!c) {
      const candidates = d.skills.filter((s) => s.status !== 'secure' && s.status !== 'mastered').map((s) => ({ ...s, score: d.urgency.find((u) => u.id === s.id)?.score ?? 0 })).sort((a, b) => b.score - a.score || (a.priority - b.priority));
      if (!state.coachOpenChecked) { state.coachOpenChecked = true; api('/coach/open').then((r) => { if (r.session) { state.coachOpen = r.session; render(); } }).catch(() => {}); }
      return `<section class="card"><h2>Coach</h2><p class="muted">Pick a skill. The coach explains it, then you practise 10 questions, then a 5-question check. Getting things wrong is part of it.</p>
        ${state.coachOpen ? `<div class="notice" style="margin-bottom:12px">You have a session in progress on <b>${esc(skillName(d, state.coachOpen.skill_id))}</b>. <button class="btn small" data-act="coach-resume" data-id="${state.coachOpen.id}">Continue</button></div>` : ''}
        <div class="skills-pick">${candidates.slice(0, 12).map((s) => `<button class="opt" data-act="coach" data-skill="${esc(s.id)}"><div>${esc(s.name)}</div><div class="muted small">${esc(s.subject)} · ${chip(s.status)}${s.priority === 1 ? ' · due 1 Oct' : ''}</div></button>`).join('')}</div>
        ${candidates.length === 0 ? '<p class="celebrate">Every skill is secure. Time for a memory game.</p>' : ''}</section>`;
    }
    if (c.run) return viewRunner(d);
    const msgs = c.messages.filter((m) => !m.hidden);
    const actionBtn = { start_practice: '<button class="btn copper" data-act="coach-practice">Start practice — 10 questions</button>', start_confirm: '<button class="btn copper" data-act="coach-confirm">Start the 5-question check</button>', replacement: '<button class="btn copper" data-act="coach-replacement">One more hard question</button>', suggest_break: '<button class="btn secondary" data-act="coach-end">Take a break — done for now</button>', done: '<button class="btn" data-act="coach-end">Done for today</button>' }[c.next_action] || '';
    return `<section class="card coach">
      <div class="row spread"><div><h2 style="margin:0">${esc(c.skill_name)}</h2><div class="muted small">${c.loop_state === 'EXPLAIN' ? `Explaining (round ${c.cycle_number})` : c.loop_state === 'PRACTICE_10' ? 'Practice' : c.loop_state === 'CONFIRM_5' ? 'Check' : 'Secure ✓'} · ${esc(c.representation || '')}</div></div>
        <div class="row"><label class="small muted"><input type="checkbox" data-toggle-read ${c.autoRead ? 'checked' : ''}> Read aloud</label><button class="btn small secondary" data-act="coach-end">End session</button></div></div>
      <div class="chat" id="chat">${msgs.map((m) => `<div class="bubble ${m.role}">${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('')}${c.streaming ? `<div class="bubble assistant">${esc(c.streaming).replace(/\n/g, '<br>')}<span class="cursor">▍</span></div>` : ''}</div>
      ${c.loop_state === 'SECURE' ? `<p class="celebrate">Secure ✓  ${esc(c.skill_name)}</p>` : ''}
      ${actionBtn ? `<div class="row" style="margin:10px 0">${actionBtn}</div>` : ''}
      <div class="row" style="margin-top:10px">
        <textarea id="coach-input" class="answer" rows="2" placeholder="${c.busy ? 'Coach is thinking…' : 'Type here, or press Say it and talk'}" ${c.busy ? 'disabled' : ''}>${esc(c.input || '')}</textarea>
        <button class="btn mic ${c.listening ? 'on' : ''}" data-act="coach-mic" title="Say it" ${c.busy ? 'disabled' : ''}>🎙 ${c.listening ? 'Listening…' : 'Say it'}</button>
        <button class="btn" data-act="coach-send" ${c.busy ? 'disabled' : ''}>Send</button>
      </div></section>`;
  }
  async function coachStart(skillId, sessionId) {
    state.tab = 'coach'; state.error = null;
    state.coach = { skill_id: skillId, session_id: sessionId || null, skill_name: skillName(state.dash, skillId), messages: [], loop_state: 'EXPLAIN', cycle_number: 1, representation: '', next_action: 'continue', busy: false, streaming: '', input: '', autoRead: localStorage.getItem('elchin.autoread') === '1', wrongStreak: 0 };
    render();
    if (sessionId) {
      try { const s = await api(`/coach/session?id=${encodeURIComponent(sessionId)}`); Object.assign(state.coach, { skill_id: s.skill_id, skill_name: skillName(state.dash, s.skill_id), messages: (s.messages || []).map((m) => ({ role: m.role, content: m.content, hidden: m.role === 'user' && /^\[(APP|START|SESSION_END)/.test(m.content) })), loop_state: s.loop_state, cycle_number: s.cycle_number, representation: s.representation }); }
      catch (e) { state.error = e.message; }
      render(); return;
    }
    await coachTurn({ event: { type: 'start' } });
  }
  /** One coach turn, streamed. body: { message } or { event } */
  async function coachTurn(body, { silent = false } = {}) {
    const c = state.coach; if (!c || c.busy) return;
    c.busy = true; c.streaming = ''; state.error = null;
    if (body.message) c.messages.push({ role: 'user', content: body.message });
    render();
    try {
      const res = await fetch(CFG.WORKER_URL + '/coach/stream', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify({ ...body, session_id: c.session_id || undefined, skill_id: c.skill_id, voice_mode: !!c.autoRead }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', meta = null, text = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const p of parts) { const line = p.replace(/^data: /, ''); if (!line) continue; let ev; try { ev = JSON.parse(line); } catch { continue; } if (ev.delta) { c.streaming += ev.delta; renderChatOnly(); } if (ev.error) throw new Error(ev.error); if (ev.done) { text = ev.text; meta = ev.meta; } }
      }
      c.streaming = '';
      if (meta?.error) throw new Error(meta.error);
      c.messages.push({ role: 'assistant', content: meta?.reply || text });
      Object.assign(c, { session_id: meta.session_id, loop_state: meta.loop_state, cycle_number: meta.cycle_number, representation: meta.representation, next_action: meta.next_action, points: meta.points });
      track('coach_turn');
      if (meta.ended) { state.notice = meta.outcome === 'secure' ? `Secure ✓ ${esc(c.skill_name)}` : 'Session saved.'; state.coach = null; state.coachOpen = null; await refresh(); return; }
      if (c.autoRead && !silent) speak(meta.reply || text);
    } catch (e) { state.error = e.message; c.streaming = ''; }
    c.busy = false; render();
  }
  function renderChatOnly() { const el = $('#chat'); const c = state.coach; if (!el || !c) return; el.innerHTML = c.messages.filter((m) => !m.hidden).map((m) => `<div class="bubble ${m.role}">${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('') + (c.streaming ? `<div class="bubble assistant">${esc(c.streaming).replace(/\n/g, '<br>')}<span class="cursor">▍</span></div>` : ''); el.scrollTop = el.scrollHeight; }
  async function coachSet(mode) {
    const c = state.coach; if (!c) return;
    state.busy = true; render();
    try {
      const r = await api('/generate-test', { mode, skill_id: c.skill_id, loop_id: c.session_id });
      c.run = { testId: r.test_id, mode, kind: mode, subject: 'Mathematics', adaptive: true, embedded: true, item: r.items[0], items: r.items, index: 0, answers: {}, startedAt: Date.now(), itemStart: Date.now(), feedback: null, progress: { sitting_items: 0, sitting_cap: r.items.length }, input: null, order: null, picked: new Set(), total: r.items.length, done: null };
      state.run = c.run; c.wrongStreak = 0;
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  async function coachReplacement() {
    const c = state.coach; if (!c || !c.lastConfirmTest) return;
    state.busy = true; render();
    try {
      const r = await api('/coach/replacement', { session_id: c.session_id, test_id: c.lastConfirmTest });
      if (!r.replacement) { state.notice = 'The coach decided that was not a slip — one more round of explaining.'; c.next_action = 'continue'; await coachTurn({ event: { type: 'confirm_done', correct: c.lastConfirmCorrect, items: c.lastConfirmItems, passed: false, replacement: false } }); return; }
      c.run = { testId: r.test_id, mode: 'confirm5', kind: 'confirm5', adaptive: true, embedded: true, item: r.item, items: [r.item], index: 0, answers: {}, startedAt: Date.now(), itemStart: Date.now(), feedback: null, progress: { sitting_items: 0, sitting_cap: 1 }, input: null, order: null, picked: new Set(), total: 1, done: null };
      state.run = c.run;
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  async function coachSetFinished(results) {
    const c = state.coach; if (!c) return;
    const passRate = state.dash.student.settings?.pass_rate ?? 0.9;
    const rate = results.total ? results.correct / results.total : 0, passed = rate >= passRate;
    c.run = null; state.run = null;
    if (results.kind === 'practice10') await coachTurn({ event: { type: 'practice_done', correct: results.correct, items: results.total, rate, passed } });
    else {
      const misses = results.items.filter((i) => i.correct === false);
      const slip = !passed && misses.length === 1 && misses[0].tier === 3 && state.dash.student.settings?.tier3_slip_replacement !== false;
      c.lastConfirmTest = results.test_id; c.lastConfirmCorrect = results.correct; c.lastConfirmItems = results.total;
      await coachTurn({ event: { type: 'confirm_done', correct: results.correct, items: results.total, passed, replacement: slip } });
    }
    await loadDash().catch(() => {}); render();
  }
  // voice: ElevenLabs via the Worker when configured, browser fallback otherwise
  async function speak(text) {
    const clean = String(text).replace(/[*_#`]/g, '');
    try {
      const r = await fetch(CFG.WORKER_URL + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify({ text: clean }) });
      if (r.ok) { const blob = await r.blob(); const a = new Audio(URL.createObjectURL(blob)); a.play(); return; }
    } catch {}
    if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(clean); u.lang = /[Ѐ-ӿ]/.test(clean) ? 'ru-RU' : 'en-US'; u.rate = 0.95; speechSynthesis.speak(u); }
  }
  function listen() {
    const c = state.coach; if (!c) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { state.error = 'Voice input needs Chrome on a laptop or Android. You can type instead.'; render(); return; }
    if (c.rec) { c.rec.stop(); return; }
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e) => { c.input = Array.from(e.results).map((r) => r[0].transcript).join(' '); const ta = $('#coach-input'); if (ta) ta.value = c.input; };
    rec.onend = () => { c.listening = false; c.rec = null; render(); };
    rec.onerror = () => { c.listening = false; c.rec = null; render(); };
    c.rec = rec; c.listening = true; rec.start(); render();
  }

  // ---------------------------------------------------------------- checks (tests)
  function viewChecks(d) {
    if (state.run) return viewRunner(d);
    if (!state.recent) { api('/tests?limit=8').then((r) => { state.recent = r.tests; render(); }).catch(() => { state.recent = []; render(); }); }
    const openDiag = (state.recent || []).find((t) => t.kind === 'diagnostic' && t.status !== 'complete');
    return `<div class="grid">
      <section class="card"><h2>Start a check</h2>
        ${openDiag ? `<div class="notice" style="margin-bottom:14px">You have a check in progress — ${openDiag.progress?.skills_done ?? 0} of ${openDiag.progress?.skills_total ?? '?'} skills done.<br><button class="btn small" style="margin-top:8px" data-act="start" data-mode="diagnostic" data-subject="${esc(openDiag.subject)}">Continue</button></div>` : ''}
        <div class="stack">
          <button class="btn full" data-act="start" data-mode="diagnostic" data-subject="Mathematics">General check — Mathematics</button>
          <p class="muted small">Finds out what you really know. About 25 questions per sitting; you can stop and continue later.</p>
          <button class="btn full secondary" data-act="start" data-mode="targeted" data-subject="Mathematics">Targeted check — Mathematics</button>
          <p class="muted small">15 questions on the skills that need work.</p>
          <button class="btn full secondary" data-act="start" data-mode="reading" data-subject="Reading">Reading — one passage</button>
          <p class="muted small">Read a short passage and answer 5–6 questions. Do this at least four days a week.</p>
          ${['Reading', 'Language Usage', 'Science'].map((s) => `<button class="btn full secondary" data-act="start" data-mode="diagnostic" data-subject="${s}">General check — ${s}</button>`).join('')}
          <h3 style="margin-top:14px">Games</h3>
          <button class="btn full secondary" data-act="special" data-mode="knowledge_check">Memory game — 20 questions on skills you know</button>
          <p class="muted small">Once a month. No hints — let's see what stuck. Points for every one you remember.</p>
          <button class="btn full secondary" data-act="special" data-mode="map_mock" data-subject="Mathematics">MAP-style practice — Mathematics (40)</button>
          <p class="muted small">Like the school's MAP test: mixed topics, untimed. Shows which area to work on.</p>
        </div></section>
      <section class="card"><h2>Recent</h2>${state.recent == null ? '<p class="muted">Loading…</p>' : state.recent.length === 0 ? '<p class="muted">No checks yet.</p>' : `<table><tr><th>Date</th><th>Kind</th><th>Subject</th><th class="num">Score</th><th></th></tr>${state.recent.map((t) => `<tr><td>${fmtDate(t.started_at)}</td><td>${esc(t.kind)}</td><td>${esc(t.subject)}</td><td class="num">${t.score == null ? (t.status === 'complete' ? '—' : 'in progress') : pct(t.score)}</td><td>${t.status === 'complete' ? `<button class="btn small secondary" data-act="review-test" data-id="${t.id}">See</button>` : ''}</td></tr>`).join('')}</table>`}</section></div>`;
  }

  async function startRun(mode, subject, skillIds) {
    state.busy = true; state.error = null; render();
    try {
      const r = mode === 'knowledge_check' ? await api('/knowledge-check', {}) : mode === 'map_mock' ? await api('/map-mock', { subject }) : await api('/generate-test', { subject, mode, ...(skillIds ? { skill_ids: skillIds } : {}) });
      state.run = { testId: r.test_id, mode, kind: mode, subject, adaptive: mode === 'diagnostic', item: r.item || null, items: r.items || [], index: 0, answers: {}, startedAt: Date.now(), itemStart: Date.now(), feedback: null, progress: r.progress || null, done: r.test_complete ? r.results : null, sitting: !!r.sitting_complete, input: null, order: null, picked: new Set(), passage: r.passage || null };
      if (!state.run.adaptive && state.run.items.length) state.run.item = state.run.items[0];
      state.tab = 'checks';
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  function currentAnswer(run) {
    const it = run.item;
    if (it.format === 'mc4') return run.input;
    if (it.format === 'multi_select') return [...run.picked].sort();
    if (it.format === 'ordering') return run.order || it.options;
    return run.input;
  }
  async function checkAnswer() {
    const run = state.run; if (!run || !run.item) return;
    const ans = currentAnswer(run);
    if (ans == null || ans === '' || (Array.isArray(ans) && !ans.length && run.item.format === 'multi_select')) { state.error = 'Type or choose an answer first.'; render(); return; }
    const time_s = Math.round((Date.now() - run.itemStart) / 1000);
    state.busy = true; state.error = null; render();
    try {
      if (run.adaptive) {
        const r = await api('/next-item', { test_id: run.testId, last_answer: { item_id: run.item.id, answer: ans, time_s } });
        track('answer', { correct: r.last?.correct });
        run.progress = r.progress || run.progress;
        if (r.last?.retry) { run.feedback = { retry: true, hint: r.last.hint }; if (state.coach) state.coach.wrongStreak++; }
        else {
          run.feedback = { ...r.last, given: ans }; run.next = r.item || null; run.pendingDone = r.test_complete ? r.results : null; run.pendingSitting = !!r.sitting_complete; run.pendingSummary = r.summary || null;
          if (run.embedded && state.coach) {
            const c = state.coach; c.wrongStreak = r.last?.correct ? 0 : c.wrongStreak + 1;
            if (run.kind === 'practice10') { const comment = await coachComment({ type: 'practice_answer', position: (run.progress?.sitting_items ?? 0), stem: run.item.stem, answer_given: Array.isArray(ans) ? ans.join(', ') : ans, correct: !!r.last?.correct, retry: !!r.last?.retry_used }); if (comment) run.feedback.coach = comment; }
          }
        }
      } else {
        run.answers[run.item.id] = { item_id: run.item.id, answer: ans, time_s };
        api('/answer-item', { test_id: run.testId, item_id: run.item.id, answer: ans, time_s }).catch(() => {});
        track('answer');
        run.index++;
        if (run.index < run.items.length) { run.item = run.items[run.index]; resetInput(run); }
        else { const r = await api('/submit-test', { test_id: run.testId, answers: Object.values(run.answers), started_at: new Date(run.startedAt).toISOString(), submitted_at: new Date().toISOString() }); run.done = r.results; run.item = null; }
      }
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  async function coachComment(event) {
    const c = state.coach; if (!c) return null;
    try { const r = await api('/coach', { session_id: c.session_id, skill_id: c.skill_id, event }); c.messages.push({ role: 'assistant', content: r.reply }); if (c.autoRead) speak(r.reply); return r.reply; } catch { return null; }
  }
  function resetInput(run) { run.input = null; run.order = null; run.picked = new Set(); run.itemStart = Date.now(); run.feedback = null; }
  async function nextItem() {
    const run = state.run;
    if (run.feedback?.retry) { run.feedback = null; run.itemStart = Date.now(); render(); return; }
    if (run.pendingDone) {
      if (run.embedded) { const results = run.pendingDone; run.pendingDone = null; await coachSetFinished(results); return; }
      run.done = run.pendingDone; run.item = null;
    }
    else if (run.pendingSitting) { run.sitting = true; run.summary = run.pendingSummary; run.item = null; }
    else { run.item = run.next; resetInput(run); }
    run.next = null; run.pendingDone = null; run.pendingSitting = false; render();
  }

  function viewRunner(d) {
    const run = state.run;
    if (run.done) return viewResults(run.done);
    if (run.sitting) return `<section class="card"><h2 class="celebrate">Done for today ✓</h2><p>You finished this sitting. ${run.progress ? `${run.progress.skills_done} of ${run.progress.skills_total} skills done so far.` : ''} Come back tomorrow to continue.</p><button class="btn" data-act="exit-run">Back</button></section>`;
    const it = run.item; if (!it) return '<section class="card">Loading…</section>';
    const elapsed = Math.round((Date.now() - run.startedAt) / 1000);
    const fb = run.feedback;
    const posText = run.embedded ? `${(run.progress?.sitting_items ?? run.index) + 1} of ${run.total}` : run.adaptive ? (run.progress ? `${run.progress.sitting_items + 1} of up to ${run.progress.sitting_cap}` : '') : `${run.index + 1} of ${run.items.length}`;
    const showStep = run.embedded && state.coach && state.coach.wrongStreak >= 2 && !fb;
    return `<section class="card q">
      ${run.embedded ? `<div class="muted small">Coach · ${esc(state.coach.skill_name)} · ${run.kind === 'practice10' ? 'practice' : 'check'}</div>` : ''}
      <div class="row spread"><span class="muted small">${posText}</span><span class="muted small" id="timer">${mmss(elapsed)}${it.time_limit_s ? ` · <span id="limit" data-limit="${it.time_limit_s}">${it.time_limit_s}s</span>` : ''}</span></div>
      ${it.passage ? `<div class="passage">${it.passage_title ? `<b>${esc(it.passage_title)}</b><br>` : ''}${esc(it.passage).replace(/\n/g, '<br>')}</div>` : ''}
      <p class="stem">${esc(it.stem)}</p>
      ${fb ? '' : renderInput(it, run)}
      ${fb ? renderFeedback(fb, it) : `<div class="row" style="margin-top:18px"><button class="btn" data-act="check" ${state.busy ? 'disabled' : ''}>Check</button>${showStep ? '<button class="btn secondary" data-act="show-step">Show me a step</button>' : ''}${run.adaptive ? '' : `<span class="muted small">Answers are saved as you go.</span>`}</div>`}
      ${state.coach?.stepHint ? `<div class="feedback" style="margin-top:10px">${esc(state.coach.stepHint)}</div>` : ''}
      <div class="row" style="margin-top:22px"><button class="btn small secondary" data-act="exit-run">Stop for now</button></div>
    </section>`;
  }
  function renderInput(it, run) {
    if (it.format === 'mc4') return `<div class="options">${it.options.map((o, i) => `<button class="opt ${run.input === 'ABCD'[i] ? 'on' : ''}" data-pick="${'ABCD'[i]}">${esc(o)}</button>`).join('')}</div>`;
    if (it.format === 'multi_select') return `<p class="muted small">Choose all that are correct.</p><div class="options">${it.options.map((o, i) => `<button class="opt ${run.picked.has('ABCDEFGH'[i]) ? 'on' : ''}" data-toggle="${'ABCDEFGH'[i]}">${esc(o)}</button>`).join('')}</div>`;
    if (it.format === 'ordering') { const order = run.order || it.options; return `<p class="muted small">Use the arrows to put them in order (top = smallest / first).</p><ol class="orderlist">${order.map((o, i) => `<li><span>${esc(o)}</span><span><button class="mini" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>▲</button><button class="mini" data-move="${i}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''}>▼</button></span></li>`).join('')}</ol>`; }
    if (it.format === 'short_text' || it.format === 'writing') return `<textarea class="answer" id="answer" rows="${it.format === 'writing' ? 8 : 3}" placeholder="${it.format === 'writing' ? 'Write here…' : 'Type your answer in a sentence or two'}">${esc(run.input ?? '')}</textarea>`;
    return `<input type="text" class="answer" id="answer" autocomplete="off" inputmode="${it.format === 'numeric' ? 'decimal' : 'text'}" placeholder="Your answer" value="${esc(run.input ?? '')}">`;
  }
  function renderFeedback(fb, it) {
    if (fb.retry) return `<div class="feedback again"><strong>Look again.</strong> ${esc(fb.hint)}<div class="row" style="margin-top:12px"><button class="btn" data-act="next">Try again</button></div></div>`;
    const ans = Array.isArray(fb.answer) ? fb.answer.join(' → ') : fb.answer;
    const given = Array.isArray(fb.given) ? fb.given.join(', ') : fb.given;
    return `<div class="feedback ${fb.correct ? 'right' : 'again'}"><strong>${fb.correct ? '✓ Correct' : 'Not this time'}</strong>${fb.correct ? '' : ` — the answer is <b>${esc(ans)}</b>.`}${fb.explanation ? `<div class="small" style="margin-top:6px">${esc(fb.explanation)}</div>` : ''}${fb.correct ? '' : `<div class="muted small" style="margin-top:4px">You wrote: ${esc(given)}</div>`}${fb.coach ? `<div class="bubble assistant" style="margin-top:10px">${esc(fb.coach)}</div>` : ''}<div class="row" style="margin-top:12px"><button class="btn" data-act="next">Next</button></div></div>`;
  }
  function viewResults(r) {
    const secured = r.secured?.length ? `<p class="celebrate">Secure ✓ ${r.secured.map(esc).join(', ')}</p>` : '';
    const areas = r.by_area?.length ? `<h3 style="margin-top:18px">By area</h3>${r.by_area.map((a) => `<div class="skill"><div><div>${esc(a.area)}</div><div class="bar"><i style="width:${Math.round(a.rate * 100)}%"></i></div><div class="meta">${a.correct} of ${a.items}</div></div><div>${a === r.by_area[0] ? '<span class="chip emerging">work here next</span>' : ''}</div></div>`).join('')}` : '';
    const regressed = r.regressed?.length ? `<p class="notice">Back to practice: ${r.regressed.map(esc).join(', ')}</p>` : '';
    return `<section class="card"><h2>${r.kind === 'diagnostic' ? 'Check complete' : r.kind === 'knowledge_check' ? 'Memory game' : 'Done'}</h2>
      <div class="metric"><div class="big">${r.correct} <span class="muted" style="font-size:.5em">of ${r.total}</span></div><div class="lbl">correct · +${r.points} points · ${mmss(r.duration_s || 0)}</div></div>${secured}${regressed}${areas}
      <h3 style="margin-top:18px">By skill</h3>
      ${r.per_skill.map((s) => `<div class="skill"><div><div>${esc(s.name)}</div><div class="bar"><i style="width:${Math.round(s.rate * 100)}%"></i></div><div class="meta">${s.correct} of ${s.items}${s.status_before !== s.status_after ? ` · ${STATUS[s.status_before]} → <b>${STATUS[s.status_after]}</b>` : ''}</div></div><div>${chip(s.status_after)}</div></div>`).join('')}
      ${r.next_steps?.length ? `<h3 style="margin-top:18px">What to do next</h3><div class="stack">${r.next_steps.map((n) => `<div class="row spread"><span>${esc(n.name)}</span><button class="btn small" data-act="coach" data-skill="${esc(n.skill_id)}">Learn with coach</button></div>`).join('')}</div>` : ''}
      <details style="margin-top:18px"><summary class="muted">See every question</summary>${r.items.map((i) => `<div class="skill"><div><div>${esc(i.stem)}</div><div class="meta">You: ${esc(Array.isArray(i.answer_given) ? i.answer_given.join(', ') : i.answer_given ?? '—')} · Answer: ${esc(Array.isArray(i.answer) ? i.answer.join(' → ') : i.answer ?? (i.rubric ? 'see rubric' : ''))}${i.feedback ? ` · ${esc(i.feedback)}` : ''}</div></div><div>${i.correct ? '<span class="ok">✓</span>' : i.correct === false ? '<span class="muted">✗</span>' : '<span class="muted small">to be marked</span>'}</div></div>`).join('')}</details>
      <div class="row" style="margin-top:20px"><button class="btn" data-act="exit-run">Done for today</button></div></section>`;
  }
  async function reviewTest(id) {
    state.busy = true; render();
    try { const r = await api(`/test?id=${encodeURIComponent(id)}`); const per = r.test.per_skill || {}; state.run = { done: { kind: r.test.kind, correct: r.items.filter((i) => i.correct).length, total: r.items.filter((i) => i.correct != null).length, points: 0, duration_s: r.test.duration_s, per_skill: Object.entries(per).map(([id, p]) => ({ skill_id: id, name: skillName(state.dash, id), items: p.items, correct: p.correct, rate: p.items ? p.correct / p.items : 0, status_before: '', status_after: state.dash.skills.find((s) => s.id === id)?.status || 'not_yet' })), items: r.items, next_steps: [], secured: [] } }; }
    catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  function afterRender() {
    const t = $('#timer'); if (t && state.run && !state.run.done) { clearInterval(state.timer); state.timer = setInterval(() => { const el = $('#timer'); if (!el) return clearInterval(state.timer); const elapsed = Math.round((Date.now() - state.run.startedAt) / 1000); const lim = $('#limit'); let extra = ''; if (lim && !state.run.feedback) { const left = Number(lim.dataset.limit) - Math.round((Date.now() - state.run.itemStart) / 1000); extra = ` · <span id="limit" data-limit="${lim.dataset.limit}">${Math.max(0, left)}s</span>`; if (left <= 0 && !state.busy) { checkAnswer(); return; } } el.innerHTML = mmss(elapsed) + extra; }, 500); }
    const a = $('#answer'); if (a) { a.focus(); a.addEventListener('input', () => { state.run.input = a.value; }); a.addEventListener('keydown', (e) => { if (e.key === 'Enter' && a.tagName !== 'TEXTAREA') checkAnswer(); }); }
    const ci = $('#coach-input'); if (ci) { ci.addEventListener('input', () => { state.coach.input = ci.value; }); ci.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCoach(); } }); if (!state.coach.busy) ci.focus(); }
    const chat = $('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
    const rd = document.querySelector('[data-toggle-read]'); if (rd) rd.addEventListener('change', () => { state.coach.autoRead = rd.checked; localStorage.setItem('elchin.autoread', rd.checked ? '1' : '0'); });
  }
  async function sendCoach() { const c = state.coach; if (!c || c.busy) return; const msg = (c.input || '').trim(); if (!msg) return; c.input = ''; await coachTurn({ message: msg }); }

  // ---------------------------------------------------------------- progress
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
              <div class="row">${chip(s.status)}${d.role === 'student' && !isSec(s) ? `<button class="mini" title="Learn with the coach" data-act="coach" data-skill="${esc(s.id)}">Learn</button>` : ''}${d.role === 'student' && s.subject === 'Mathematics' ? `<button class="mini" title="Quick check on this skill" data-act="check-skill" data-skill="${esc(s.id)}">Check</button>` : ''}</div></div>`).join('')}</details>`).join('')}</details>`; }).join('')}
      </section>`;
  }

  // ---------------------------------------------------------------- parent
  function viewParent(d) {
    const tabs = [['overview', 'Overview'], ['manual', 'Paper diagnostic'], ['queue', `Marking queue${d.marking_queue_count ? ` (${d.marking_queue_count})` : ''}`], ['transcripts', 'Coach transcripts'], ['rewards', 'Points & rewards'], ['map', 'MAP scores'], ['settings', 'Settings'], ['exports', 'Exports & admin']];
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
        <div class="metric"><div class="big">${m.retention_rate == null ? '—' : Math.round(m.retention_rate * 100) + '%'}</div><div class="lbl">retention rate (30 days)</div></div>
        <div class="metric"><div class="big">${m.streak_days}</div><div class="lbl">day streak</div></div>
      </div>
      <p class="muted small" style="margin-top:12px">Weekly 10-minute review together (docs/07 §4): lead with one KPI that went up, one to work on, one thing he chooses. Never lead with focus ratio.</p></section>
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
  function pQueue(d) {
    if (!state.queue) { api('/marking-queue').then((r) => { state.queue = r.queue; render(); }).catch((e) => { state.queue = []; state.error = e.message; render(); }); return '<section class="card"><h2>Marking queue</h2><p class="muted">Loading…</p></section>'; }
    if (!state.queue.length) return '<section class="card"><h2>Marking queue</h2><p class="muted">Nothing waiting. Open answers the AI marked with confidence below 0.8, plus a 10 % random sample, appear here.</p></section>';
    return `<section class="card"><h2>Marking queue <span class="muted" style="font-size:.6em">${state.queue.length} to review</span></h2>
      ${state.queue.map((q) => `<div class="qitem"><div class="row spread"><span><b>${esc(skillName(d, q.skill_id))}</b> <span class="muted small">${esc(q.skill_id)} · tier ${q.tier} · ${q.why === 'random_sample' ? 'random sample' : `AI confidence ${q.confidence}`}</span></span><span class="muted small">${fmtDate(q.answered_at)}</span></div>
        ${q.passage_title ? `<div class="muted small">Passage: ${esc(q.passage_title)}</div>` : ''}
        <p style="margin:6px 0"><span class="muted small">Question</span><br>${esc(q.stem)}</p>
        <p style="margin:6px 0"><span class="muted small">Rubric / expected</span><br>${esc(q.rubric || '—')}</p>
        <p style="margin:6px 0;background:var(--porcelain);padding:8px 10px"><span class="muted small">Elchin wrote</span><br>${esc(q.answer_given || '(blank)')}</p>
        <p class="small muted">AI: ${q.llm_correct ? 'correct' : 'not correct'}${q.llm_partial != null ? ` · partial ${q.llm_partial}` : ''}${q.llm_feedback ? ` · "${esc(q.llm_feedback)}"` : ''}</p>
        <div class="row"><button class="btn small copper" data-act="pmark" data-id="${q.id}" data-correct="1">✓ Correct</button><button class="btn small secondary" data-act="pmark" data-id="${q.id}" data-correct="0">✗ Not correct</button><input type="text" placeholder="Optional feedback to Elchin" data-fb="${q.id}" style="flex:1;min-width:200px"></div></div>`).join('')}</section>`;
  }
  function pTranscripts(d) {
    if (!d.coach_sessions.length) return '<section class="card"><h2>Coach transcripts</h2><p class="muted">No coach sessions yet.</p></section>';
    return `<section class="card"><h2>Coach transcripts</h2><table><tr><th>Date</th><th>Skill</th><th>State</th><th class="num">Cycle</th><th class="num">Turns</th><th>Outcome</th><th>Parent summary</th><th></th></tr>
      ${d.coach_sessions.map((s) => `<tr><td>${fmtDate(s.started_at)}</td><td>${esc(skillName(d, s.skill_id))}</td><td>${esc(s.loop_state)}</td><td class="num">${s.cycle_number}</td><td class="num">${s.turns}</td><td>${esc(s.outcome || '')}</td><td class="small">${esc(s.parent_summary || '')}</td><td><button class="btn small secondary" data-act="transcript" data-id="${s.id}">Read</button></td></tr>`).join('')}</table>
      ${state.transcript ? `<h3 style="margin-top:16px">${esc(skillName(d, state.transcript.skill_id))} · ${fmtDate(state.transcript.started_at)}</h3>${state.transcript.flag_note ? `<div class="notice">Flag: ${esc(state.transcript.flag_note)}</div>` : ''}<div class="chat" style="max-height:60vh">${(state.transcript.messages || []).map((m) => `<div class="bubble ${m.role}"><span class="muted small">${m.role === 'user' ? (m.event ? 'app' : 'Elchin') : 'coach'}</span><br>${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('')}</div>` : ''}</section>`;
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
      <h3 style="margin-top:20px">Mastery thresholds (read-only)</h3><p class="muted small">Pass rate ${s.pass_rate ?? 0.9} · regression below ${s.regress_rate ?? 0.7} · qualifying test ≥ 3 items · fluency ≤ 3 s per item · coach block 30 min · coach cap 60 min/day. These are data, not opinion (docs/02 §3); change them only by a deliberate decision in the schema.</p></section>`;
  }
  function pExports(d) {
    return `<div class="grid"><section class="card"><h2>Exports</h2><p class="muted small">The weekly PDF is a one-page report for the class teacher: skills by status, minutes, what was secured, next steps. CSVs are your backup.</p>
        <div class="row" style="margin-bottom:10px"><button class="btn small" data-act="download" data-path="/export/weekly.pdf" data-name="elchin-week.pdf">Weekly PDF for the teacher</button></div>
        <div class="row">${['skill_state', 'tests', 'test_items', 'coach_sessions', 'points', 'map_results'].map((t) => `<button class="btn small secondary" data-act="download" data-path="/export/csv?table=${t}" data-name="${t}.csv">${t}.csv</button>`).join('')}</div>
        <p class="muted small" style="margin-top:10px">Retention rate: ${d.metrics.retention_rate == null ? '— (no mastered skills yet)' : Math.round(d.metrics.retention_rate * 100) + '% of mastered skills held over the last 30 days'}.</p></section>
      <section class="card"><h2>Item bank</h2><p class="muted small">Reading, Language Usage and Science questions come from a verified bank. Seed loads the hand-written starter content; Refill asks Claude to top up every skill below 10 items per tier (needs the API key; costs a few cents).</p>
        <div class="row"><button class="btn small" data-act="seed">Seed content</button><button class="btn small secondary" data-act="refill">Refill bank now</button><button class="btn small secondary" data-act="bank-status">Show stock</button></div>
        ${state.bank ? `<table style="margin-top:12px"><tr><th>Skill</th><th class="num">P</th><th class="num">t1</th><th class="num">t2</th><th class="num">t3</th></tr>${state.bank.skills.map((s) => `<tr><td>${esc(s.name)} <span class="muted small">${esc(s.skill_id)}</span></td><td class="num">${s.priority}</td>${s.stock.map((n) => `<td class="num ${n < state.bank.min ? 'muted' : 'ok'}">${n}</td>`).join('')}</tr>`).join('')}</table>` : ''}</section></div>`;
  }

  // ---------------------------------------------------------------- events
  function bind(root) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; localStorage.setItem('elchin.tab', state.tab); state.error = null; state.notice = null; render(); }));
    root.querySelectorAll('[data-ptab]').forEach((b) => b.addEventListener('click', () => { state.ptab = b.dataset.ptab; state.error = null; state.notice = null; if (state.ptab === 'queue') state.queue = null; render(); }));
    root.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', () => { const q = b.dataset.mark, v = b.dataset.val === 'yes'; if (state.manual.marks[q] === v) delete state.manual.marks[q]; else state.manual.marks[q] = v; render(); }));
    root.querySelectorAll('[data-manual]').forEach((i) => i.addEventListener('input', () => { state.manual[i.dataset.manual] = i.value; }));
    root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { state.run.input = b.dataset.pick; render(); }));
    root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.toggle; state.run.picked.has(k) ? state.run.picked.delete(k) : state.run.picked.add(k); render(); }));
    root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => { const run = state.run; const order = (run.order || run.item.options).slice(); const i = Number(b.dataset.move), j = i + Number(b.dataset.dir); [order[i], order[j]] = [order[j], order[i]]; run.order = order; render(); }));
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset)));
    root.querySelectorAll('form[data-form]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); submit(f.dataset.form, Object.fromEntries(new FormData(f).entries())); }));
  }
  async function act(name, ds) {
    try {
      state.error = null;
      if (name === 'logout') { await sb.auth.signOut(); state.session = null; state.dash = null; render(); }
      else if (name === 'retry') await refresh();
      else if (name === 'tour-next') { if (state.tour >= 3) { localStorage.setItem('elchin.tour_done', '1'); state.tour = 0; } else state.tour++; render(); }
      else if (name === 'tour-skip') { localStorage.setItem('elchin.tour_done', '1'); state.tour = 0; render(); }
      else if (name === 'coach') await coachStart(ds.skill);
      else if (name === 'coach-resume') await coachStart(state.coachOpen.skill_id, ds.id);
      else if (name === 'coach-send') await sendCoach();
      else if (name === 'coach-mic') listen();
      else if (name === 'coach-practice') await coachSet('practice10');
      else if (name === 'coach-confirm') await coachSet('confirm5');
      else if (name === 'coach-replacement') await coachReplacement();
      else if (name === 'coach-end') { if (state.coach?.session_id) await coachTurn({ event: { type: 'end' } }, { silent: true }); else { state.coach = null; render(); } }
      else if (name === 'show-step') { const c = state.coach; const r = await api('/coach', { session_id: c.session_id, skill_id: c.skill_id, event: { type: 'show_step', stem: state.run.item.stem } }); c.stepHint = r.reply; c.messages.push({ role: 'assistant', content: r.reply }); c.wrongStreak = 0; if (c.autoRead) speak(r.reply); render(); }
      else if (name === 'start') await startRun(ds.mode, ds.subject);
      else if (name === 'special') await startRun(ds.mode, ds.subject || 'Mathematics');
      else if (name === 'download') { const r = await fetch(CFG.WORKER_URL + ds.path, { headers: { Authorization: `Bearer ${state.session.access_token}` } }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ds.name; a.click(); }
      else if (name === 'check-skill') await startRun('diagnostic', 'Mathematics', [ds.skill]);
      else if (name === 'check') { if (state.coach) state.coach.stepHint = null; await checkAnswer(); }
      else if (name === 'next') await nextItem();
      else if (name === 'review-test') await reviewTest(ds.id);
      else if (name === 'exit-run') { clearInterval(state.timer); state.run = null; if (state.coach) state.coach.run = null; state.recent = null; await refresh(); }
      else if (name === 'transcript') { state.transcript = await api(`/coach/session?id=${encodeURIComponent(ds.id)}`); render(); }
      else if (name === 'redeem') { const r = await api('/rewards/redeem', { id: Number(ds.id) }); state.notice = `Redeemed. Balance ${r.balance}.`; await refresh(); }
      else if (name === 'del-reward') { await api('/rewards/delete', { id: Number(ds.id) }); await refresh(); }
      else if (name === 'pmark') { const fb = document.querySelector(`[data-fb="${ds.id}"]`)?.value || ''; await api('/parent-mark', { item_id: ds.id, correct: ds.correct === '1', feedback: fb || undefined }); state.queue = null; await refresh(); }
      else if (name === 'seed') { state.busy = true; render(); const r = await api('/admin/seed', {}); state.busy = false; state.notice = `Seeded ${r.passages} passages and ${r.items} items${r.rejected?.length ? `; rejected: ${r.rejected.join('; ')}` : ''}.`; state.bank = null; render(); }
      else if (name === 'refill') { state.busy = true; render(); const r = await api('/admin/refill-bank', { max_calls: 12 }); state.busy = false; state.notice = `Refill: ${r.generated} items in ${r.calls} calls${r.stopped ? ` (stopped: ${r.stopped})` : ''}${r.skipped?.length ? `; skipped ${r.skipped.length}` : ''}.`; state.bank = null; render(); }
      else if (name === 'bank-status') { state.bank = await api('/bank/status'); render(); }
      else if (name === 'submit-manual') {
        if (!Object.keys(state.manual.marks).length) throw new Error('Mark at least one question first.');
        state.busy = true; render();
        const r = await api('/manual-entry', { source: 'diagnostic_1', marks: state.manual.marks, minutes: Number(state.manual.minutes) || undefined, q4_seconds: Number(state.manual.q4) || undefined, date: state.manual.date || undefined });
        state.busy = false; state.manual = { marks: {}, minutes: '', q4: '', date: '' };
        state.notice = `Saved: ${r.score} of ${r.total} correct. Skill states updated: ${r.skill_states.map((s) => `${esc(s.skill_id)} → ${STATUS[s.status]}`).join(', ')}.`;
        state.ptab = 'overview'; await refresh();
      }
    } catch (e) { state.busy = false; if (state.coach) state.coach.busy = false; state.error = e.message; render(); }
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
