# 08 — AI stack: which model, which voice, which language

## Language model: Claude via the Anthropic Messages API (all calls from the Worker)
Verified against Anthropic's model docs (platform.claude.com, Sep 2026). Pin model strings; never use aliases.
| Job | Model string | Why |
|---|---|---|
| Coach dialogue, explanations, faded examples, session summaries | `claude-fable-5-1` | The most capable generally available Claude model; this is where teaching quality lives. It includes safety classifiers that can decline requests — acceptable and desirable for a child-facing app. |
| Item generation (non-maths), verification second call, marking, parent reports | `claude-sonnet-5` | High volume, frontier quality at lower cost |
| Off-topic guard, telemetry labels, dedupe judgements | `claude-haiku-4-5-20251001` | Fast, cheap classification |
Docs: https://platform.claude.com/docs/en/about-claude/models/overview ; Fable pricing (Fable 5 at launch) USD 10 / 50 per million
input / output tokens — https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
Rough cost for one child: ~25 coach minutes/day ≈ 40–80k tokens/day on Fable ≈ USD 1–3/day; Sonnet/Haiku traffic
< USD 0.5/day. Daily cap default USD 5 (GAPS.md) → falls back to practice-only.
Use prompt caching for the coach system prompt + skill explanation; use streaming for every coach reply.
On any model change: re-run the 20-item golden marking set and a 10-turn coach transcript review before switching.

## Voice: ElevenLabs, via the Worker (key never in the browser)
- **Text-to-speech**: `eleven_v3` conversational mode for expressive, natural delivery in 70+ languages including Russian;
  fall back to `eleven_flash_v2_5` (~75 ms) if latency on the child's connection is a problem. Stream audio so
  playback starts before generation ends. Pick one warm, clear, adult voice (not a cartoon voice) and keep it for the
  year — consistency matters to a child. Audio tags allowed: none except a short pause; no [laughs].
- **Speech-to-text**: ElevenLabs Scribe (realtime) with the same key; verify the current model id in the ElevenLabs
  docs at build time. Push-to-talk only; the browser's Web Speech API remains as a free fallback when the
  ElevenLabs budget is off.
- Cost: TTS ≈ USD 0.05–0.10 per 1,000 characters; a 25-minute coach block ≈ 3–5k characters ≈ USD 0.3–0.5/day.

## Language policy
- Instruction language: English (school is English-medium; MAP is in English).
- **Russian fallback: ON by default.** Trigger: he says "I don't understand" (or Russian equivalent) twice on the same
  step, or types in Russian. The coach gives ONE sentence in Russian that re-explains the step, then continues in
  English and asks him to say it back in English. Never more than one Russian sentence per step; never Russian for
  the answer itself. TTS voice must support Russian (v3 does). Logged as a `ru_fallback` event for the KPI panel.
