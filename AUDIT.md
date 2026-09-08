# AUDIT — council review of this package (v1.0 → v1.1)

Method: Karpathy's "LLM Council" pattern — four independent judges review the same package blind, then a chairman
synthesises. Here all four judges are the same model run with different mandates, so treat it as a structured
self-audit, not four independent opinions.

Question put to the council: *Is the package perfect, and will it 100% reach the goal — Elchin masters every tracked
skill by 1 October and every MAP strand thereafter?*

## Judge 1 — Learning scientist
- **Diagnostic volume is wrong for the deadline.** 80–160 items per subject × 4 subjects = 320–640 items before any
  coaching. At ~1 min/item that is 5–10 hours of a 45–60 min/day budget, i.e. a week of the 23 days left.
  → Fix: Diagnostic runs in two scopes. Scope A = priority-1 skills only (the ~25 tied to QSI E01/E02) ≈ 100–150 items,
  three sittings, done by 12 Sep. Scope B (MAP strands) is spread over October, interleaved with coaching.
- **CONFIRM_5 at 5/5 with three tier-3 items** will produce loops on skills he actually knows. The evidence base
  (Bloom, Rosenshine) uses 80–90 %. → Keep the parent's 90 % setting, but a tier-3 miss with a correct method (coach
  judges) triggers one *replacement* tier-3 item instead of a full re-explain. Parent can disable.
- Coaching without a **worked-example bank** will drift: each explanation is improvised. → Add `data/explanations/` —
  one canonical explanation per priority-1 skill with the representation sequence, written before Phase 4.
- Nothing addresses **motivation**. A 10-year-old will not sustain 50 min/day on chips and streaks alone.
  → Add a points ledger with parent-defined rewards (parent enters the reward; app only counts).
- Reading mastery cannot be established by MC items alone. → Oral reading fluency (RF.5.4) is parent-timed weekly; a
  short-text "quote the evidence" item is mandatory in every passage set. Already partly in docs/03; made explicit.

## Judge 2 — Software architect (can Claude Code build this from the brief?)
- **JWT verification is under-specified.** Newer Supabase projects sign with asymmetric keys (JWKS), not a shared secret.
  → Worker verifies via the project's JWKS endpoint; `SUPABASE_JWT_SECRET` becomes optional legacy.
- **Per-item LLM generation in `/next-item` adds 3–8 s latency per question** — fatal for a child's attention.
  → Pre-generate: keep a verified buffer of ≥ 10 unused items per (skill, tier) in a `item_bank` table, refilled
  asynchronously (Worker cron or on-submit). Maths template items are instant anyway.
- **Web Speech API**: `SpeechRecognition` is unreliable on iPad (all iOS browsers use WebKit). → State the supported
  device: Chrome on a laptop/Chromebook or Android tablet for voice; iPad works for everything except voice input.
- Missing pieces Claude Code would have to guess: seed script (`scripts/seed.js`), the manual-entry screen for the paper
  diagnostic, CORS origin, Supabase email-confirm settings, a `wrangler.toml` template. → Added to BRIEF §8 Phase 1.
- No explicit test for the mastery function against the rule table. → `worker/src/__tests__/mastery.test.js` with the
  eight cases from docs/02 §3 is now an acceptance criterion.

## Judge 3 — Product / goal owner
- **No document can make "100 % by 1 Oct" true.** Three things bind: build time (five phases ≈ 8–12 working evenings),
  Elchin's daily time, and unknown root cause (if it is attention or effort, the loop stalls — teacher call still
  pending). → Reframe: 1 Oct target = every priority-1 skill Secure. MAP strands = rolling target. Add a "projected
  date" per subject on the dashboard computed from current velocity, so the parent sees early if the plan slips.
- **Parallel track is missing from the plan.** The app will not coach before ~Phase 4 (~22 Sep). → Phase 0: coaching
  starts now — paper Diagnostic 1, then chat-based coaching (this conversation) on the top-3 gaps, entered into the
  app when Phase 1 lands. The app's first data is not empty.
- Teacher is outside the loop. → Weekly one-page PDF export (skills Secure/Emerging/Not yet + minutes) to send to
  Ms Taljaard; keeps school and home aligned and gets the TSW sheets moving.
- Success metrics were vague. → Dashboard headline metrics: % priority-1 Secure, days to 1 Oct, projected date,
  minutes this week vs target, items answered this week.

## Judge 4 — Child UX & safety
- The coach's only guardrail is its prompt. → Server-side guard: a session must have a skill; input > 400 chars or
  off-topic classifier hit twice → session pauses with a parent note. Hard cap 60 min/day, 30 min per coach block.
- "Try again" loops can feel punitive. → After two wrong in a row the app offers "Show me a step" (coach reveals one
  step), never a third bare retry.
- Onboarding for a 10-year-old is absent. → A 2-minute first-run tour and a fixed daily order (Today tab) so he never
  has to choose what to do.
- Data region: choose an EU Supabase region; store first name only; no photos.

## Chairman's synthesis
Verdict: **not perfect, and no version can guarantee the goal.** The package was sound on pedagogy and architecture but
had four real defects — diagnostic volume vs deadline, per-item latency, missing parallel track, and no motivation
layer — plus a set of specification gaps that would have cost Claude Code a day of guessing. All are fixed in v1.1
(this file, BRIEF.md §0, §6, §8, docs/02 §1–§2, worker/README.md). What remains outside any document's control:
the teacher's TSW sheets, the root-cause conversation, and Elchin's 50 minutes a day.

Council ranking of risk after fixes (highest first): 1) time — build and child; 2) root cause not knowledge;
3) writing/reading mastery needing human marking; 4) voice on iPad; 5) LLM item quality outside maths (mitigated by
double-check calls and the item bank).

---

# Council round 2 — v1.2 (year engine, telemetry, LLM-first marking)

Question: *With the year-long engine, the KPI layer and LLM-first marking added, is the package now complete for the
goal "master every subject over the year, and still remember in March what was learned in September"?*

## Judge 1 — Learning scientist
- FSRS-lite is the right choice over fixed intervals; the parameters are borrowed from FSRS defaults and are not fitted
  to Elchin. → Fine for the first 3 months; after ~1,000 reviews, re-fit stability growth per subject from his own data
  (Phase 6 backlog). Documented.
- Implicit repetition credit (0.5 to prerequisites) is sensible for maths and mechanics; it would be wrong for reading
  comprehension and science concepts. → Correctly limited in docs/06 §2.
- Learn-ahead can outrun the school and bore him in class. → Cap at two skills of the next unit; the rest waits for
  engagement. Added to docs/06 §1.
- Missing: transfer. Mastered in-app ≠ applied on a school test in a different format. → Monthly Knowledge Check
  now includes 5 items in "school style" (Go Math / QSI rubric wording), and the paper worksheet check-in photo is
  used to compare with his in-app working. Added to docs/06 §3.
- **Still open**: there is no evidence base for an LLM coach producing durable learning in 10-year-olds over a year;
  the human loop (parent weekly review, teacher alignment) is what de-risks this. Keep it.

## Judge 2 — Software architect
- Phase 6 is a real engine with a simulation acceptance test — good. The year simulation must use the same
  `scheduler.js` as production, not a copy. Noted in worker/README.
- Telemetry via Page Visibility + idle detection is standard and cheap; it cannot see other windows on a laptop
  (by design). The OS parental controls cover that. Correct trade.
- LLM-first marking of writing raises API volume; budget stays trivial for one student (< USD 15/month at Sonnet-class
  prices even with double-check calls).
- Risk: model drift — a future model update changes marking strictness. → Fixed model string per environment and a
  20-item golden set re-marked on every model change (added as a Phase 3 acceptance item).
- Build effort has grown: six phases. Realistic: Phases 1–4 by ~25 Sep with evening work; 5–6 in October. The 1 Oct
  priority-1 target does not depend on Phases 5–6.

## Judge 3 — Product / goal owner
- The reframed goal (priority-1 Secure by 1 Oct; MAP as checkpoints; retention proven by monthly checks) is now
  measurable, and the dashboard shows the two numbers that matter: projected date and retention rate.
- KPIs are complete and the "how to use them with him" section is the most important half-page in the package.
- The camera/screen request is declined with reasons and replaced by a measurable alternative. Right call.
- **Still outside the document**: the teacher's TSW sheets (the QSI layer is reconstructed), the root-cause call, and
  the family's ability to protect 50 minutes a day for nine months. Nothing in software fixes those.

## Judge 4 — Child UX & safety
- Telemetry visible to Elchin himself — yes; secret monitoring would be worse than no monitoring.
- Push-to-talk microphone, no ambient recording — correct.
- Monthly blind checks can feel like exams. → Framed in the student UI as "Memory game" with points, never "test".
  Added to design/design-language.md.
- A nine-month product needs novelty: rotate contexts, add a "choose your topic" reading option, and let him pick the
  order of blocks on Fridays. Added to docs/02 §3b.

## Chairman's synthesis — round 2
The package now specifies a full-year, retention-aware, self-monitoring system, and is complete enough for Claude Code
to build without guessing. Residual risks, ranked: (1) build time vs the 1 Oct window — mitigated by Phase 0 and by
Phases 5–6 being post-1-Oct; (2) unknown root cause — teacher call; (3) sustained daily time — the rewards ledger and
the weekly review help, but this is a parenting variable; (4) reconstructed QSI layer until the TSW sheets arrive;
(5) LLM item quality outside maths — mitigated by verification calls, the item bank, and the golden set.
Verdict: **ready to build. Not a guarantee — no document is — but every controllable risk now has a control.**
