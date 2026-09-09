/* Elchin Learning — single-page app (BRIEF §7). No framework, no build step. Talks to Supabase Auth directly and to the
   Cloudflare Worker for everything else. "Overworld" skin (design/design-language.md): quests = checks, map = progress.
   Student UI words: Quest, Check, Try again, Next, Done for today. The AI coach is behind FEATURES.coach (off). */
(() => {
  const CFG = window.ELCHIN_CONFIG;
  const FEAT = CFG.FEATURES || {};
  const PARAMS = new URLSearchParams(location.search);
  const PREVIEW = PARAMS.get('preview') === '1';                      // design preview: fixture data, nothing written
  const sb = PREVIEW ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: CFG.TIMEZONE }) : '—');
  const pct = (r) => (r == null ? '—' : Math.round(r * 100) + '%');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: CFG.TIMEZONE });
  const STATUS = { not_yet: 'Not yet', emerging: 'Getting there', secure: 'Secure', mastered: 'Mastered' };
  const SUBJECT_ORDER = ['Mathematics', 'Reading', 'Language Usage', 'Science'];
  const SUBJECT_BLOCK = { Mathematics: 'diamond', Reading: 'planks', 'Language Usage': 'gold', Science: 'emerald' };
  const SUBJECT_KID = { Mathematics: 'Maths', Reading: 'Reading', 'Language Usage': 'Language', Science: 'Science' };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const isSec = (s) => s.status === 'secure' || s.status === 'mastered';

  const state = { session: null, dash: null, tab: PARAMS.get('tab') || localStorage.getItem('elchin.tab') || 'home', ptab: PARAMS.get('ptab') || 'overview', error: null, busy: false, template: null, manual: { marks: {}, minutes: '', q4: '', date: '' }, notice: null, run: null, recent: null, queue: null, bank: null, coach: null, tour: 0, unlockDraft: null, toast: null };
  if (!['home', 'quests', 'map', 'coach', 'parent'].includes(state.tab)) state.tab = 'home';

  // ---------------------------------------------------------------- terms & unlocking (parent-controlled)
  function termOf(skill) { return (CFG.TERMS.find((t) => t.match(skill)) || CFG.TERMS[CFG.TERMS.length - 1]).id; }
  function termLabel(id) { return CFG.TERMS.find((t) => t.id === id)?.label || id; }
  function unlockedSet(d) { const u = d.student.settings?.unlocked_skills; return Array.isArray(u) ? new Set(u) : null; }   // null = everything open
  function isUnlocked(d, skill) { const u = unlockedSet(d); return !u || u.has(skill.id); }
  function levelOf(points) { const lvl = Math.floor(points / 100) + 1; return { lvl, into: points % 100 }; }

  // ---------------------------------------------------------------- api
  async function api(path, body, method) {
    if (PREVIEW) return previewApi(path, body);
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
  function track(kind, payload) { if (!state.session || PREVIEW) return; tele.buf.push({ kind, at: new Date().toISOString(), payload }); }
  document.addEventListener('visibilitychange', () => track(document.hidden ? 'hidden' : 'visible'));
  let lastActivity = Date.now();
  ['keydown', 'pointerdown'].forEach((ev) => document.addEventListener(ev, () => { const t = Date.now(); if (t - lastActivity > 90000) track('active'); lastActivity = t; }));
  setInterval(() => { if (Date.now() - lastActivity > 90000) track('idle'); }, 30000);
  setInterval(async () => { if (!tele.buf.length || !state.session || state.dash?.role !== 'student') return; const events = tele.buf.splice(0); try { await api('/telemetry', { session_id: tele.session_id, events }); } catch { tele.buf.unshift(...events.slice(-50)); } }, 30000);

  // ---------------------------------------------------------------- auth
  async function init() {
    if (PREVIEW) { state.session = { access_token: 'preview' }; await refresh(); if (PARAMS.get('start')) await startRun(PARAMS.get('start'), PARAMS.get('subject') || 'Mathematics'); return; }
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
    if (!state.dash) { app.innerHTML = state.error ? `<div class="panel"><div class="error">${esc(state.error)}</div><button class="btn" data-act="retry">Try again</button> <button class="btn" data-act="logout">Sign out</button></div>` : '<div class="loading px">Loading world…</div>'; bind(app); return; }
    const d = state.dash, m = d.metrics, isParent = d.role === 'parent';
    const tabs = [['home', 'Home', 'grass'], ['quests', 'Quests', 'planks'], ['map', 'Map', 'diamond'], ...(FEAT.coach ? [['coach', 'Coach', 'emerald']] : []), ...(isParent ? [['parent', 'Parent', 'cobble']] : [])];
    const tour = !isParent && !PREVIEW && !localStorage.getItem('elchin.tour_done') ? viewTour() : '';
    const lv = levelOf(d.points.balance);
    const hearts = Array.from({ length: 10 }, (_, i) => (i < Math.min(10, m.streak_days) ? '<b>♥</b>' : '♥')).join('');
    app.innerHTML = `
      <header class="top">
        <div class="brand">Elchin Learning<small>${isParent ? 'PARENT VIEW' : `${m.days_to_due} DAYS TO 1 OCTOBER`}</small></div>
        <div class="hud" aria-label="Level and streak">
          <div class="lbls"><span>LEVEL ${lv.lvl}</span><span>${d.points.balance} POINTS</span></div>
          <div class="xp" role="progressbar" aria-valuenow="${lv.into}" aria-valuemin="0" aria-valuemax="100" aria-label="Points to next level"><i style="width:${lv.into}%"></i><b>${lv.into} / 100</b></div>
          <div class="lbls"><span class="hearts" aria-label="${m.streak_days} day streak">${hearts}</span><span>${m.streak_days} DAY STREAK</span></div>
        </div>
        <div class="who"><span>${esc(isParent ? 'Huseyn' : d.student.name)}${PREVIEW ? ' · PREVIEW' : ''}</span><button class="btn small" data-act="logout">Sign out</button></div>
      </header>
      <nav class="hotbar" aria-label="Sections">${tabs.map(([k, l, b]) => `<button class="slot ${state.tab === k ? 'active' : ''}" data-tab="${k}" aria-current="${state.tab === k ? 'page' : 'false'}"><span class="block ${b}" aria-hidden="true"></span>${l}${k === 'parent' && d.marking_queue_count ? `<span class="badge">${d.marking_queue_count}</span>` : ''}</button>`).join('')}</nav>
      ${state.error ? `<div class="error" role="alert">${esc(state.error)}</div>` : ''}
      ${state.notice ? `<div class="notice">${state.notice}</div>` : ''}
      <main id="main">${({ home: viewHome, quests: viewQuests, coach: viewCoach, map: viewMap, parent: viewParent })[state.tab]?.(d) || ''}</main>
      <footer class="muted small" style="margin:30px 0 10px;color:#fff;text-shadow:1px 1px 0 #000">${PREVIEW ? 'Preview with fictional data — nothing is saved. ' : ''}${d.llm_mode === 'mock' ? 'AI questions are in preview mode (no API key yet). ' : ''}${d.repo_mode === 'user-rls' ? 'Read-only until the service key is set. ' : ''}</footer>
      ${state.toast ? `<div class="toast" role="status"><small>ACHIEVEMENT GET!</small>${esc(state.toast)}</div>` : ''}
      ${tour}`;
    bind(app);
    afterRender();
  }

  function viewLogin() {
    return `<div class="login"><div class="brand">Elchin Learning</div><div class="panel"><h2>Sign in</h2>
      ${state.error ? `<div class="error" role="alert">${esc(state.error)}</div>` : ''}
      <form data-form="login" class="stack">
        <label class="f"><span>EMAIL</span><input type="email" name="email" autocomplete="username" required></label>
        <label class="f"><span>PASSWORD</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn go full" ${state.busy ? 'disabled' : ''}>Enter world</button>
      </form></div></div>`;
  }
  function viewTour() {
    const steps = [
      ['Welcome', 'This is your learning world. Every day has a short list of quests. Do them in order and you are done for the day.'],
      ['Quests', 'A quest is a set of questions. Getting one wrong is normal — it shows what to practise with your tutor.'],
      ['Map', 'The Map shows every topic as a block. Stone = not yet, copper = getting there, grass = secure, diamond = mastered. Dark blocks are locked until Dad opens them.'],
      ['Points', 'Every correct answer earns points. 100 points = one level. Dad decides what points can buy.'],
    ];
    const [t, txt] = steps[state.tour];
    return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title"><div class="panel tour"><div class="muted tiny px">${state.tour + 1} OF ${steps.length}</div><h2 id="tour-title">${t}</h2><p>${txt}</p><div class="row spread"><button class="btn small" data-act="tour-skip">Skip</button><button class="btn go" data-act="tour-next">${state.tour === steps.length - 1 ? 'Start' : 'Next'}</button></div></div></div>`;
  }

  function chip(s, extra = '') { return `<span class="chip ${s} ${extra}"><span class="block" aria-hidden="true"></span>${STATUS[s] || s}</span>`; }
  function lockChip() { return '<span class="chip locked">🔒 Locked</span>'; }
  function skillName(d, id) { return d.skills.find((s) => s.id === id)?.name || id; }
  function subjectIcon(sub, size = '') { return `<span class="block ${SUBJECT_BLOCK[sub] || 'stone'} ${size}" aria-hidden="true"></span>`; }

  // ---------------------------------------------------------------- home (docs/02 §4 fixed daily order, coach step replaced by a topic quest)
  function viewHome(d) {
    if (!state.recent) { api('/tests?limit=20').then((r) => { state.recent = r.tests; render(); }).catch(() => { state.recent = []; render(); }); }
    const today = todayKey();
    const doneKinds = new Set((state.recent || []).filter((t) => t.status === 'complete' && (t.submitted_at || t.started_at || '').slice(0, 10) === today).map((t) => t.kind));
    const hasReviewable = d.skills.some((s) => ['emerging', 'secure', 'mastered'].includes(s.status));
    const open = d.skills.filter((s) => isUnlocked(d, s) && !isSec(s));
    const focus = d.urgency.map((u) => open.find((s) => s.id === u.id)).find(Boolean) || open[0];
    const openDiag = (state.recent || []).find((t) => t.kind === 'diagnostic' && t.status !== 'complete');
    const step = (n, title, sub, done, btn) => `<li class="step ${done ? 'done' : ''}"><div class="num" aria-hidden="true">${done ? '✓' : n}</div><div><div class="stitle">${title}</div><div class="sub">${sub}</div></div><div>${done ? '<span class="ok">Done</span>' : btn}</div></li>`;
    const allDone = doneKinds.has('reading') && (doneKinds.has('targeted') || doneKinds.has('diagnostic')) && (doneKinds.has('review') || doneKinds.has('daily_review') || !hasReviewable);
    return `<div class="grid">
      <section class="panel"><h2>Today's quests</h2><p class="muted">Three quests, always in this order. Start with the first.</p>
        <ol class="steps">
          ${step(1, 'Daily review', d.today.review_due.length ? `${d.today.review_due.length} topics are due — 10 quick questions.` : hasReviewable ? '10 quick questions on topics you already know.' : 'Starts once you have a few topics going.', doneKinds.has('review') || doneKinds.has('daily_review'), hasReviewable ? `<button class="btn go small" data-act="start" data-mode="${d.today.review_due.length ? 'review' : 'daily_review'}" data-subject="Mathematics">Start</button>` : '')}
          ${step(2, 'Topic quest', focus ? `${esc(focus.name)} <span class="muted">· ${esc(SUBJECT_KID[focus.subject])}</span> ${chip(focus.status)}` : 'Every open topic is secure. Ask Dad to unlock the next ones!', doneKinds.has('targeted') || doneKinds.has('diagnostic'), focus ? `<button class="btn go small" data-act="check-skill" data-skill="${esc(focus.id)}" data-subject="${esc(focus.subject)}">Start</button>` : '')}
          ${step(3, 'Story quest', 'Read a short passage and answer 5–6 questions.', doneKinds.has('reading'), `<button class="btn go small" data-act="start" data-mode="reading" data-subject="Reading">Start</button>`)}
          ${openDiag ? step(4, 'Continue your quest', `${openDiag.progress?.skills_done ?? 0} of ${openDiag.progress?.skills_total ?? '?'} topics done.`, false, `<button class="btn small" data-act="start" data-mode="diagnostic" data-subject="${esc(openDiag.subject)}">Continue</button>`) : ''}
        </ol>
        ${allDone ? '<p class="celebrate" style="margin-top:16px"><small>ALL QUESTS COMPLETE</small>Done for today ✓</p>' : ''}
      </section>
      <div class="stack">
        <section class="panel"><h2>This week</h2>
          <div class="grid tight">
            <div class="stat inset light"><div class="big">${d.metrics.minutes_this_week} <small>/ ${d.metrics.minutes_target_week} min</small></div><div class="lbl">ACTIVE MINUTES</div><div class="bar"><i style="width:${Math.min(100, Math.round((100 * d.metrics.minutes_this_week) / Math.max(1, d.metrics.minutes_target_week)))}%"></i></div></div>
            <div class="stat inset light"><div class="big">${d.metrics.items_this_week}</div><div class="lbl">QUESTIONS ANSWERED</div></div>
            <div class="stat inset light"><div class="big">${d.metrics.secure_total} <small>/ ${d.metrics.skills_total}</small></div><div class="lbl">TOPICS SECURE</div><div class="bar diamond"><i style="width:${Math.round((100 * d.metrics.secure_total) / Math.max(1, d.metrics.skills_total))}%"></i></div></div>
          </div></section>
        <section class="panel"><h2>Treasure chest</h2>${viewRewards(d)}</section>
      </div></div>`;
  }
  function viewRewards(d) {
    const open = d.rewards.filter((r) => !r.redeemed_at);
    if (!open.length) return '<p class="muted small">The chest is empty — Dad has not put any rewards in yet.</p>';
    return open.map((r) => `<div class="row spread" style="padding:8px 0;border-top:2px solid #B4B4B4"><span><span class="block gold" aria-hidden="true"></span> ${esc(r.name)} <span class="muted small">${r.cost} pts</span></span>${d.role === 'student' ? `<button class="btn gold small" data-act="redeem" data-id="${r.id}" ${d.points.balance < r.cost ? 'disabled' : ''}>Open</button>` : ''}</div>`).join('');
  }

  // ---------------------------------------------------------------- quests (tests)
  function viewQuests(d) {
    if (state.run) return viewRunner(d);
    if (!state.recent) { api('/tests?limit=8').then((r) => { state.recent = r.tests; render(); }).catch(() => { state.recent = []; render(); }); }
    const openDiag = (state.recent || []).find((t) => t.kind === 'diagnostic' && t.status !== 'complete');
    const gate = unlockedSet(d);
    const card = (sub) => {
      const all = d.skills.filter((s) => s.subject === sub), open = all.filter((s) => isUnlocked(d, s)), weak = open.filter((s) => !isSec(s));
      const isReading = sub === 'Reading';
      return `<div class="quest"><div class="qt">${subjectIcon(sub, 'lg')}${esc(SUBJECT_KID[sub])}</div>
        <div class="qd">${open.length} of ${all.length} topics open · ${open.filter(isSec).length} secure</div>
        <div class="bar"><i style="width:${Math.round((100 * open.filter(isSec).length) / Math.max(1, open.length))}%"></i></div>
        ${isReading ? `<button class="btn go full" data-act="start" data-mode="reading" data-subject="Reading">Story quest</button>` : ''}
        <button class="btn ${isReading ? '' : 'go'} full" data-act="start" data-mode="diagnostic" data-subject="${sub}" ${open.length ? '' : 'disabled'}>Big quest — all open topics</button>
        <button class="btn full" data-act="start" data-mode="targeted" data-subject="${sub}" ${weak.length ? '' : 'disabled'}>Practice quest — weak spots</button></div>`;
    };
    const kidTerm = (t) => `<details class="term" ${t.id === 's1' ? 'open' : ''}><summary><span>${esc(t.label)}</span><span class="tiny">${esc(t.hint)}</span></summary><div class="body">${SUBJECT_ORDER.map((sub) => {
      const list = d.skills.filter((s) => s.subject === sub && termOf(s) === t.id); if (!list.length) return '';
      return `<h3 style="margin:10px 0 4px">${subjectIcon(sub)} ${esc(SUBJECT_KID[sub])}</h3><ul class="topics">${list.map((s) => { const lk = !isUnlocked(d, s); return `<li class="topic ${lk ? 'locked' : ''}"><span class="block ${lk ? 'bedrock' : { not_yet: 'stone', emerging: 'copper', secure: 'grass', mastered: 'diamond' }[s.status]}" aria-hidden="true"></span><div><div class="tname">${esc(s.name)}</div><div class="meta">${lk ? 'Locked — ask Dad' : `last ${pct(s.last_rate)} · ${s.attempts} tr${s.attempts === 1 ? 'y' : 'ies'}`}</div></div><div>${lk ? '' : `<button class="btn small" data-act="check-skill" data-skill="${esc(s.id)}" data-subject="${esc(s.subject)}">Quest</button>`}</div></li>`; }).join('')}</ul>`; }).join('')}</div></details>`;
    return `<section class="panel"><h2>Pick a quest</h2>
        ${openDiag ? `<div class="notice">You have a quest in progress — ${openDiag.progress?.skills_done ?? 0} of ${openDiag.progress?.skills_total ?? '?'} topics done. <button class="btn small go" data-act="start" data-mode="diagnostic" data-subject="${esc(openDiag.subject)}">Continue</button></div>` : ''}
        ${gate ? '' : '<p class="muted small">All topics are open right now.</p>'}
        <div class="quests">${SUBJECT_ORDER.map(card).join('')}</div>
        <h3 style="margin-top:20px">Games</h3>
        <div class="row"><button class="btn gold" data-act="special" data-mode="knowledge_check">Memory game — 20 questions</button><button class="btn" data-act="special" data-mode="map_mock" data-subject="Mathematics">Boss quest — 40 maths questions</button></div>
        <p class="muted small">Memory game: once a month, no hints, points for every one you remember. Boss quest: like the school's MAP test, mixed topics, untimed.</p></section>
      <section class="panel"><h2>Topics</h2><p class="muted small">Dark blocks are locked. Dad opens new topics when the ones before are solid.</p>${CFG.TERMS.map(kidTerm).join('')}</section>
      <section class="panel"><h2>Recent quests</h2>${state.recent == null ? '<p class="muted">Loading…</p>' : state.recent.length === 0 ? '<p class="muted">No quests yet. Pick one above!</p>' : `<div style="overflow-x:auto"><table><tr><th>Date</th><th>Quest</th><th>Subject</th><th class="num">Score</th><th></th></tr>${state.recent.map((t) => `<tr><td>${fmtDate(t.started_at)}</td><td>${esc(kindLabel(t.kind))}</td><td>${esc(SUBJECT_KID[t.subject] || t.subject)}</td><td class="num">${t.score == null ? (t.status === 'complete' ? '—' : 'in progress') : pct(t.score)}</td><td>${t.status === 'complete' ? `<button class="btn small" data-act="review-test" data-id="${t.id}">See</button>` : ''}</td></tr>`).join('')}</table></div>`}</section>`;
  }
  function kindLabel(k) { return { diagnostic: 'Big quest', targeted: 'Practice quest', reading: 'Story quest', review: 'Daily review', daily_review: 'Daily review', knowledge_check: 'Memory game', map_mock: 'Boss quest', practice10: 'Practice', confirm5: 'Check' }[k] || k; }

  async function startRun(mode, subject, skillIds) {
    state.busy = true; state.error = null; render();
    try {
      const r = mode === 'knowledge_check' ? await api('/knowledge-check', {}) : mode === 'map_mock' ? await api('/map-mock', { subject }) : await api('/generate-test', { subject, mode, ...(skillIds ? { skill_ids: skillIds } : {}) });
      state.run = { testId: r.test_id, mode, kind: mode, subject, adaptive: mode === 'diagnostic', item: r.item || null, items: r.items || [], index: 0, answers: {}, startedAt: Date.now(), itemStart: Date.now(), feedback: null, progress: r.progress || null, done: r.test_complete ? r.results : null, sitting: !!r.sitting_complete, input: null, order: null, picked: new Set(), passage: r.passage || null };
      if (!state.run.adaptive && state.run.items.length) state.run.item = state.run.items[0];
      state.tab = 'quests';
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
    if (run.sitting) return `<section class="panel"><p class="celebrate"><small>QUEST PAUSED</small>Done for today ✓</p><p>You finished this sitting. ${run.progress ? `${run.progress.skills_done} of ${run.progress.skills_total} topics done so far.` : ''} Come back tomorrow to continue.</p><button class="btn go" data-act="exit-run">Back</button></section>`;
    const it = run.item; if (!it) return '<section class="panel">Loading…</section>';
    const elapsed = Math.round((Date.now() - run.startedAt) / 1000);
    const fb = run.feedback;
    const posText = run.embedded ? `${(run.progress?.sitting_items ?? run.index) + 1} OF ${run.total}` : run.adaptive ? (run.progress ? `${run.progress.sitting_items + 1} OF UP TO ${run.progress.sitting_cap}` : '') : `${run.index + 1} OF ${run.items.length}`;
    const showStep = FEAT.coach && run.embedded && state.coach && state.coach.wrongStreak >= 2 && !fb;
    return `<section class="panel paper q">
      <div class="hudline"><span>${esc(kindLabel(run.kind)).toUpperCase()} · ${posText}</span><span class="timer" id="timer">${mmss(elapsed)}${it.time_limit_s ? ` · <span id="limit" data-limit="${it.time_limit_s}">${it.time_limit_s}s</span>` : ''}</span></div>
      ${it.passage ? `<div class="passage">${it.passage_title ? `<b>${esc(it.passage_title)}</b><br>` : ''}${esc(it.passage).replace(/\n/g, '<br>')}</div>` : ''}
      <p class="stem">${esc(it.stem)}</p>
      ${fb ? '' : renderInput(it, run)}
      ${fb ? renderFeedback(fb, it) : `<div class="row" style="margin-top:18px"><button class="btn go ${state.busy ? 'busy' : ''}" data-act="check" ${state.busy ? 'disabled' : ''}>Check</button>${showStep ? '<button class="btn" data-act="show-step">Show me a step</button>' : ''}${run.adaptive ? '' : `<span class="muted small">Answers are saved as you go.</span>`}</div>`}
      ${state.coach?.stepHint ? `<div class="feedback" style="margin-top:10px">${esc(state.coach.stepHint)}</div>` : ''}
      <div class="row" style="margin-top:22px"><button class="btn small" data-act="exit-run">Stop for now</button></div>
    </section>`;
  }
  function renderInput(it, run) {
    if (it.format === 'mc4') return `<div class="options" role="group" aria-label="Choose one">${it.options.map((o, i) => `<button class="opt ${run.input === 'ABCD'[i] ? 'on' : ''}" data-pick="${'ABCD'[i]}" aria-pressed="${run.input === 'ABCD'[i]}"><span class="key">${'ABCD'[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    if (it.format === 'multi_select') return `<p class="muted small">Choose all that are correct.</p><div class="options" role="group" aria-label="Choose all that apply">${it.options.map((o, i) => `<button class="opt ${run.picked.has('ABCDEFGH'[i]) ? 'on' : ''}" data-toggle="${'ABCDEFGH'[i]}" aria-pressed="${run.picked.has('ABCDEFGH'[i])}"><span class="key">${'ABCDEFGH'[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    if (it.format === 'ordering') { const order = run.order || it.options; return `<p class="muted small">Use the arrows to put them in order (top = smallest / first).</p><ol class="orderlist">${order.map((o, i) => `<li><span>${esc(o)}</span><span><button class="mini" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button> <button class="mini" data-move="${i}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span></li>`).join('')}</ol>`; }
    if (it.format === 'short_text' || it.format === 'writing') return `<textarea class="answer" id="answer" rows="${it.format === 'writing' ? 8 : 3}" placeholder="${it.format === 'writing' ? 'Write here…' : 'Type your answer in a sentence or two'}">${esc(run.input ?? '')}</textarea>`;
    return `<input type="text" class="answer" id="answer" autocomplete="off" inputmode="${it.format === 'numeric' ? 'decimal' : 'text'}" placeholder="Your answer" value="${esc(run.input ?? '')}" aria-label="Your answer">`;
  }
  function renderFeedback(fb, it) {
    if (fb.retry) return `<div class="feedback again" role="status"><strong>Look again</strong> ${esc(fb.hint)}<div class="row" style="margin-top:12px"><button class="btn go" data-act="next">Try again</button></div></div>`;
    const ans = Array.isArray(fb.answer) ? fb.answer.join(' → ') : fb.answer;
    const given = Array.isArray(fb.given) ? fb.given.join(', ') : fb.given;
    return `<div class="feedback ${fb.correct ? 'right' : 'again'}" role="status"><strong>${fb.correct ? '✓ Correct!' : 'Not this time'}</strong>${fb.correct ? '' : `The answer is <b>${esc(ans)}</b>.`}${fb.explanation ? `<div class="small" style="margin-top:6px">${esc(fb.explanation)}</div>` : ''}${fb.correct ? '' : `<div class="muted small" style="margin-top:4px">You wrote: ${esc(given)}</div>`}${fb.coach ? `<div class="bubble assistant" style="margin-top:10px">${esc(fb.coach)}</div>` : ''}<div class="row" style="margin-top:12px"><button class="btn go" data-act="next">Next</button></div></div>`;
  }
  function viewResults(r) {
    const secured = r.secured?.length ? `<p class="celebrate" style="margin-top:16px"><small>ACHIEVEMENT GET!</small>Secure ✓ ${r.secured.map(esc).join(', ')}</p>` : '';
    const areas = r.by_area?.length ? `<h3 style="margin-top:18px">By area</h3>${r.by_area.map((a) => `<div class="skillrow"><div><div>${esc(a.area)}</div><div class="bar"><i style="width:${Math.round(a.rate * 100)}%"></i></div><div class="meta">${a.correct} of ${a.items}</div></div><div>${a === r.by_area[0] ? '<span class="chip emerging"><span class="block"></span>work here next</span>' : ''}</div></div>`).join('')}` : '';
    const regressed = r.regressed?.length ? `<p class="notice">Back to practice: ${r.regressed.map(esc).join(', ')}</p>` : '';
    const rate = r.total ? r.correct / r.total : 0;
    return `<section class="panel"><h2>${r.kind === 'diagnostic' ? 'Quest complete' : r.kind === 'knowledge_check' ? 'Memory game' : 'Quest complete'}</h2>
      <div class="result-hero"><div class="score">${r.correct} / ${r.total}<small>+${r.points} POINTS · ${mmss(r.duration_s || 0)}</small></div><div><div class="bar" style="height:20px"><i style="width:${Math.round(rate * 100)}%"></i></div><p class="muted">${rate >= 0.9 ? 'Brilliant — that topic is solid.' : rate >= 0.7 ? 'Good work. A little more practice and it is secure.' : 'Tricky one. This is a good topic to go through with your tutor.'}</p></div></div>${secured}${regressed}${areas}
      <h3 style="margin-top:18px">By topic</h3>
      ${r.per_skill.map((s) => `<div class="skillrow"><div><div><b>${esc(s.name)}</b></div><div class="bar"><i style="width:${Math.round(s.rate * 100)}%"></i></div><div class="meta">${s.correct} of ${s.items}${s.status_before !== s.status_after ? ` · ${STATUS[s.status_before]} → <b>${STATUS[s.status_after]}</b>` : ''}</div></div><div>${chip(s.status_after)}</div></div>`).join('')}
      ${r.next_steps?.length ? `<h3 style="margin-top:18px">Practise next</h3><div class="stack">${r.next_steps.map((n) => `<div class="row spread"><span>${esc(n.name)}</span>${FEAT.coach ? `<button class="btn small" data-act="coach" data-skill="${esc(n.skill_id)}">Learn with coach</button>` : `<button class="btn small" data-act="check-skill" data-skill="${esc(n.skill_id)}" data-subject="${esc(n.subject || '')}">Practice quest</button>`}</div>`).join('')}</div>` : ''}
      <details style="margin-top:18px"><summary class="muted">See every question</summary>${r.items.map((i) => `<div class="skillrow"><div><div>${esc(i.stem)}</div><div class="meta">You: ${esc(Array.isArray(i.answer_given) ? i.answer_given.join(', ') : i.answer_given ?? '—')} · Answer: ${esc(Array.isArray(i.answer) ? i.answer.join(' → ') : i.answer ?? (i.rubric ? 'see rubric' : ''))}${i.feedback ? ` · ${esc(i.feedback)}` : ''}</div></div><div>${i.correct ? '<span class="ok">✓</span>' : i.correct === false ? '<span class="muted">✗</span>' : '<span class="muted small">to be marked</span>'}</div></div>`).join('')}</details>
      <div class="row" style="margin-top:20px"><button class="btn go" data-act="exit-run">Done for today</button></div></section>`;
  }
  async function reviewTest(id) {
    state.busy = true; render();
    try { const r = await api(`/test?id=${encodeURIComponent(id)}`); const per = r.test.per_skill || {}; state.run = { done: { kind: r.test.kind, correct: r.items.filter((i) => i.correct).length, total: r.items.filter((i) => i.correct != null).length, points: 0, duration_s: r.test.duration_s, per_skill: Object.entries(per).map(([sid, p]) => ({ skill_id: sid, name: skillName(state.dash, sid), items: p.items, correct: p.correct, rate: p.items ? p.correct / p.items : 0, status_before: '', status_after: state.dash.skills.find((s) => s.id === sid)?.status || 'not_yet' })), items: r.items, next_steps: [], secured: [] } }; state.tab = 'quests'; }
    catch (e) { state.error = e.message; }
    state.busy = false; render();
  }
  function afterRender() {
    const t = $('#timer'); if (t && state.run && !state.run.done) { clearInterval(state.timer); state.timer = setInterval(() => { const el = $('#timer'); if (!el) return clearInterval(state.timer); const elapsed = Math.round((Date.now() - state.run.startedAt) / 1000); const lim = $('#limit'); let extra = ''; if (lim && !state.run.feedback) { const left = Number(lim.dataset.limit) - Math.round((Date.now() - state.run.itemStart) / 1000); extra = ` · <span id="limit" data-limit="${lim.dataset.limit}">${Math.max(0, left)}s</span>`; if (left <= 0 && !state.busy) { checkAnswer(); return; } } el.innerHTML = mmss(elapsed) + extra; }, 500); }
    const a = $('#answer'); if (a) { a.focus(); a.addEventListener('input', () => { state.run.input = a.value; }); a.addEventListener('keydown', (e) => { if (e.key === 'Enter' && a.tagName !== 'TEXTAREA') checkAnswer(); }); }
    const ci = $('#coach-input'); if (ci) { ci.addEventListener('input', () => { state.coach.input = ci.value; }); ci.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCoach(); } }); if (!state.coach.busy) ci.focus(); }
    const chat = $('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
    const rd = document.querySelector('[data-toggle-read]'); if (rd) rd.addEventListener('change', () => { state.coach.autoRead = rd.checked; localStorage.setItem('elchin.autoread', rd.checked ? '1' : '0'); });
    if (state.toast) { clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => { state.toast = null; const el = $('.toast'); if (el) el.remove(); }, 4000); }
  }

  // ---------------------------------------------------------------- map (progress as a world)
  function viewMap(d) {
    const m = d.metrics;
    const tile = (s) => { const lk = !isUnlocked(d, s); return `<div class="tile ${lk ? 'locked' : s.status}" title="${esc(s.name)} · ${lk ? 'locked' : STATUS[s.status]}" tabindex="0" role="img" aria-label="${esc(s.name)}: ${lk ? 'locked' : STATUS[s.status]}${s.last_rate != null ? `, last ${pct(s.last_rate)}` : ''}"><span class="name">${esc(s.name)}</span><span class="foot">${lk ? '' : `<span class="pct">${s.last_rate != null ? pct(s.last_rate) : '—'}</span>`}${!lk && d.role === 'student' ? `<button class="mini" data-act="check-skill" data-skill="${esc(s.id)}" data-subject="${esc(s.subject)}" aria-label="Quest on ${esc(s.name)}">GO</button>` : ''}</span></div>`; };
    const bySubject = {};
    for (const s of d.skills) ((bySubject[s.subject] ??= {})[termOf(s)] ??= []).push(s);
    const subjects = Object.keys(bySubject).sort((a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b));
    return `<section class="panel"><div class="grid tight">
        <div class="stat inset light"><div class="big">${m.secure_total} <small>/ ${m.skills_total}</small></div><div class="lbl">TOPICS SECURE</div><div class="bar"><i style="width:${Math.round((100 * m.secure_total) / Math.max(1, m.skills_total))}%"></i></div></div>
        <div class="stat inset light"><div class="big">${m.mastered_total}</div><div class="lbl">MASTERED (KEPT)</div></div>
        <div class="stat inset light"><div class="big">${m.p1_secure} <small>/ ${m.p1_total}</small></div><div class="lbl">DUE 1 OCT SECURE</div><div class="bar gold"><i style="width:${m.p1_pct}%"></i></div></div>
        <div class="stat inset light"><div class="big">${m.days_to_due}</div><div class="lbl">DAYS TO 1 OCTOBER</div></div>
      </div>
      <div class="legend"><span class="chip not_yet"><span class="block"></span>Not yet</span><span class="chip emerging"><span class="block"></span>Getting there</span><span class="chip secure"><span class="block"></span>Secure</span><span class="chip mastered"><span class="block"></span>Mastered</span>${lockChip()}</div></section>
      ${subjects.map((sub) => `<section class="panel"><h2>${subjectIcon(sub, 'lg')} ${esc(SUBJECT_KID[sub])} <span class="muted tiny">${Object.values(bySubject[sub]).flat().filter(isSec).length} of ${Object.values(bySubject[sub]).flat().length} secure</span></h2>
        ${CFG.TERMS.map((t) => { const list = bySubject[sub][t.id]; if (!list?.length) return ''; return `<h3 style="margin-top:12px">${esc(t.label)} <span class="muted">· ${list.filter((s) => isUnlocked(d, s)).length} open</span></h3><div class="world">${list.map(tile).join('')}</div>`; }).join('')}</section>`).join('')}
      <section class="panel"><h2>School units due 1 October</h2><div style="overflow-x:auto"><table><tr><th>Unit</th><th class="num">Topics</th><th class="num">Secure</th><th style="width:30%"></th></tr>
        ${d.qsi_units.map((u) => `<tr><td>${esc(u.unit)} <span class="muted small">${esc(u.course)}</span></td><td class="num">${u.skills}</td><td class="num">${u.secure}</td><td><div class="bar"><i style="width:${u.pct || 0}%"></i></div></td></tr>`).join('')}</table></div></section>`;
  }

  // ---------------------------------------------------------------- coach (docs/02 §2, §5) — kept behind FEATURES.coach
  function viewCoach(d) {
    const c = state.coach;
    if (!c) {
      const candidates = d.skills.filter((s) => s.status !== 'secure' && s.status !== 'mastered').map((s) => ({ ...s, score: d.urgency.find((u) => u.id === s.id)?.score ?? 0 })).sort((a, b) => b.score - a.score || (a.priority - b.priority));
      if (!state.coachOpenChecked) { state.coachOpenChecked = true; api('/coach/open').then((r) => { if (r.session) { state.coachOpen = r.session; render(); } }).catch(() => {}); }
      return `<section class="panel"><h2>Coach</h2><p class="muted">Pick a skill. The coach explains it, then you practise 10 questions, then a 5-question check.</p>
        ${state.coachOpen ? `<div class="notice">You have a session in progress on <b>${esc(skillName(d, state.coachOpen.skill_id))}</b>. <button class="btn small" data-act="coach-resume" data-id="${state.coachOpen.id}">Continue</button></div>` : ''}
        <div class="options">${candidates.slice(0, 12).map((s) => `<button class="opt" data-act="coach" data-skill="${esc(s.id)}"><div>${esc(s.name)}<div class="small">${esc(s.subject)} · ${STATUS[s.status]}</div></div></button>`).join('')}</div></section>`;
    }
    if (c.run) return viewRunner(d);
    const msgs = c.messages.filter((m) => !m.hidden);
    const actionBtn = { start_practice: '<button class="btn go" data-act="coach-practice">Start practice — 10 questions</button>', start_confirm: '<button class="btn go" data-act="coach-confirm">Start the 5-question check</button>', replacement: '<button class="btn go" data-act="coach-replacement">One more hard question</button>', suggest_break: '<button class="btn" data-act="coach-end">Take a break — done for now</button>', done: '<button class="btn" data-act="coach-end">Done for today</button>' }[c.next_action] || '';
    return `<section class="panel coach">
      <div class="row spread"><div><h2 style="margin:0">${esc(c.skill_name)}</h2><div class="muted small">${c.loop_state === 'EXPLAIN' ? `Explaining (round ${c.cycle_number})` : c.loop_state === 'PRACTICE_10' ? 'Practice' : c.loop_state === 'CONFIRM_5' ? 'Check' : 'Secure ✓'} · ${esc(c.representation || '')}</div></div>
        <div class="row">${FEAT.voice ? `<label class="small muted"><input type="checkbox" data-toggle-read ${c.autoRead ? 'checked' : ''}> Read aloud</label>` : ''}<button class="btn small" data-act="coach-end">End session</button></div></div>
      <div class="chat" id="chat">${msgs.map((m) => `<div class="bubble ${m.role}">${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('')}${c.streaming ? `<div class="bubble assistant">${esc(c.streaming).replace(/\n/g, '<br>')}<span class="cursor">▍</span></div>` : ''}</div>
      ${c.loop_state === 'SECURE' ? `<p class="celebrate">Secure ✓  ${esc(c.skill_name)}</p>` : ''}
      ${actionBtn ? `<div class="row" style="margin:10px 0">${actionBtn}</div>` : ''}
      <div class="row" style="margin-top:10px">
        <textarea id="coach-input" class="answer" rows="2" placeholder="${c.busy ? 'Coach is thinking…' : 'Type here'}" ${c.busy ? 'disabled' : ''}>${esc(c.input || '')}</textarea>
        ${FEAT.voice ? `<button class="btn ${c.listening ? 'go' : ''}" data-act="coach-mic" title="Say it" ${c.busy ? 'disabled' : ''}>🎙 ${c.listening ? 'Listening…' : 'Say it'}</button>` : ''}
        <button class="btn go" data-act="coach-send" ${c.busy ? 'disabled' : ''}>Send</button>
      </div></section>`;
  }
  async function coachStart(skillId, sessionId) {
    if (!FEAT.coach) return;
    state.tab = 'coach'; state.error = null;
    state.coach = { skill_id: skillId, session_id: sessionId || null, skill_name: skillName(state.dash, skillId), messages: [], loop_state: 'EXPLAIN', cycle_number: 1, representation: '', next_action: 'continue', busy: false, streaming: '', input: '', autoRead: FEAT.voice && localStorage.getItem('elchin.autoread') === '1', wrongStreak: 0 };
    render();
    if (sessionId) {
      try { const s = await api(`/coach/session?id=${encodeURIComponent(sessionId)}`); Object.assign(state.coach, { skill_id: s.skill_id, skill_name: skillName(state.dash, s.skill_id), messages: (s.messages || []).map((m) => ({ role: m.role, content: m.content, hidden: m.role === 'user' && /^\[(APP|START|SESSION_END)/.test(m.content) })), loop_state: s.loop_state, cycle_number: s.cycle_number, representation: s.representation }); }
      catch (e) { state.error = e.message; }
      render(); return;
    }
    await coachTurn({ event: { type: 'start' } });
  }
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
  async function coachComment(event) {
    const c = state.coach; if (!c) return null;
    try { const r = await api('/coach', { session_id: c.session_id, skill_id: c.skill_id, event }); c.messages.push({ role: 'assistant', content: r.reply }); if (c.autoRead) speak(r.reply); return r.reply; } catch { return null; }
  }
  async function sendCoach() { const c = state.coach; if (!c || c.busy) return; const msg = (c.input || '').trim(); if (!msg) return; c.input = ''; await coachTurn({ message: msg }); }
  // voice: ElevenLabs via the Worker when configured, browser fallback otherwise (FEATURES.voice)
  async function speak(text) {
    if (!FEAT.voice) return;
    const clean = String(text).replace(/[*_#`]/g, '');
    try {
      const r = await fetch(CFG.WORKER_URL + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify({ text: clean }) });
      if (r.ok) { const blob = await r.blob(); const a = new Audio(URL.createObjectURL(blob)); a.play(); return; }
    } catch {}
    if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(clean); u.lang = /[Ѐ-ӿ]/.test(clean) ? 'ru-RU' : 'en-US'; u.rate = 0.95; speechSynthesis.speak(u); }
  }
  function listen() {
    const c = state.coach; if (!c || !FEAT.voice) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { state.error = 'Voice input needs Chrome on a laptop or Android. You can type instead.'; render(); return; }
    if (c.rec) { c.rec.stop(); return; }
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e) => { c.input = Array.from(e.results).map((r) => r[0].transcript).join(' '); const ta = $('#coach-input'); if (ta) ta.value = c.input; };
    rec.onend = () => { c.listening = false; c.rec = null; render(); };
    rec.onerror = () => { c.listening = false; c.rec = null; render(); };
    c.rec = rec; c.listening = true; rec.start(); render();
  }

  // ---------------------------------------------------------------- parent
  function viewParent(d) {
    const tabs = [['overview', 'Overview'], ['unlock', 'Unlock topics'], ['manual', 'Paper diagnostic'], ['queue', `Marking queue${d.marking_queue_count ? ` (${d.marking_queue_count})` : ''}`], ...(FEAT.coach ? [['transcripts', 'Coach transcripts']] : []), ['rewards', 'Points & rewards'], ['map', 'MAP scores'], ['settings', 'Settings'], ['exports', 'Exports & admin']];
    const body = { overview: pOverview, unlock: pUnlock, manual: pManual, queue: pQueue, transcripts: pTranscripts, rewards: pRewards, map: pMap, settings: pSettings, exports: pExports }[state.ptab]?.(d) || '';
    return `<div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${state.ptab === k ? 'active' : ''}" role="tab" aria-selected="${state.ptab === k}" data-ptab="${k}">${l}</button>`).join('')}</div>${body}`;
  }
  function pOverview(d) {
    const m = d.metrics;
    const gate = unlockedSet(d);
    const openCount = gate ? d.skills.filter((s) => gate.has(s.id)).length : d.skills.length;
    const bySubject = SUBJECT_ORDER.map((sub) => { const all = d.skills.filter((s) => s.subject === sub), open = all.filter((s) => isUnlocked(d, s)); return { sub, all: all.length, open: open.length, secure: open.filter(isSec).length, weak: open.filter((s) => s.status === 'emerging').length, notyet: open.filter((s) => s.status === 'not_yet').length }; });
    return `<section class="panel"><h2>Where he stands</h2>
      <div style="overflow-x:auto"><table><tr><th>Subject</th><th class="num">Topics</th><th class="num">Open</th><th class="num">Secure</th><th class="num">Getting there</th><th class="num">Not tested</th><th style="width:28%">Secure share of open</th></tr>
        ${bySubject.map((r) => `<tr><td>${subjectIcon(r.sub)} ${esc(r.sub)}</td><td class="num">${r.all}</td><td class="num">${r.open}</td><td class="num">${r.secure}</td><td class="num">${r.weak}</td><td class="num">${r.notyet}</td><td><div class="bar"><i style="width:${Math.round((100 * r.secure) / Math.max(1, r.open))}%"></i></div></td></tr>`).join('')}
        <tr><td><b>Total</b></td><td class="num"><b>${d.skills.length}</b></td><td class="num"><b>${openCount}</b></td><td class="num"><b>${m.secure_total}</b></td><td class="num"><b>${d.skills.filter((s) => s.status === 'emerging' && isUnlocked(d, s)).length}</b></td><td class="num"><b>${d.skills.filter((s) => s.status === 'not_yet' && isUnlocked(d, s)).length}</b></td><td></td></tr></table></div>
      <p class="muted small" style="margin-top:8px">${gate ? `${openCount} of ${d.skills.length} topics are unlocked. ` : 'Topic gating is off — every topic is open. '}Change it under <b>Unlock topics</b>.</p></section>
      <section class="panel"><h2>KPIs</h2><div class="grid tight">
        <div class="stat inset light"><div class="big">${m.minutes_this_week}<small>/${m.minutes_target_week}</small></div><div class="lbl">ACTIVE MIN VS TARGET (WEEK)</div></div>
        <div class="stat inset light"><div class="big">${m.items_this_week}</div><div class="lbl">QUESTIONS THIS WEEK</div></div>
        <div class="stat inset light"><div class="big">${m.velocity_per_week}</div><div class="lbl">TOPICS SECURED PER WEEK</div></div>
        <div class="stat inset light"><div class="big">${Math.round(m.guessing_rate * 100)}%</div><div class="lbl">GUESSING (FAST + WRONG)</div></div>
        <div class="stat inset light"><div class="big">${m.mastered_total}</div><div class="lbl">MASTERED (RETAINED)</div></div>
        <div class="stat inset light"><div class="big">${m.retention_rate == null ? '—' : Math.round(m.retention_rate * 100) + '%'}</div><div class="lbl">RETENTION (30 DAYS)</div></div>
        <div class="stat inset light"><div class="big">${m.streak_days}</div><div class="lbl">DAY STREAK</div></div>
        <div class="stat inset light"><div class="big">${m.focus_ratio ?? '—'}</div><div class="lbl">FOCUS RATIO</div></div>
      </div>
      <p class="muted small" style="margin-top:12px">Weekly 10-minute review together (docs/07 §4): lead with one number that went up, one to work on, one thing he chooses. Never lead with focus ratio.</p></section>
      <section class="panel"><h2>For the tutor — weakest open topics</h2><div style="overflow-x:auto"><table><tr><th>#</th><th>Topic</th><th>Subject</th><th>Term</th><th>Status</th><th class="num">Last</th><th class="num">Tries</th><th class="num">Urgency</th></tr>
        ${d.urgency.filter((u) => isUnlocked(d, d.skills.find((s) => s.id === u.id) || {})).map((u, i) => { const s = d.skills.find((x) => x.id === u.id) || {}; return `<tr><td>${i + 1}</td><td>${esc(u.name)} <span class="muted small">${esc(u.id)}</span></td><td>${esc(u.subject)}</td><td>${esc(termLabel(termOf(s)))}</td><td>${chip(u.status)}</td><td class="num">${pct(u.last_rate)}</td><td class="num">${s.attempts ?? 0}</td><td class="num">${u.score}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nothing urgent among the open topics.</td></tr>'}</table></div>
      <p class="muted small">urgency = 3·(due 1 Oct and not secure) + 2·(blocked dependents) + 1·(days overdue) + 1·(not yet). Print this table for the tutor, or export the CSVs under Exports.</p></section>`;
  }
  function pUnlock(d) {
    if (!state.unlockDraft) { const u = unlockedSet(d); state.unlockDraft = { gating: !!u, set: new Set(u ? [...u] : d.skills.map((s) => s.id)) }; }
    const dr = state.unlockDraft;
    const group = (sub, t) => {
      const list = d.skills.filter((s) => s.subject === sub && termOf(s) === t.id); if (!list.length) return '';
      const on = list.filter((s) => dr.set.has(s.id)).length;
      return `<div class="inset light" style="margin-bottom:10px"><div class="row spread"><b>${subjectIcon(sub)} ${esc(sub)} · ${esc(t.label)} <span class="muted small">${on} of ${list.length} open</span></b><span class="row"><button class="btn small" data-act="unlock-group" data-subject="${esc(sub)}" data-term="${t.id}" data-on="1">Open all</button><button class="btn small" data-act="unlock-group" data-subject="${esc(sub)}" data-term="${t.id}" data-on="0">Lock all</button></span></div>
        <div style="overflow-x:auto"><table style="margin-top:8px"><tr><th style="width:44px">Open</th><th>Topic</th><th>Standard</th><th>Status</th><th class="num">Last</th><th class="num">Tries</th><th>Planned</th></tr>
        ${list.map((s) => `<tr><td><input type="checkbox" data-unlock="${esc(s.id)}" ${dr.set.has(s.id) ? 'checked' : ''} aria-label="Unlock ${esc(s.name)}"></td><td>${esc(s.name)}${s.priority === 1 ? ' <span class="chip p1" title="due 1 October">1 Oct</span>' : ''}</td><td class="muted small">${esc(s.standard || s.id)}</td><td>${chip(s.status)}</td><td class="num">${pct(s.last_rate)}</td><td class="num">${s.attempts}</td><td class="muted small">${esc(s.planned_month || '')}</td></tr>`).join('')}</table></div></div>`;
    };
    return `<section class="panel"><h2>Unlock topics</h2>
      <p class="muted">Elchin can only be quizzed on open topics (daily reviews still cover anything he has already been tested on). Open a term when the one before is solid; lock topics the tutor has not covered yet. Nothing is saved until you press <b>Save</b>.</p>
      <div class="row" style="margin-bottom:14px"><label class="row" style="gap:8px"><input type="checkbox" data-gating ${dr.gating ? 'checked' : ''}> <b>Gate topics</b> <span class="muted small">(off = everything open, the list below is ignored)</span></label>
        <span class="row">${CFG.TERMS.map((t) => `<button class="btn small" data-act="unlock-term" data-term="${t.id}" data-on="1">Open ${esc(t.label)}</button>`).join('')}<button class="btn small" data-act="unlock-term" data-term="*" data-on="0">Lock everything</button></span></div>
      <div class="row" style="margin-bottom:14px"><button class="btn go" data-act="unlock-save" ${state.busy ? 'disabled' : ''}>Save</button><button class="btn" data-act="unlock-reset">Discard changes</button><span class="muted small">${dr.set.size} of ${d.skills.length} topics open in this draft</span></div>
      ${CFG.TERMS.map((t) => SUBJECT_ORDER.map((sub) => group(sub, t)).join('')).join('')}</section>`;
  }
  function pManual(d) {
    const t = state.template;
    if (!t) { api('/manual-entry/template').then((x) => { state.template = x; render(); }).catch((e) => { state.error = e.message; render(); }); return '<section class="panel">Loading the scorecard…</section>'; }
    const mk = state.manual.marks;
    const done = d.skills.some((s) => s.attempts > 0);
    return `<section class="panel"><h2>${esc(t.title)}</h2>
      <p class="muted">Mark each question ✓ or ✗ from the answer key (docs/Elchin_Math_Diagnostic_1_ANSWER_KEY.pdf). Leave blank if it was skipped. ${done ? '<strong>Already entered once — entering again adds a second attempt.</strong>' : ''}</p>
      <div style="overflow-x:auto"><table><tr><th>#</th><th>Question</th><th>Expected</th><th>Skill</th><th>Mark</th></tr>
      ${t.questions.map((q) => `<tr><td>${q.q}</td><td>${esc(q.stem)}</td><td class="muted small">${esc(q.answer)}</td><td class="small">${esc(q.qsi)} → ${esc(q.skill_id)} <span class="muted">t${q.tier}</span></td>
        <td><span class="tri"><button data-mark="${q.q}" data-val="yes" class="${mk[q.q] === true ? 'on-yes' : ''}" aria-label="Correct">✓</button><button data-mark="${q.q}" data-val="no" class="${mk[q.q] === false ? 'on-no' : ''}" aria-label="Wrong">✗</button></span></td></tr>`).join('')}</table></div>
      <div class="grid" style="margin-top:16px">
        <label class="f"><span>TOTAL MINUTES TAKEN</span><input type="number" data-manual="minutes" value="${esc(state.manual.minutes)}" min="1" max="120"></label>
        <label class="f"><span>Q4 TIMES-TABLES ROW: SECONDS (KEY: UNDER 20 S)</span><input type="number" data-manual="q4" value="${esc(state.manual.q4)}" min="1" max="300"></label>
        <label class="f"><span>DATE TAKEN</span><input type="date" data-manual="date" value="${esc(state.manual.date)}"></label>
      </div>
      <div class="row"><button class="btn go" data-act="submit-manual" ${state.busy ? 'disabled' : ''}>Save scorecard</button><span class="muted small">${Object.keys(mk).length} of ${t.questions.length} marked</span></div></section>`;
  }
  function pQueue(d) {
    if (!state.queue) { api('/marking-queue').then((r) => { state.queue = r.queue; render(); }).catch((e) => { state.queue = []; state.error = e.message; render(); }); return '<section class="panel"><h2>Marking queue</h2><p class="muted">Loading…</p></section>'; }
    if (!state.queue.length) return '<section class="panel"><h2>Marking queue</h2><p class="muted">Nothing waiting. Open answers the AI marked with confidence below 0.8, plus a 10 % random sample, appear here.</p></section>';
    return `<section class="panel"><h2>Marking queue <span class="muted tiny">${state.queue.length} to review</span></h2>
      ${state.queue.map((q) => `<div class="qitem"><div class="row spread"><span><b>${esc(skillName(d, q.skill_id))}</b> <span class="muted small">${esc(q.skill_id)} · tier ${q.tier} · ${q.why === 'random_sample' ? 'random sample' : `AI confidence ${q.confidence}`}</span></span><span class="muted small">${fmtDate(q.answered_at)}</span></div>
        ${q.passage_title ? `<div class="muted small">Passage: ${esc(q.passage_title)}</div>` : ''}
        <p style="margin:6px 0"><span class="muted small">Question</span><br>${esc(q.stem)}</p>
        <p style="margin:6px 0"><span class="muted small">Rubric / expected</span><br>${esc(q.rubric || '—')}</p>
        <div class="inset light" style="margin:6px 0"><span class="muted small">Elchin wrote</span><br>${esc(q.answer_given || '(blank)')}</div>
        <p class="small muted">AI: ${q.llm_correct ? 'correct' : 'not correct'}${q.llm_partial != null ? ` · partial ${q.llm_partial}` : ''}${q.llm_feedback ? ` · "${esc(q.llm_feedback)}"` : ''}</p>
        <div class="row"><button class="btn small go" data-act="pmark" data-id="${q.id}" data-correct="1">✓ Correct</button><button class="btn small" data-act="pmark" data-id="${q.id}" data-correct="0">✗ Not correct</button><input type="text" placeholder="Optional feedback to Elchin" data-fb="${q.id}" style="flex:1;min-width:200px"></div></div>`).join('')}</section>`;
  }
  function pTranscripts(d) {
    if (!d.coach_sessions.length) return '<section class="panel"><h2>Coach transcripts</h2><p class="muted">No coach sessions yet.</p></section>';
    return `<section class="panel"><h2>Coach transcripts</h2><div style="overflow-x:auto"><table><tr><th>Date</th><th>Skill</th><th>State</th><th class="num">Cycle</th><th class="num">Turns</th><th>Outcome</th><th>Parent summary</th><th></th></tr>
      ${d.coach_sessions.map((s) => `<tr><td>${fmtDate(s.started_at)}</td><td>${esc(skillName(d, s.skill_id))}</td><td>${esc(s.loop_state)}</td><td class="num">${s.cycle_number}</td><td class="num">${s.turns}</td><td>${esc(s.outcome || '')}</td><td class="small">${esc(s.parent_summary || '')}</td><td><button class="btn small" data-act="transcript" data-id="${s.id}">Read</button></td></tr>`).join('')}</table></div>
      ${state.transcript ? `<h3 style="margin-top:16px">${esc(skillName(d, state.transcript.skill_id))} · ${fmtDate(state.transcript.started_at)}</h3>${state.transcript.flag_note ? `<div class="notice">Flag: ${esc(state.transcript.flag_note)}</div>` : ''}<div class="chat" style="max-height:60vh">${(state.transcript.messages || []).map((m) => `<div class="bubble ${m.role}"><span class="muted small">${m.role === 'user' ? (m.event ? 'app' : 'Elchin') : 'coach'}</span><br>${esc(m.content).replace(/\n/g, '<br>')}</div>`).join('')}</div>` : ''}</section>`;
  }
  function pRewards(d) {
    return `<div class="grid"><section class="panel"><h2>Treasure chest</h2><p class="muted small">You define what points buy; the app only counts. Points: +1/+2/+3 per correct answer by tier, +5 per review day. 100 points = one level on his XP bar.</p>
        <table><tr><th>Reward</th><th class="num">Cost</th><th></th></tr>${d.rewards.map((r) => `<tr><td>${esc(r.name)}${r.redeemed_at ? ` <span class="muted small">redeemed ${fmtDate(r.redeemed_at)}</span>` : ''}</td><td class="num">${r.cost}</td><td>${r.redeemed_at ? '' : `<button class="btn small" data-act="del-reward" data-id="${r.id}">Remove</button>`}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No rewards yet.</td></tr>'}</table>
        <form data-form="reward" class="row" style="margin-top:12px"><input type="text" name="name" placeholder="Reward (e.g. cinema)" required style="flex:2"><input type="number" name="cost" placeholder="Cost" min="1" required style="flex:1"><button class="btn small go">Add</button></form></section>
      <section class="panel"><h2>Points · balance ${d.points.balance}</h2>
        <form data-form="points" class="row"><input type="number" name="delta" placeholder="+/- points" required style="flex:1"><input type="text" name="reason" placeholder="Reason" required style="flex:2"><button class="btn small">Adjust</button></form>
        <table style="margin-top:12px"><tr><th>When</th><th>Reason</th><th class="num">Δ</th></tr>${d.points.ledger.map((p) => `<tr><td>${fmtDate(p.at)}</td><td>${esc(p.reason)}</td><td class="num">${p.delta > 0 ? '+' : ''}${p.delta}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No points yet.</td></tr>'}</table></section></div>`;
  }
  function pMap(d) {
    return `<section class="panel"><h2>MAP Growth results</h2><p class="muted small">Enter RIT scores from the school's Family Report. They re-weight priorities toward the two RIT bands around his score (docs/01).</p>
      <table><tr><th>Term</th><th>Subject</th><th class="num">RIT</th><th>Tested</th></tr>${d.map_results.map((r) => `<tr><td>${esc(r.term)}</td><td>${esc(r.subject)}</td><td class="num">${r.rit}</td><td>${fmtDate(r.tested_at)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None entered yet.</td></tr>'}</table>
      <form data-form="map" class="grid" style="margin-top:12px"><label class="f"><span>TERM</span><input type="text" name="term" placeholder="Fall 2026" required></label>
        <label class="f"><span>SUBJECT</span><select name="subject">${SUBJECT_ORDER.map((s) => `<option>${s}</option>`).join('')}</select></label>
        <label class="f"><span>RIT</span><input type="number" name="rit" min="100" max="300" required></label>
        <label class="f"><span>DATE</span><input type="date" name="tested_at"></label><div><button class="btn small go">Save</button></div></form></section>`;
  }
  function pSettings(d) {
    const s = d.student.settings;
    return `<section class="panel"><h2>Settings</h2><form data-form="settings" class="grid">
        <label class="f"><span>DAILY MINUTES TARGET</span><input type="number" name="daily_minutes" value="${s.daily_minutes ?? 50}" min="10" max="180"></label>
        ${FEAT.coach ? `<label class="f"><span>VOICE</span><select name="voice"><option value="true" ${s.voice !== false ? 'selected' : ''}>On</option><option value="false" ${s.voice === false ? 'selected' : ''}>Off</option></select></label>
        <label class="f"><span>RUSSIAN FALLBACK</span><select name="russian_fallback"><option value="true" ${s.russian_fallback !== false ? 'selected' : ''}>On</option><option value="false" ${s.russian_fallback === false ? 'selected' : ''}>Off</option></select></label>
        <label class="f"><span>TIER-3 SLIP → ONE REPLACEMENT ITEM</span><select name="tier3_slip_replacement"><option value="true" ${s.tier3_slip_replacement !== false ? 'selected' : ''}>On</option><option value="false" ${s.tier3_slip_replacement === false ? 'selected' : ''}>Off</option></select></label>` : ''}
        <div><button class="btn small go">Save settings</button></div></form>
      <h3 style="margin-top:20px">Mastery thresholds (read-only)</h3><p class="muted small">Pass rate ${s.pass_rate ?? 0.9} · regression below ${s.regress_rate ?? 0.7} · qualifying test ≥ 3 items · fluency ≤ 3 s per item. These are data, not opinion (docs/02 §3); change them only by a deliberate decision in the schema.</p>
      <p class="muted small">The AI coach and voice are switched off in <code>config.js</code> (FEATURES). A human tutor teaches; the app tests and tracks.</p></section>`;
  }
  function pExports(d) {
    return `<div class="grid"><section class="panel"><h2>Exports</h2><p class="muted small">The weekly PDF is a one-page report for the class teacher or tutor: topics by status, minutes, what was secured, next steps. CSVs are your backup.</p>
        <div class="row" style="margin-bottom:10px"><button class="btn small go" data-act="download" data-path="/export/weekly.pdf" data-name="elchin-week.pdf">Weekly PDF</button></div>
        <div class="row">${['skill_state', 'tests', 'test_items', 'points', 'map_results'].map((t) => `<button class="btn small" data-act="download" data-path="/export/csv?table=${t}" data-name="${t}.csv">${t}.csv</button>`).join('')}</div>
        <p class="muted small" style="margin-top:10px">Retention rate: ${d.metrics.retention_rate == null ? '— (no mastered topics yet)' : Math.round(d.metrics.retention_rate * 100) + '% of mastered topics held over the last 30 days'}.</p></section>
      <section class="panel"><h2>Question bank</h2><p class="muted small">Reading, Language Usage and Science questions come from a verified bank. Seed loads the hand-written starter content; Refill asks Claude to top up every topic below 10 items per tier (needs the API key; costs a few cents).</p>
        <div class="row"><button class="btn small go" data-act="seed">Seed content</button><button class="btn small" data-act="refill">Refill bank now</button><button class="btn small" data-act="bank-status">Show stock</button></div>
        ${state.bank ? `<div style="overflow-x:auto"><table style="margin-top:12px"><tr><th>Topic</th><th class="num">P</th><th class="num">t1</th><th class="num">t2</th><th class="num">t3</th></tr>${state.bank.skills.map((s) => `<tr><td>${esc(s.name)} <span class="muted small">${esc(s.skill_id)}</span></td><td class="num">${s.priority}</td>${s.stock.map((n) => `<td class="num ${n < state.bank.min ? 'muted' : 'ok'}">${n}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}</section></div>`;
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
    root.querySelectorAll('[data-unlock]').forEach((c) => c.addEventListener('change', () => { const s = state.unlockDraft.set; c.checked ? s.add(c.dataset.unlock) : s.delete(c.dataset.unlock); }));
    const g = root.querySelector('[data-gating]'); if (g) g.addEventListener('change', () => { state.unlockDraft.gating = g.checked; });
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset)));
    root.querySelectorAll('form[data-form]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); submit(f.dataset.form, Object.fromEntries(new FormData(f).entries())); }));
  }
  async function act(name, ds) {
    try {
      state.error = null;
      if (name === 'logout') { if (PREVIEW) { location.href = location.pathname; return; } await sb.auth.signOut(); state.session = null; state.dash = null; render(); }
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
      else if (name === 'check-skill') { const sk = state.dash.skills.find((s) => s.id === ds.skill); await startRun('diagnostic', ds.subject || sk?.subject || 'Mathematics', [ds.skill]); }
      else if (name === 'check') { if (state.coach) state.coach.stepHint = null; await checkAnswer(); }
      else if (name === 'next') await nextItem();
      else if (name === 'review-test') await reviewTest(ds.id);
      else if (name === 'exit-run') { clearInterval(state.timer); state.run = null; if (state.coach) state.coach.run = null; state.recent = null; await refresh(); }
      else if (name === 'transcript') { state.transcript = await api(`/coach/session?id=${encodeURIComponent(ds.id)}`); render(); }
      else if (name === 'redeem') { const r = await api('/rewards/redeem', { id: Number(ds.id) }); state.notice = `Chest opened. Balance ${r.balance}.`; await refresh(); }
      else if (name === 'del-reward') { await api('/rewards/delete', { id: Number(ds.id) }); await refresh(); }
      else if (name === 'pmark') { const fb = document.querySelector(`[data-fb="${ds.id}"]`)?.value || ''; await api('/parent-mark', { item_id: ds.id, correct: ds.correct === '1', feedback: fb || undefined }); state.queue = null; await refresh(); }
      else if (name === 'seed') { state.busy = true; render(); const r = await api('/admin/seed', {}); state.busy = false; state.notice = `Seeded ${r.passages} passages and ${r.items} items${r.rejected?.length ? `; rejected: ${r.rejected.join('; ')}` : ''}.`; state.bank = null; render(); }
      else if (name === 'refill') { state.busy = true; render(); const r = await api('/admin/refill-bank', { max_calls: 12 }); state.busy = false; state.notice = `Refill: ${r.generated} items in ${r.calls} calls${r.stopped ? ` (stopped: ${r.stopped})` : ''}${r.skipped?.length ? `; skipped ${r.skipped.length}` : ''}.`; state.bank = null; render(); }
      else if (name === 'bank-status') { state.bank = await api('/bank/status'); render(); }
      else if (name === 'unlock-group') { const on = ds.on === '1'; state.dash.skills.filter((s) => s.subject === ds.subject && termOf(s) === ds.term).forEach((s) => on ? state.unlockDraft.set.add(s.id) : state.unlockDraft.set.delete(s.id)); state.unlockDraft.gating = true; render(); }
      else if (name === 'unlock-term') { const on = ds.on === '1'; state.dash.skills.filter((s) => ds.term === '*' || termOf(s) === ds.term).forEach((s) => on ? state.unlockDraft.set.add(s.id) : state.unlockDraft.set.delete(s.id)); state.unlockDraft.gating = true; render(); }
      else if (name === 'unlock-reset') { state.unlockDraft = null; render(); }
      else if (name === 'unlock-save') { state.busy = true; render(); const dr = state.unlockDraft; await api('/settings', { unlocked_skills: dr.gating ? [...dr.set] : null }); state.busy = false; state.unlockDraft = null; state.notice = dr.gating ? `Saved: ${dr.set.size} topics open.` : 'Saved: gating off, every topic open.'; await refresh(); }
      else if (name === 'submit-manual') {
        if (!Object.keys(state.manual.marks).length) throw new Error('Mark at least one question first.');
        state.busy = true; render();
        const r = await api('/manual-entry', { source: 'diagnostic_1', marks: state.manual.marks, minutes: Number(state.manual.minutes) || undefined, q4_seconds: Number(state.manual.q4) || undefined, date: state.manual.date || undefined });
        state.busy = false; state.manual = { marks: {}, minutes: '', q4: '', date: '' };
        state.notice = `Saved: ${r.score} of ${r.total} correct. Topic states updated: ${r.skill_states.map((s) => `${esc(s.skill_id)} → ${STATUS[s.status]}`).join(', ')}.`;
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
      if (form === 'settings') await api('/settings', { daily_minutes: Number(v.daily_minutes), ...(FEAT.coach ? { voice: v.voice === 'true', russian_fallback: v.russian_fallback === 'true', tier3_slip_replacement: v.tier3_slip_replacement === 'true' } : {}) });
      await refresh();
    } catch (e) { state.error = e.message; render(); }
  }

  // ---------------------------------------------------------------- preview mode: fictional data, in-memory only (design review without a login)
  const PV = { dash: null, tests: [], run: null };
  async function previewApi(path, body) {
    await new Promise((r) => setTimeout(r, 120));
    if (!PV.dash) PV.dash = await previewDash();
    const d = PV.dash;
    if (path === '/dashboard') return JSON.parse(JSON.stringify(d));
    if (path.startsWith('/tests')) return { tests: PV.tests };
    if (path === '/settings') { Object.assign(d.student.settings, body); return { settings: d.student.settings }; }
    if (path === '/rewards/redeem') { d.points.balance -= d.rewards.find((r) => r.id === body.id)?.cost || 0; return { balance: d.points.balance }; }
    if (path === '/generate-test' || path === '/knowledge-check' || path === '/map-mock') {
      const items = previewItems(d, body);
      PV.run = { id: 't' + Date.now(), items, i: 0, correct: 0, kind: body?.mode || (path === '/map-mock' ? 'map_mock' : 'knowledge_check'), subject: body?.subject || 'Mathematics', started: Date.now() };
      if (body?.mode === 'diagnostic') return { test_id: PV.run.id, item: items[0], progress: { sitting_items: 0, sitting_cap: items.length, skills_done: 0, skills_total: 1 } };
      return { test_id: PV.run.id, items, ...(body?.mode === 'reading' ? { passage: { title: items[0].passage_title } } : {}) };
    }
    if (path === '/next-item') { const r = PV.run, it = r.items[r.i], ok = String(body.last_answer.answer) === String(it.answer); if (ok) r.correct++; r.i++; const done = r.i >= r.items.length; return { last: { correct: ok, answer: it.answer, explanation: it.explanation }, item: done ? null : r.items[r.i], progress: { sitting_items: r.i, sitting_cap: r.items.length }, test_complete: done, results: done ? previewResults(d, r) : null }; }
    if (path === '/answer-item') { const r = PV.run, it = r.items.find((x) => x.id === body.item_id); if (it && String(body.answer) === String(it.answer)) r.correct++; return {}; }
    if (path === '/submit-test') return { results: previewResults(d, PV.run) };
    if (path === '/manual-entry/template') return { title: 'Diagnostic 1 (paper)', questions: [{ q: 1, stem: '4,096 + 2,738', answer: '6,834', qsi: 'E01.1', skill_id: 'G4.NBT.4', tier: 2 }, { q: 2, stem: '7 × 86', answer: '602', qsi: 'E01.2', skill_id: 'G4.NBT.5', tier: 2 }] };
    if (path === '/marking-queue') return { queue: [] };
    if (path === '/bank/status') return { min: 10, skills: d.skills.filter((s) => s.subject !== 'Mathematics').slice(0, 6).map((s) => ({ skill_id: s.id, name: s.name, priority: s.priority, stock: [12, 9, 4] })) };
    return {};
  }
  async function previewDash() {
    let skills = [];
    try {
      const files = ['skills_math_ccss', 'skills_reading', 'skills_language_usage', 'skills_science'];
      const months = (await (await fetch('data/scope_sequence.json')).json()).months;
      const monthOf = {}; for (const [m, ids] of Object.entries(months)) for (const id of ids) monthOf[id] = m;
      for (const f of files) { const j = await (await fetch(`data/${f}.json`)).json(); const list = Array.isArray(j) ? j : j.skills || Object.values(j).find(Array.isArray) || []; skills.push(...list.map((s) => ({ ...s, planned_month: s.planned_month || monthOf[s.id] || (String(s.id).startsWith('G4') ? '2026-09' : null) }))); }
    } catch { skills = [['5.NBT.1', 'Mathematics', 'Place value', 'Place value to billions', 5, 1], ['5.NBT.5', 'Mathematics', 'Multiplication', 'Multiply multi-digit numbers', 5, 1], ['G4.NBT.4', 'Mathematics', 'Addition', 'Add and subtract to 1,000,000', 4, 1], ['RD.RL.1', 'Reading', 'Literature', 'Quote from the text to support an answer', 5, 1], ['LU.G.3', 'Language Usage', 'Grammar', 'Verb tenses', 5, 1], ['SC.PS1.1', 'Science', 'Matter', 'Matter is made of particles', 5, 2]].map(([id, subject, strand, name, grade, priority]) => ({ id, subject, strand, name, grade, priority, standard: id, planned_month: grade < 5 ? '2026-09' : '2026-10' })); }
    const rnd = mulberry(7);
    const statuses = ['not_yet', 'not_yet', 'emerging', 'secure', 'secure', 'mastered'];
    const rows = skills.map((s) => { const past = Number(s.grade) < 5, s1 = !past && (!s.planned_month || s.planned_month < '2027-02'); const st = past ? statuses[Math.floor(rnd() * 6)] : s1 ? ['not_yet', 'not_yet', 'emerging', 'secure'][Math.floor(rnd() * 4)] : 'not_yet'; const tested = st !== 'not_yet'; return { ...s, prerequisites: s.prerequisites || [], status: st, last_rate: tested ? Math.round((st === 'emerging' ? 0.55 + rnd() * 0.3 : 0.9 + rnd() * 0.1) * 100) / 100 : null, attempts: tested ? 1 + Math.floor(rnd() * 3) : 0, items_seen: tested ? 10 : 0, time_spent_s: tested ? 600 : 0, next_review_at: st === 'secure' ? '2026-09-12' : null, fast: null }; });
    const unlocked = rows.filter((s) => Number(s.grade) < 5 || (s.planned_month || '') <= '2026-10').map((s) => s.id);
    const secure = rows.filter(isSec).length, p1 = rows.filter((r) => r.priority === 1), p1s = p1.filter(isSec).length;
    const urgency = rows.filter((r) => !isSec(r)).map((r) => ({ id: r.id, name: r.name, subject: r.subject, priority: r.priority, status: r.status, last_rate: r.last_rate, score: (r.priority === 1 ? 3 : 0) + (r.status === 'not_yet' ? 1 : 0) + Math.floor(rnd() * 3) })).sort((a, b) => b.score - a.score).slice(0, 15);
    PV.tests = [{ id: 'p1', started_at: '2026-09-08T15:00:00Z', kind: 'targeted', subject: 'Mathematics', status: 'complete', score: 0.8 }, { id: 'p2', started_at: '2026-09-07T15:00:00Z', kind: 'reading', subject: 'Reading', status: 'complete', score: 1 }, { id: 'p3', started_at: '2026-09-06T15:00:00Z', kind: 'diagnostic', subject: 'Mathematics', status: 'complete', score: 0.64 }];
    const role = PARAMS.get('role') === 'parent' ? 'parent' : 'student';
    return { now: new Date().toISOString(), role, student: { id: 'preview', name: 'Elchin', settings: { daily_minutes: 50, unlocked_skills: unlocked } },
      metrics: { p1_total: p1.length, p1_secure: p1s, p1_pct: p1.length ? Math.round((100 * p1s) / p1.length) : 0, days_to_due: Math.max(0, Math.ceil((new Date(CFG.DUE_DATE) - Date.now()) / 86400000)), due_date: CFG.DUE_DATE, velocity_per_week: 2.5, projected_date: '2026-10-20', minutes_this_week: 140, minutes_target_week: 350, items_this_week: 86, focus_ratio: 0.82, guessing_rate: 0.06, streak_days: 4, retention_rate: 0.9, secure_total: secure, mastered_total: rows.filter((r) => r.status === 'mastered').length, skills_total: rows.length },
      skills: rows, urgency, qsi_units: [{ id: 'E01', course: 'Math', unit: 'E01 Whole numbers', skills: 8, secure: 5, pct: 63 }, { id: 'E02', course: 'Math', unit: 'E02 Multiplication & division', skills: 6, secure: 2, pct: 33 }, { id: 'R01', course: 'Reading', unit: 'E01 Literature', skills: 6, secure: 3, pct: 50 }],
      today: { urgent: urgency.slice(0, 3), review_due: rows.filter((r) => r.status === 'secure').slice(0, 4).map((r) => r.id), learn_ahead: [] },
      points: { balance: 235, ledger: [{ at: '2026-09-08T15:00:00Z', reason: 'Practice quest 8/10', delta: 14 }, { at: '2026-09-07T15:00:00Z', reason: 'Story quest 6/6', delta: 12 }] },
      rewards: [{ id: 1, name: 'Cinema with Dad', cost: 300 }, { id: 2, name: '30 min extra Minecraft', cost: 120 }], coach_sessions: [], map_results: [], marking_queue_count: role === 'parent' ? 2 : undefined, llm_mode: 'mock', repo_mode: 'preview' };
  }
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function previewItems(d, body) {
    const sid = body?.skill_ids?.[0] || d.skills.find((s) => s.subject === (body?.subject || 'Mathematics'))?.id;
    if (body?.mode === 'reading') return [{ id: 'r1', skill_id: 'RD.RL.1', format: 'mc4', passage_title: 'The Fox and the Grapes', passage: 'A hungry fox saw a bunch of ripe grapes hanging from a vine high above him. He jumped and jumped, but could not reach them. At last he walked away, saying, "They were probably sour anyway."', stem: 'Why does the fox say the grapes were sour?', options: ['He tasted them', 'He could not reach them and wanted to feel better', 'A crow told him', 'They were green'], answer: 'B', explanation: 'He never tasted them; he made an excuse.' }, { id: 'r2', skill_id: 'RD.RL.2', format: 'short_text', passage_title: 'The Fox and the Grapes', passage: 'A hungry fox saw a bunch of ripe grapes hanging from a vine high above him. He jumped and jumped, but could not reach them. At last he walked away, saying, "They were probably sour anyway."', stem: 'What is the lesson of this fable? Answer in one sentence.', answer: 'It is easy to dislike what you cannot have.' }];
    return [{ id: 'q1', skill_id: sid, format: 'numeric', stem: 'What is 4,096 + 2,738?', answer: '6834', explanation: 'Add the ones, tens, hundreds and thousands, carrying when a column passes 9.' }, { id: 'q2', skill_id: sid, format: 'mc4', stem: 'Which number is the largest?', options: ['4,096', '4,960', '4,609', '4,690'], answer: 'B', explanation: 'Compare the hundreds digit first: 9 is the biggest.' }, { id: 'q3', skill_id: sid, format: 'ordering', stem: 'Put these in order from smallest to largest.', options: ['0.5', '0.05', '0.55', '0.505'], answer: ['0.05', '0.5', '0.505', '0.55'], explanation: 'Line up the decimal points and compare digit by digit.' }];
  }
  function previewResults(d, r) {
    const sk = d.skills.find((s) => s.id === r.items[0].skill_id) || d.skills[0];
    const rate = r.items.length ? r.correct / r.items.length : 0, after = rate >= 0.9 ? 'secure' : rate >= 0.5 ? 'emerging' : 'not_yet';
    return { kind: r.kind, correct: r.correct, total: r.items.length, points: r.correct * 2, duration_s: Math.round((Date.now() - r.started) / 1000), per_skill: [{ skill_id: sk.id, name: sk.name, items: r.items.length, correct: r.correct, rate, status_before: sk.status, status_after: after }], items: r.items.map((i) => ({ stem: i.stem, answer: i.answer, answer_given: '—', correct: true })), next_steps: after === 'secure' ? [] : [{ skill_id: sk.id, name: sk.name, subject: sk.subject }], secured: after === 'secure' ? [sk.name] : [] };
  }

  init();
})();
