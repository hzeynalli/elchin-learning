# CLAUDE.md — working rules for this repo

## Read first
BRIEF.md, then docs/01-context.md, docs/02-pedagogy.md, docs/03-question-guidelines.md. Skill maps are in data/.

## Non-negotiables
1. **No maths answer is ever produced by the language model alone.** Numeric items come from template generators in
   `worker/generators/*.js` that compute the answer in code. The model may write wording and explanations around a
   generated skeleton. See docs/03-question-guidelines.md.
2. **The Anthropic API key lives only in the Worker secret.** Never in the front-end, never in git. `.env` is gitignored.
3. **The coach system prompt is server-side** (worker/prompts/) and cannot be altered by anything the student types.
4. **Every coach message is stored** in `coach_sessions.messages` and visible in the parent view.
5. **Mastery rules are data, not opinion.** Implement exactly the rules in docs/02-pedagogy.md §3. Do not "improve" them.
6. **One page, tabs.** Single `index.html` (+ `app.js`, `styles.css`), hosted on GitHub Pages. No frameworks unless
   the owner agrees. CDN dependencies only. No build step.
7. **Two roles**: `student` (Elchin) and `parent` (Huseyn). Supabase Auth email+password. Row-level security on.
8. Stop at the end of each phase and report: what was built, what to click, what is not done.

## Models and voice (docs/08)
Pin `claude-fable-5-1` (coach), `claude-sonnet-5` (generation/marking), `claude-haiku-4-5-20251001` (guards).
ElevenLabs `eleven_v3` TTS + Scribe STT through the Worker. Never call either API from the browser.

## Conventions
- Language: JavaScript (ES modules) in browser and Worker; SQL for Supabase. No TypeScript unless asked.
- Fonts: Press Start 2P (headings, buttons, HUD) + Nunito (reading text). Minecraft-inspired "Overworld" skin — palette,
  block textures and words in design/design-language.md. The AI coach/voice are behind `FEATURES` in config.js (off since 9 Sep).
- Timezone: Asia/Baku. Dates stored as UTC timestamptz.
- Commit after each working step with a one-line message. Push to `main` only when the phase passes acceptance.
- Ask before: adding a paid service, changing the data model, changing mastery rules, changing the coach prompt.

## Owner
Huseyn Zeynalli (GitHub `hzeynalli`). Technical, not a professional engineer: explain non-obvious decisions briefly.
