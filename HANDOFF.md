# HANDOFF — Elchin Learning build (living document)

**Read this first on the office laptop.** The full conversation that produced it is archived in
`90 Claude Workspace/Conversations/` (session `258ecc0c`, 8–9 Sep 2026). Code history is on GitHub
(`hzeynalli/elchin-learning`, private, branch `main`). The OneDrive copy at `90 Claude Workspace/Projects/elchin-learning/`
mirrors the repo without `node_modules`/`.git` and includes `.env` (logins + public keys).

Last updated: 2026-09-09 09:30 Baku — **all six phases built and unit-tested (205 tests); Worker DEPLOYED; GitHub Pages ON.**
Still missing: the two secrets (service_role, Anthropic key), seeding the live bank, the first run against the real Claude API.

---

## 9 Sep (office) — scope change and redesign

**Decision (Huseyn, 9 Sep):** park the AI coach and voice. The app now *tests, tracks and reports*; a human tutor teaches
the weak topics. Elchin is quizzed only on topics his dad has **unlocked** (last year's Grade-4 topics first, then Grade 5
semester by semester).

What changed in the code:
- `config.js` → `FEATURES: { coach: false, voice: false }` (flip to bring the Coach tab, transcripts and voice back — nothing
  was deleted) and `TERMS` (Last year = grade 4; Semester 1 = planned month < 2027-02; Semester 2 = the rest).
- **Topic unlocking**: `settings.unlocked_skills` (array of skill ids, `null` = everything open) — no schema change.
  `worker/src/settings.js` accepts and validates it; `POST /generate-test` (diagnostic + targeted) draws only from unlocked
  topics. Parent UI: Parent → **Unlock topics** (checkbox table by subject × term, Open/Lock all, gating switch, Save).
  **The Worker must be redeployed for this** (`cd worker && npx wrangler deploy`) — needs `wrangler login` on this laptop.
- **New front-end skin** ("Overworld", Minecraft-inspired) — `styles.css`, `index.html`, `app.js`; register documented in
  `design/design-language.md`. Student tabs: Home (three daily quests) · Quests · Map (topics as blocks, locked = bedrock).
- **Preview mode**: `?preview=1` (`&role=parent`, `&tab=map`, `&start=diagnostic`) shows every screen with fictional data,
  nothing written. Live: https://hzeynalli.github.io/elchin-learning/?preview=1
- The `.env` OneDrive mirror described below **never reached the cloud** (checked 9 Sep from the office); the two passwords
  live only in the MacBook's `.env`. Run `scripts/sync-to-onedrive.sh` at home, or reset them in Supabase → Auth → Users.

### 9 Sep afternoon — live state
- Worker secrets **ANTHROPIC_API_KEY** and **SUPABASE_SERVICE_KEY** set via the Cloudflare dashboard → `/health` = `llm: live, repo: service`.
- **Accounts reset** (old passwords were lost with the un-synced `.env`): parent `huseyn@zeynalli.me`, student now
  **`e.h.zeynalli@italdizain.az`** (same auth user id, profile rows untouched). Passwords in the office laptop's `.env`
  (`PARENT_PASSWORD`, `STUDENT_PASSWORD`) — copy that file, do not rely on OneDrive.
- **Bank seeded** from the laptop (`worker/scripts/seed-local.js`, run with `node --import ./scripts/md-loader.mjs`): 232 items, 16 passages.
  The Worker's own Seed/Refill hit Cloudflare's **50-subrequests-per-invocation** limit (free plan); `bank.js` now reads
  stock and stem hashes in one query each and refills 2–3 Claude calls per invocation (cron every 15 min keeps going).
  `node --import ./scripts/md-loader.mjs scripts/seed-local.js --refill 8` runs bigger batches locally if `ANTHROPIC_API_KEY` is in `.env`.
- **Deployed 9 Sep 15:30** from the office laptop (wrangler logged in as h.e.zeynalli@gmail.com): topic unlocking enforcement + the subrequest fix. Verified live: parent sets `unlocked_skills`, student gets checks only on those topics.
- **Lesson:** `wrangler deploy` wiped the two secrets that had been added in the Cloudflare dashboard. Secrets must be set with
  `npx wrangler secret put NAME` (they then survive deploys); `keep_vars = true` is now in wrangler.toml as a second guard.
  `SUPABASE_SERVICE_KEY` was re-set from `.env`; **`ANTHROPIC_API_KEY` must be re-set** (`/health` shows `llm: mock` until then).

### 10 Sep — BOSS rounds, big boss, points shop (Elchin's idea)
- A wrong answer in a Big/Practice/Story quest or a Daily review summons a **boss** on that skill (one per skill per quest):
  5 questions, each correct answer = 1 hit, wrong answers only "block"; up to 3 batches of 5, then the boss "escapes"
  (no penalty; the topic is listed for the tutor). Beating it = `boss_points.boss` (default 25). At the end of a quest with
  bosses, the **BIG BOSS** (Dragon King) mixes every boss skill: 5–10 questions, `boss_points.big` (default 50).
- Worker: `generate-test` modes `boss` (skill_id) and `big_boss` (skill_ids, count); `POST /boss/finish`; bonus in
  `finalizeTest`; `POST /shop` (skip 20 / extra time 10 pts, `settings.shop_prices`); `POST /skip-item` (voids the item,
  refused in the Big quest); `GET /helper?skill_id` (canonical explanation for the Helper button — a human/AI tutor later).
- Front-end: the quest is parked (`state.parked`) and a boss run takes `state.run`, so the question screen, timer and
  marking are reused unchanged; pixel-art bosses drawn with box-shadow (`BOSSES`, `BIG_BOSS` in app.js); all quests except
  Memory game and Arena now go through `/next-item` so every answer is marked immediately. Parent → Settings: bosses on/off,
  bonus points, shop prices. Preview: `?preview=1&start=targeted&boss=1` or `&boss=big`.
- Migration `schema/migrations/0003_boss_kinds.sql` (`boss` / `big_boss` in `test_kind_t`) — **applied 10 Sep 13:25** by Huseyn in the
  SQL editor; live boss + big boss verified with Elchin's account, test rows deleted afterwards. `src/__tests__/boss.test.js` covers it.

## ▶ START HERE (office, 9 Sep): connect the two API keys

The app is already live at **https://hzeynalli.github.io/elchin-learning/** (Worker deployed, Pages on). Only two
secrets are missing. On the office laptop:

```
git clone https://github.com/hzeynalli/elchin-learning ~/Projects/elchin-learning   # or open the OneDrive copy
cd ~/Projects/elchin-learning/worker && npm install
npx wrangler login                                 # one browser click (Cloudflare account h.e.zeynalli@gmail.com)
npx wrangler secret put SUPABASE_SERVICE_KEY       # Supabase → Project Settings → API → service_role (Reveal)
npx wrangler secret put ANTHROPIC_API_KEY          # platform.claude.com → API keys
```
No redeploy needed. Then log in as parent (huseyn@zeynalli.me, password in `.env`) → Parent → *Exports & admin* →
**Seed content**, then **Refill bank now**. Check the footer no longer says "preview mode" / "read-only".
Then continue with §6 (open items).

## 0. How to resume at the office (about 30 minutes to a working app)

1. `git clone https://github.com/hzeynalli/elchin-learning ~/Projects/elchin-learning` (or open the OneDrive copy).
2. Copy `.env` from the OneDrive folder into the repo root. It holds the two logins and the public Supabase keys.
3. `cd worker && npm install && npm test` → **205 passed**. `node scripts/simulate-year.js` → ACCEPTANCE: PASS.
4. Get the secrets this laptop could not obtain (§2): Anthropic API key, Supabase `service_role` key.
5. ~~`npx wrangler login`~~ done on the MacBook (redo on the office laptop if deploying from there). Then:
   ```
   npx wrangler secret put SUPABASE_URL            # https://vwyrphshpikkpbybghye.supabase.co
   npx wrangler secret put SUPABASE_ANON_KEY       # from .env
   npx wrangler secret put SUPABASE_SERVICE_KEY    # Supabase → Project Settings → API → service_role
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
   (Local dev: copy `worker/.dev.vars.example` → `worker/.dev.vars` with the same values, `npx wrangler dev`.)
6. Put the deployed URL (`https://elchin-learning.<your-subdomain>.workers.dev`) into `config.js` → `WORKER_URL`,
   commit, push, `npx wrangler deploy` again (the Worker serves the site itself — see §3 hosting).
7. Open the Worker URL. Log in as **parent** (`huseyn@zeynalli.me`, password in `.env`):
   - Parent → *Exports & admin* → **Seed content** (loads 16 passages + 232 hand-written items into the live bank).
   - Parent → *Exports & admin* → **Refill bank now** (Claude writes verified items for every non-maths skill below 10/tier; ~USD 0.5).
   - Parent → *Paper diagnostic* → enter Elchin's Diagnostic 1 scorecard (29 ticks) so the app does not start empty.
8. Log in as **Elchin** (`elchin@zeynalli.me`): Today tab → follow the three steps. The first-run tour explains it.
9. Then tell Claude Code: *"Read HANDOFF.md and continue from §6 (open items)."*

## 1. What exists and where

| Thing | Location / value |
|---|---|
| Supabase | project `elchin-learning`, ref `vwyrphshpikkpbybghye`, eu-central-1, free tier, org H.Z.org. URL https://vwyrphshpikkpbybghye.supabase.co |
| Schema | `schema/migrations/0001_init.sql` (15 tables, RLS everywhere, `supervised_student()` helper) and `0002_reading_kind.sql` — **both applied** |
| Seeds | `schema/seed/0001_skills.sql` (**applied**: 102 skills, 35 priority-1); `0002_content.sql` (passages + items — apply via *Seed content* button or the SQL editor); `0003_explanations.sql` (optional owner-editable copies) |
| Logins | parent `huseyn@zeynalli.me`, student `elchin@zeynalli.me` — passwords in `.env`; change in Supabase → Auth → Users if you wish |
| GitHub | https://github.com/hzeynalli/elchin-learning (private, `main`) |
| Cloudflare | **deployed**: https://elchin-learning.hzeynalli.workers.dev (account f07c33aa…, subdomain `hzeynalli`, logged in with wrangler on the MacBook); secrets set so far: SUPABASE_URL, SUPABASE_ANON_KEY |
| App URL | **https://hzeynalli.github.io/elchin-learning/** (GitHub Pages, repo made public 9 Sep) — or the Worker URL itself (same site) |
| Worker | `worker/src/` — `index.js` (router, CORS, JWT, roles) · `auth.js` (JWKS ES256) · `repo.js` (two Supabase clients) · `mastery.js` · `scheduler.js` (FSRS-lite) · `adaptive.js` · `marking.js` · `recompute.js` · `dashboard.js` · `manual.js` · `tests.js` · `itemgen.js` · `bank.js` · `parent.js` · `coach.js` · `voice.js` · `export.js` · `year.js` · `telemetry.js` · `anthropic.js` · `items.js` · `readability.js` |
| Generators | `worker/generators/math/` — 38 files, one per maths skill, `lib.js` helpers; `generators/__tests__/math.test.js` independent verifier |
| Content | `data/passages/` (16), `data/items/` (136 LU + science), `data/explanations/` (35 canonical explanations), `data/qsi_crosswalk.json`, `data/confusables.json` |
| Front-end | `index.html`, `app.js`, `styles.css`, `config.js` at the repo root; `.assetsignore` hides everything else from the Worker's static hosting |
| Scripts | `scripts/build-seed-sql.js`, `build-content-seed.js`, `build-explanations.js`, `check-passages.js`, `sync-to-onedrive.sh`; `worker/scripts/simulate-year.js` |
| Tests | `cd worker && npm test` — 205 tests in 12 files |
| Models | `worker/wrangler.toml`: coach `claude-fable-5-1` · marking `claude-fable-5-1` (MODEL_MARK) · generation + verification `claude-sonnet-5` · guards `claude-haiku-4-5-20251001`. One-line switches. Daily budget `DAILY_BUDGET_USD = 3` → 402 + practice-only fallback |

## 2. What the office must do first (things this laptop could not)

1. **Anthropic API key** — none exists on this machine. Until set, the Worker runs coach, generation and marking in
   **mock mode** (deterministic canned replies; the footer says "preview mode"). Create at platform.claude.com.
2. **Supabase service_role key** — the MCP connector can only read publishable keys. Without it the Worker answers
   every *write* with 503 (`… needs SUPABASE_SERVICE_KEY`). Reads work with the user's own JWT.
3. ~~`npx wrangler login`~~ done 9 Sep; Worker deployed. Remaining secrets: `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY` (then `npx wrangler deploy` is NOT needed again — secrets apply immediately).
4. **Seed + refill the bank** (§0 step 7). Reading / LU / Science checks return 503 until then.
5. Later: **ElevenLabs** key + voice id (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; optional `ELEVENLABS_TTS_MODEL`,
   `ELEVENLABS_STT_MODEL` — verify current ids against ElevenLabs docs; defaults `eleven_v3` / `scribe_v1`). Until then
   the browser's Web Speech API is used automatically (Chrome on laptop/Android for voice input; iPad voice output only).
6. Owner items from GAPS.md still open: Elchin's real email alias (the login works without mail), MAP Family Report
   (enter in Parent → MAP scores), the Italdizain design-language file, the root-cause call with Ms Taljaard.

## 3. Decisions and interpretations to confirm (I chose; you can veto)

- **Hosting**: repo is private (child's name and data). GitHub Pages on a private repo needs Pro, so `wrangler.toml
  [assets]` serves `index.html` from the Worker (same origin, no CORS). CLAUDE.md #6 names GitHub Pages — switch by
  making the repo public and setting Pages to `main` root; CORS already allows `https://hzeynalli.github.io`.
- **Maths answers in code, Claude for everything else** (CLAUDE.md #1, your message of 9 Sep): 38 template generators
  compute every number; Claude rewrites tier-2/3 word problems as stories and a second cold-solve call must reproduce
  the coded answer before the rewording ships (`itemgen.rewordWordProblem`). All non-maths items are Claude-generated
  and Claude-verified; every open answer is Claude-marked (Fable 5.1) with confidence; coaching is Fable 5.1 end to end.
- **Canonical maths skills = `skills_math_ccss.json` (38)**; QSI labels (`E02.5`…) are aliases; the paper diagnostic's
  29 questions map to 18 canonical skills (`data/qsi_crosswalk.json`). Q4 (six facts) is stored as six items.
- **Mastery reading** (`mastery.js` header): Secure/Mastered keeps its status on 0.7–0.89 ordinary tests (streak resets);
  < 0.7 or a failed review demotes; < 0.5 → Not yet even from Secure. Two consecutive ≥ 0.9 need a tier-3 correct
  across the pair. Fluency skills need ≤ 3 s/item. Practice retry-correct = 0.5; confirm retry = 0.
- **FSRS-lite constants**: docs/06's printed constants give ~10 % growth per review and cannot yield the promised
  "2, 6, 15, 35, 80, 180 days"; implemented with FSRS's published weights (w8 1.49, w9 0.14, w10 0.94) → 2, 6, 18, 50,
  125, 290 days, cap 3×S. The year simulation passes with these. Parameters in `scheduler.js FSRS`.
- **Tier-3 slip**: the slipped confirm item is voided (`item.voided`) and one replacement tier-3 item is served;
  the set then counts 5 of 5. Claude judges slip vs misconception (`/coach/replacement`).
- **Coach guards**: input ≤ 400 chars; Haiku off-topic classifier, two hits → session paused + parent flag; 30-minute
  block; 60 minutes of coach time per day (`settings.daily_cap_minutes`); after 3 failed cycles → suggest break + flag.
- **Student wording**: the tab is "Checks", the monthly knowledge check is the "Memory game"; the word "test" never
  appears in the student UI (design-language.md over BRIEF §7).
- **Temperature 0** (mark/verify prompts) is unavailable on Sonnet 5 / Fable 5.1; approximated with `effort: "low"` +
  JSON-only instructions + one repair retry.
- **Schema additions** (additive): `skills.aliases/planned_month/fluency/map_area`, `skill_state.reviews_passed`,
  `tests.loop_id`, `coach_sessions.off_topic_hits/active_s`, `passages.questions`, tables `explanations`, `llm_usage`;
  `test_kind_t` + `knowledge_check`, `map_mock`, `reading`; RLS on all 15 tables; profiles policy via a security-definer
  function (the package's self-referencing policy would recurse).
- **Learn-ahead** starts on the 15th of each month for next month's `planned_month` skills whose prerequisites are
  Secure, max 2 (docs/06 §1). **Interference rule** uses `data/confusables.json` (8 pairs) in review planning.
- **Backups** (GAPS): the CSV export covers all tables; no nightly job (no storage target was specified).

## 4. Status by phase (BRIEF §8)

### Phase 1 — Data & auth ✅
Schema + item_bank, seed from data/, two users (both log in — verified with curl), RLS (verified over HTTP: student
sees own rows only, parent both, anon nothing, client writes 403), JWKS verification (project uses ES256), wrangler
template, CORS lock, `GET /dashboard` with headline metrics, Progress tab, manual-entry screen, points + rewards,
cost cap, eight-rule mastery test. **Open**: deploy; live writes (service key).

### Phase 2 — Tests ✅
38 generators with independent verification (115 cases × 20 seeds), Claude word-problem rewording with cold-solve
check, `/generate-test` (diagnostic scope A/B, targeted, practice10, confirm5, review, daily_review, reading,
knowledge_check, map_mock), `/next-item` with immediate feedback + practice retry rule, `/answer-item`, `/submit-test`,
prerequisite gating, sittings of 25, Checks UI (timer, fluency countdown, option cards, ordering, feedback panel,
results with per-skill bars). Acceptance tests: different items on repeat, every numeric answer verified, targeted
= weak skills only.

### Phase 3 — Reading / LU / Science ✅
Readability gate (FK 4.5–6.5, 11–17 words/sentence, 250–500 words) in code; 16 original passages × 6 questions; 136
hand-written LU + Science items with rule + code; item bank engine (Claude generate → Claude verify → store; cron
every 15 min; dedupe by stem+options hash); marking (exact formats in code, open answers by Claude with confidence;
< 0.8 + 10 % sample → parent queue with ✓/✗ + feedback → recompute); reading mode (one passage, full set); Admin
seed/refill/stock. **Open**: seed live bank (one click); passage bank is 16 of the ≥ 40 target — the refill writes
more reading items from them; golden marking set (20) to draft after the first real marks.

### Phase 4 — Coach ✅
State machine EXPLAIN_n → PRACTICE_10 → CONFIRM_5 → SECURE with representation rotation (words → picture/number line
→ area model/table → story → teach a younger kid), tags `[READY_FOR_PRACTICE]`/`[SUGGEST_BREAK]`/`[PARENT_SUMMARY]`,
server-side prompt with cached static rules + per-turn header + canonical explanation (35 files, all priority-1
skills), every turn stored, guards (§3), streaming SSE with end-of-stream metadata, tier-3 slip replacement, "Show me
a step" after two wrong, comments on every practice answer, voice in/out (ElevenLabs via Worker, Web Speech fallback),
Russian fallback logged as `ru_fallback`, Today tab fixed order (review → coach → reading → continue check → learn
ahead), first-run tour, telemetry batches every 30 s. Acceptance (tests): a full session reaches SECURE and the state
updates; guards trigger; a failed confirm re-explains with a new representation.

### Phase 5 — Parent view & polish ✅
Transcripts (full read, flags shown), weekly one-page PDF for the teacher (`/export/weekly.pdf`, pdf-lib), CSV export
of every table, urgency table, KPI panel incl. retention rate, guessing rate, streak, focus ratio (docs/07 §3–4 note),
design language applied (porcelain/copper, Inter + Cormorant, 18 px student base, 56 px buttons, chips, no red/green).

### Phase 6 — Year engine ✅
FSRS-lite wired into every review/knowledge-check submission (pass → S grows, next review scheduled; fail → S × 0.3,
Emerging), implicit repetition (0.5 credit to Secure prerequisites, maths + grammar mechanics), timing as evidence
(slow-correct = half credit), interference rule, daily cap 10 most-overdue-first, monthly Knowledge Check (20 items,
5 school-style, blind), MAP-style mock (40 items, results by instructional area), MAP RIT entry, learn-ahead. Acceptance:
`worker/scripts/simulate-year.js` (same `scheduler.js`) — 38 skills, ≤ 3 reviews/day, every Mastered skill ≥ 0.9
modelled recall at all nine monthly checks: PASS. **Open**: RIT-band re-weighting of priorities needs the school's
Learning Continuum (docs/01); re-fit FSRS after ~1,000 real reviews.

## 5. FIRST_PROMPT.md answers (for the owner to check)

1. **Goal / 1 Oct scope.** A private one-page web app where Elchin (10, QSI Baku, US Grade 5) is diagnosed, coached
   and re-tested until each tracked skill is Secure — first the 35 priority-1 skills tied to QSI Math E01–E02, Reading
   E01–E02, Writing E01–E02 by **1 October 2026**, then every MAP strand through the year with a retention engine so
   September's skills still hold in March. Huseyn sees everything; Phase 0 (paper diagnostic) is entered by hand.
2. **Mastery rules (docs/02 §3)** — qualifying test ≥ 3 items. Not yet: no data or < 0.5. Emerging: 0.5–0.89, a 4/4
   diagnostic without confirmation, or practice passed but confirm not yet. Secure: practice ≥ 0.9 **and** confirm ≥ 0.9
   in one loop, or two consecutive ≥ 0.9 with a tier-3 correct. Mastered: Secure + two passed scheduled reviews.
   Regression: any qualifying test < 0.7 → Emerging, chain cleared. Fluency skills: ≥ 90 % at ≤ 3 s.
   **Coach loop (docs/02 §2)** — activate → small steps → worked example → faded example → explain back; practice 10
   (7×t2, 3×t1, one hint + retry at 0.5); confirm 5 (≥ 3×t3, no retry credit; single tier-3 slip → one replacement);
   any fail → new representation; three cycles → break + parent flag; items never repeat.
3. **Maths verification rule (docs/03 §3)** — every numeric answer is computed by a seeded template generator and
   re-verified by ≥ 20 independent unit cases; Claude may reword the story only if a cold solve matches.
4. **Accounts / keys** — §0 and §2.
5. **Phase plans + acceptance** — §4.

## 6. Open items, in order

1. §0 steps 4–7 (secrets, deploy, seed, refill, enter Diagnostic 1).
2. First real session with Elchin: watch the coach transcript in Parent → Coach transcripts; adjust
   `settings.daily_minutes` and rewards.
3. Draft the 20-item golden marking set from the first marked answers (`GAPS #4`); store in `data/golden/`.
4. ElevenLabs (§2.5). Verify model ids, pick one warm adult voice, set `ELEVENLABS_VOICE_ID`.
5. Grow the passage bank toward 40 (`POST /admin/refill-bank` reuses existing passages; new passages go in
   `data/passages/*.json` and must pass `node scripts/check-passages.js`).
6. When the MAP Family Report arrives: Parent → MAP scores; then decide priority re-weighting.
7. Optional: GitHub Pages instead of Worker hosting; nightly CSV backup job.
