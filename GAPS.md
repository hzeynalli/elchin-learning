# GAPS — what this package does NOT contain, and what Claude Code must create or the owner must supply

## Claude Code must generate (large content tasks — budget time for them)
1. **Maths generators for all 38 maths skills** (`worker/generators/math/`). Only one example is provided. Each needs
   three tiers, seeded randomness, coded answers, ≥ 20 unit-test cases. This is the single biggest build task (Phase 2).
2. **`data/explanations/` — one canonical explanation per priority-1 skill** (~25 files): the idea in small steps,
   worked example, faded example, anticipated errors, representation sequence. Draft with the model, owner reviews.
3. **Passage bank** — ≥ 40 public-domain passages (Project Gutenberg, folktales, Aesop) cut to 250–500 words, run
   through the readability check, tagged by genre/topic; plus link-out lists for CommonLit/ReadWorks.
4. **Golden marking set** — 20 short-text answers with agreed marks, re-marked on every model change.
5. **Item bank seeding** — ≥ 10 verified items per (skill, tier) for all non-maths skills before Phase 3 acceptance.
6. **Front-end** — no wireframes are provided; build from BRIEF §7 and design/design-language.md.

## The owner must supply
1. **Accounts and keys**: Supabase (EU region), Cloudflare, Anthropic API key; a GitHub repo `elchin-learning`.
2. **Elchin's login**: an email alias on the parent's domain (a 10-year-old should not have his own inbox for this).
3. ~~The teacher's TSW sheets~~ — decided not to pursue; the full Grade-5 curriculum is the target (docs/01).
4. **The school's MAP Family Report and Learning Continuum** printout → enter RIT scores; re-weight priorities.
5. **The Italdizain design-language file** from OneDrive → drop into `design/` as the source of truth; the file here
   is an adaptation from the owner's stated preferences and should be superseded.
6. **Root-cause call with Ms Taljaard** — the app assumes the gap is knowledge.
7. **Bilingual fallback: decided ON** (docs/08 language policy). Needs no further input.
8. **ElevenLabs account and API key** (docs/08).

## Honest limits of what is "best practice"
- Pedagogy, tutoring moves, retention scheduling and MAP structure are grounded in cited sources (docs/04–06).
- The **QSI unit → skill mapping is approximate** (labels only); the curriculum itself is the full CCSS/NGSS Grade 5
  set, which is complete and authoritative.
- **FSRS-lite is a simplification** of FSRS with default parameters; it is not fitted to Elchin until ~1,000 reviews exist.
- Child-UX rules come from general practice for 8–11-year-olds, not from a specific study.
- No published evidence yet shows an LLM coach alone producing durable learning in 10-year-olds over a school year;
  the human loop (weekly parent review, teacher alignment, monthly blind checks) is what makes this defensible.

## Operational safeguards not yet in the brief (added here; Claude Code implements in Phase 1)
- **Cost cap**: Worker daily budget (USD 3/day default) → coach falls back to "practice only" when exceeded; parent alert.
- **Backups**: nightly Supabase export to the parent's storage (CSV of all tables) — Phase 5.
- **Data minimisation**: first name only; no photos stored except the optional worksheet check-in, deleted after 30 days.
