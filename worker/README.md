# Cloudflare Worker — starting point

Secrets (set with `wrangler secret put`): ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY. JWTs are verified
against the project's JWKS endpoint (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`); SUPABASE_JWT_SECRET only for
legacy projects.
Every request carries `Authorization: Bearer <supabase access token>`; verify the JWT, read `sub` as student/parent id,
load the profile, then act. Endpoints per BRIEF.md §6. Copy prompts/*.md from the repo root into worker/prompts at build.

Files to create:
- `src/index.js` — router + JWT verification + CORS (allow only the GitHub Pages origin)
- `src/anthropic.js` — one `chat({system, messages, json})` helper with retries and JSON extraction
- `src/mastery.js` — `recomputeSkillState()` implementing docs/02 §3 exactly, with unit tests
- `src/adaptive.js` — diagnostic planner/cursor implementing docs/02 §1
- `src/coach.js` — the state machine of docs/02 §2 + server-side guards (BRIEF §6)
- `src/bank.js` — item_bank refill (cron + on-submit), dedupe, verification calls
- `src/export.js` — weekly PDF for the teacher
- `src/scheduler.js` — FSRS-lite retention model + implicit repetition + interference rule (docs/06 §2), with a
  year-simulation script `scripts/simulate-year.js`
- `src/telemetry.js` — active-minute computation from events (docs/07 §2)
- `generators/math/*.js` — one file per math skill id; export `generate(tier, rng) -> {stem, answer, working, format}`
- `generators/__tests__/` — seeded tests with independent answer computation
