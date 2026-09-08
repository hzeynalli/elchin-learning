# BRIEF — Elchin Learning (v1.2 — year-long engine, telemetry, LLM-first marking; see AUDIT.md)

## 0. Scope for 1 October and the parallel track
- **1 Oct target = every priority-1 skill Secure** (the ~25 skills tied to QSI Math E01–E02, Reading E01–E02, Writing
  E01–E02). MAP strands (priority 2–3) are a rolling target through the year.
- **Phase 0 runs now, outside the app**: paper Diagnostic 1 (docs/), chat-based coaching on the top gaps, results
  entered via the manual-entry screen in Phase 1. The app never starts empty.
- Devices: with ElevenLabs STT (mic capture via MediaRecorder) voice works on iPad too; the Web Speech fallback still
  needs Chrome on a laptop/Chromebook or Android.
- **Russian fallback ON** (docs/08): one Russian sentence when he is stuck twice, then back to English.
- **Curriculum = full Grade 5 + Grade 4 gaps** (docs/01); QSI unit names are labels only; `data/scope_sequence.json`
  drives monthly priority and learn-ahead.
- **The year, not the deadline**: the app carries the full Grade-5 map, pre-teaches upcoming QSI units (learn-ahead),
  runs a memory model per skill so September skills are reviewed just before they would be forgotten (docs/06), and
  re-tests mastered skills blind every month. MAP fall (Oct) is the first checkpoint, not the finish line.
- **Marking is LLM-first for everything**, including writing: every open answer gets an LLM mark with confidence; the
  parent sees only confidence < 0.8 plus a 10% random sample, and reviews writing pieces monthly.
- **No camera/screen surveillance.** Effort is measured from in-app telemetry (docs/07); games are blocked with the
  device's own parental controls during the study window.

## 1. Goal
A private web app where Elchin (10, QSI International School Baku, "10-year-old class" = US Grade 5) is diagnosed,
coached and re-tested until every tracked skill is mastered — first for the QSI units due by **1 October 2026**, then
continuously for MAP Growth (fall MAP: October or later). His father Huseyn sees everything.

Success = (a) every QSI E01/E02 skill in Math, Reading, Writing at *Secure* by 1 Oct; (b) each MAP strand trending to
*Mastered*; (c) Elchin uses it 45–60 min a day without a fight.

## 2. Users and roles
- **student** — Elchin. Sees: Today, Tests, Coach, My progress. Cannot see other people's data or settings.
- **parent** — Huseyn. Sees everything plus: marking queue, chat logs, urgency list, settings, exports.

## 3. Architecture (all free tier)
- **Front-end**: single-page `index.html` + `app.js` + `styles.css` on GitHub Pages (repo `hzeynalli/elchin-learning`).
- **Supabase**: Postgres + Auth + RLS. Schema in `schema/supabase_schema.sql`.
- **Cloudflare Worker** (`worker/`): holds `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_KEY`; verifies the Supabase JWT on
  every call; exposes the endpoints in §6; writes results back to Supabase with the service key.
- **AI**: Anthropic Messages API from the Worker only. Models pinned per docs/08: `claude-fable-5-1` for the coach,
  `claude-sonnet-5` for generation/verification/marking, `claude-haiku-4-5-20251001` for guards.
- **Voice**: ElevenLabs via the Worker — `eleven_v3` conversational TTS (Russian-capable), Scribe STT, push-to-talk;
  browser Web Speech API as free fallback. See docs/08.

## 4. Subjects and skill maps (data/)
| Subject | Skill map file | Layers |
|---|---|---|
| Mathematics | `skills_math_qsi.json` (QSI E01–E02 + Grade 4 prereqs) and `skills_math_ccss.json` (Grade 5 CCSS, MAP strands) | QSI unit → skill; CCSS strand → skill |
| Reading | `skills_reading.json` | QSI Reading E01–E02; MAP: Literary Text, Informational Text, Vocabulary |
| Language Usage | `skills_language_usage.json` | QSI Writing E01–E02; MAP: Grammar & Usage, Mechanics, Writing process |
| Science | `skills_science.json` | NGSS Grade 5 + Grade 4 prereqs; MAP: Physical, Life, Earth & Space, Practices |
| Cultural Studies | none — unit tracking only (QSI E01 Ancient World Research) | |

Each skill: `id, subject, strand, qsi_unit, ccss_or_ngss, name, grade, prerequisites[], priority (1 = due 1 Oct, 2 = MAP core, 3 = later)`.
Skill files are the seed for the `skills` table. Importing them is Phase 1.

## 5. Data model (Supabase)
See `schema/supabase_schema.sql`. Tables: `profiles`, `skills`, `skill_state`, `tests`, `test_items`, `coach_sessions`,
`passages`, `events`. Mastery state is computed by a Worker function `recomputeSkillState(student, skill)` after each
marked test and each coach check, using docs/02-pedagogy.md §3 exactly.

## 6. Worker endpoints (JSON, JWT required)
- `POST /generate-test` `{subject, mode: "diagnostic"|"targeted"|"review"|"practice10"|"confirm5", skill_ids?}` →
  creates or continues a `tests` row. `diagnostic`: adaptive per docs/02 §1 (4–8 items per skill, max 25 per sitting,
  resumable, interleaved, prerequisite gating). `targeted`: 15 items over `not_yet`/`emerging` skills weighted by urgency.
  `review`: skills whose `next_review_at` ≤ now. `practice10` / `confirm5`: the coach-loop sets on one skill (docs/02 §2).
  **New items every time** (generators use fresh seeds; LLM items are deduplicated against the last 300 for that skill).
- `POST /next-item` `{test_id, last_answer}` → for adaptive modes: marks the last answer, returns the next item (or
  `sitting_complete` / `test_complete`). Used by diagnostic and by the coach's practice sets so feedback is immediate.
  **Items come from `item_bank`** — a verified buffer of ≥ 10 unused items per (skill, tier), refilled asynchronously
  (Worker cron every 15 min + on-submit top-up). No LLM call sits between "Check" and the next question.
- `POST /telemetry` `{session_id, events[]}` → visibility/idle/answer-cadence events (docs/07 §2), batched every 30 s.
- `POST /knowledge-check` → monthly blind 20-item check over Mastered skills (docs/06 §3).
- `POST /map-mock` `{subject}` → 40-item MAP-style adaptive mock; result by instructional area.
- `GET /export/weekly.pdf` (parent) → one-page report for the teacher: skills by status, minutes, next steps.
- Server-side guards on `/coach`: session must carry a skill; input ≤ 400 chars; two off-topic hits → pause + parent
  note; 30 min per coach block; 60 min per day (settings).
- `POST /submit-test` `{test_id, answers, started_at, submitted_at}` → marks: numeric/MC by rule in code; short
  open-response by LLM against the item's rubric with `confidence`; anything below confidence 0.8 goes to the parent
  marking queue. Then recomputes skill states. Returns the results payload.
- `POST /coach` `{session_id?, skill_id, message}` → runs the coach state machine (docs/02-pedagogy.md §2) with the
  system prompt in `prompts/coach_system_prompt.md`; stores every turn; returns `{reply, loop_state, next_action}` where
  `loop_state` ∈ `EXPLAIN_n | PRACTICE_10 | CONFIRM_5 | SECURE` and `next_action` ∈ `continue | start_practice |
  start_confirm | reexplain | suggest_break | done`. The practice/confirm sets are served by `/generate-test` +
  `/next-item`, embedded inside the Coach tab, with the coach commenting on each answer.
- `GET /dashboard` → everything the dashboard needs in one call (skill states, urgency list, time totals, QSI unit rollup).
- `POST /parent-mark` `{item_id, correct, feedback}` (parent role only).

## 7. Screens (one page, tabs)
1. **Today** (student home) — "Your plan today": up to 3 urgent skills with buttons *Learn with coach* / *Take a check*;
   the daily 10-question mixed *review* (spaced retrieval, Rosenshine daily review); streak and minutes today.
2. **Tests** — start a General diagnostic (per subject) or a Targeted test (weak skills only). Timer visible. Autosave
   every answer. Submit → results with per-skill bars and "what to do next".
3. **Coach** — chat with voice. Picks a skill (default: most urgent). Follows the loop. Shows the worked example panel and
   the 3-question check inline. Big "Say it" button for voice input; replies read aloud automatically (toggle).
4. **Progress** — collapsible by subject → strand/unit → skill. Status chip per skill (Not yet / Emerging / Secure /
   Mastered), last score, attempts, minutes, next review date. Header: QSI units due 1 Oct with countdown and % Secure.
5. **Parent** (parent role) — urgency table (top 15 across subjects), marking queue, coach transcripts by date, time
   spent per test/subject/day, export CSV, settings (daily minutes target, voice on/off, mastery thresholds read-only).

Urgency score per skill = 3·(priority==1 ? 1 : 0)·(status≠Secure) + 2·(number of skills that list it as prerequisite and
are not Secure) + 1·(days overdue for review) + 1·(status==not_yet). Sort descending.

## 8. Build phases (stop after each)
- **Phase 1 — Data & auth**: Supabase schema (EU region) + `item_bank` table, `scripts/seed.js` from data/, two users,
  RLS, JWT verification via the project JWKS endpoint, `wrangler.toml` template, CORS locked to the Pages origin,
  `GET /dashboard`, Progress tab with headline metrics (% priority-1 Secure, days to 1 Oct, projected date from velocity,
  minutes this week), **manual-entry screen** for the paper diagnostic scorecard, points ledger with parent-defined
  rewards. Acceptance: both users log in; Progress shows all skills grouped; RLS blocks cross-user reads;
  `worker/src/__tests__/mastery.test.js` passes the eight rule cases in docs/02 §3.
- **Phase 2 — Tests**: math generators for every `skills_math_*` skill (see docs/03); `/generate-test` and `/submit-test`
  for Math; Tests tab with timer, autosave, results. Acceptance: two diagnostics in a row produce different items; every
  numeric answer verified by a unit test in `worker/generators/__tests__`; a targeted test contains only weak skills.
- **Phase 3 — Reading, Language Usage, Science tests**: passage bank + LLM item generation with the validators in docs/03;
  parent marking queue. Acceptance: readability check runs on every passage; every LU item carries its rule and code.
- **Phase 4 — Coach**: `/coach` state machine, `data/explanations/` canonical explanations for priority-1 skills, voice
  in/out, practice/confirm sets, "Show me a step" after two wrong, spaced review scheduling, Today tab with fixed daily
  order, first-run tour. Acceptance: a full session on one skill reaches SECURE and the state updates correctly;
  guards trigger in tests; a failed CONFIRM re-explains with a new representation.
- **Phase 5 — Parent view & polish**: transcripts, weekly PDF export for the teacher, CSV export, urgency table, KPI
  panel (docs/07 §3), design pass per design/design-language.md.
- **Phase 6 — Year engine**: FSRS-lite scheduler with implicit repetition and timing evidence (docs/06 §2), monthly
  Knowledge Check, learn-ahead mode with `planned_month`, MAP mock, MAP RIT entry and re-weighting, confusable-skills
  interference rule. Acceptance: a simulated year of reviews (script) keeps every Mastered skill's modelled recall ≥ 0.9
  at the check dates and total daily reviews ≤ 10; learn-ahead only proposes skills whose prerequisites are Secure.

## 9. Out of scope (v1)
German, Art, Music, PE, Technology, Library. Paid voice. Mobile app. Multi-student (schema allows it; UI does not).

## 10. Safety
Elchin is a minor using an app built and operated by his parent. The coach prompt is locked, topics are limited to the
skills list, no external links except the allow-list in docs/04-sources.md, no personal-data collection beyond first
name, and all transcripts are reviewable by the parent. Anthropic's usage policies apply to the operator (Huseyn).
