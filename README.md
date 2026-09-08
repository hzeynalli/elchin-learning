# Elchin Learning — build package for Claude Code

Personal mastery-learning site for Elchin Zeynalli (10, QSI Baku, US Grade 5 equivalent).
Four MAP Growth subjects: Mathematics, Reading, Language Usage, Science. Plus QSI unit tracking.

## How to use this package
1. Unzip into a folder, e.g. `~/Projects/elchin-learning`. Open it in VS Code.
2. Create the accounts once: Supabase project, Cloudflare account, an Anthropic API key, an ElevenLabs API key.
   Put the values in `.env` (template in `.env.example`). Never commit `.env`.
3. Start Claude Code and say:
   > Paste FIRST_PROMPT.md. (It makes Claude Code read everything, restate the rules
   > and the question-verification rule. Then build Phase 1 from BRIEF.md and stop for review.
4. Review each phase in the browser before saying "continue to Phase N".

## What's inside
- `GAPS.md` — what is NOT here: content Claude Code must generate, what the owner must supply, honest limits
- `FIRST_PROMPT.md` — the exact first message to give Claude Code
- `AUDIT.md` — two council audits and what changed
- `BRIEF.md` — the product brief: goal, architecture, data model, endpoints, screens, build phases, acceptance criteria
- `CLAUDE.md` — working rules for Claude Code (conventions, secrets, what not to do)
- `docs/` — context, pedagogy, question-writing guidelines, sources, best practices borrowed, year plan + retention engine, focus/KPIs, AI stack (models, voice, language policy)
- `data/` — skill maps (JSON) for the four subjects + QSI engaged units + Grade 4 prerequisites
- `prompts/` — system prompts for the coach, test generator and marker
- `schema/` — Supabase SQL
- `worker/` — Cloudflare Worker skeleton (starting point, not final)
- `design/` — visual design language
