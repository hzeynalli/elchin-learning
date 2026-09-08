# 02 — Pedagogy: how the app diagnoses and teaches

Grounded in: Rosenshine, *Principles of Instruction* (2012); mastery learning (Bloom 1968); retrieval practice
(Roediger & Karpicke 2006; Karpicke & Aue 2015); spaced and interleaved practice (Rohrer & Taylor 2007; Dunlosky et al.
2013); worked/faded examples (Sweller); expert-tutor research (Lepper & Woolverton 2002; Chi & Wylie 2014; Graesser
"scaffolding episodes"; VanLehn 2011); LLM-tutor findings (MathDial, MathTutorBench, Tutor CoPilot 2024). Sources in
docs/04-sources.md. Four principles every generated tutor turn must satisfy: **correct**, **scaffold — never give the
answer away**, **let him self-correct first**, **don't overload — one idea per turn**.

## 1. Adaptive diagnostic (find out what he really knows)
Goal: a defensible status for **every** skill in the subject, not a 20-question snapshot.
- Per skill: ask at least **4** items, at most **8**. Start at tier 2.
  - 4/4 correct → stop; status *Secure candidate* (needs one confirmation later).
  - 3 wrong within the first 4 → stop; *Not yet*.
  - Otherwise continue to 8 items and set status by rate (see §3). Mix tiers 1–3 as you go: a wrong answer drops the
    next item one tier, a right answer raises it (never above 3).
- **Scope A first**: priority-1 skills only (≈ 25 skills, ≈ 100–150 items, three sittings, target done by 12 Sep).
  **Scope B** (priority 2–3, MAP strands) is spread through October, interleaved with coaching. A full-subject
  diagnostic (80–160 items) is only run on request.
- **Sittings-based**: max 25 items per sitting, resumable, order interleaved across skills so he doesn't see
  "10 fraction questions in a row".
- Prerequisite gating: if a Grade-5 skill fails and it lists Grade-4 prerequisites that have no data, the diagnostic
  pulls those in next (root-cause finding).
- The diagnostic can be re-run in full at any time; a re-run creates a new baseline and keeps history.

## 2. The coach loop (per skill) — implement as a state machine
```
EXPLAIN_1 → PRACTICE_10 → (≥90%) → CONFIRM_5_HARDER → (≥90%) → SECURE
                          ↓ (<90%)                     ↓ (<90%)
                       EXPLAIN_2 (different representation) → PRACTICE_10 → CONFIRM_5_HARDER → …
```
- **EXPLAIN_n**: Rosenshine sequence. (1) activate prior knowledge with one question; (2) explain the idea in small
  steps — one step per turn, ≤ 3 sentences; (3) one fully worked example; (4) one faded example he completes;
  (5) check by asking him to explain it back. Representation rotates on every cycle: words → picture/number line → area
  model/table → story context → "teach it to a younger kid". Never repeat the same explanation.
- **PRACTICE_10**: 10 new items at tiers 1–2 (7 at tier 2, 3 at tier 1). Immediate feedback per item: if wrong, one
  scaffold hint ("look at the ones column first"), he retries once; a retry-correct counts 0.5. Pass = ≥ 90%.
- **CONFIRM_5_HARDER**: 5 new items at tiers 2–3 (at least 3 at tier 3: multi-step, word problem, "find the mistake",
  "explain why"). Pass = ≥ 90% (i.e. 5/5; a retry-correct does not count here). Threshold is a parent setting.
  Exception (parent can disable): if the single miss is a tier-3 item and the coach judges the method correct (slip,
  not misconception), one replacement tier-3 item is served instead of a full re-explain cycle.
- Fail anywhere → next EXPLAIN cycle with a different representation. Unlimited cycles for Elchin. After 3 cycles in one
  session the app suggests a break and writes a `flag_parent` note with the specific sticking point; it does not block.
- Items are **never repeated**: generators use fresh seeds; LLM items are checked against the skill's last 300 items.
- Secure → spaced reviews (§3). Reviews that fail send the skill back into the loop at EXPLAIN with a fresh representation.

## 3. Status rules (implement exactly; thresholds are settings with these defaults)
Per skill, per qualifying test (≥ 3 items on the skill): `rate = correct / items`.
- **Not yet**: no data, or last rate < 0.5.
- **Emerging**: last rate 0.5–0.89, or diagnostic 4/4 without confirmation, or PRACTICE passed but CONFIRM not yet.
- **Secure**: PRACTICE_10 ≥ 0.9 **and** CONFIRM_5_HARDER ≥ 0.9 in the same loop, or two consecutive qualifying tests
  ≥ 0.9 with at least one tier-3 item correct.
- **Mastered**: Secure, then two passed reviews scheduled by the memory model (docs/06 §2; typically ≈ +2d and ≈ +6d).
  Reviews then continue for the whole year at growing intervals; the monthly Knowledge Check re-tests blind.
- **Regression**: any qualifying test < 0.7 → Emerging, review chain cleared, skill goes back to the urgency list.
- Fluency skills (times tables, number facts) also need a `fast` flag: ≥ 90% at ≤ 3 s per item.

## 3b. Motivation
Points per correct answer (tier-weighted), per completed loop, per review day. Parent defines what points buy (the app
only counts). Streak shown but never punished. The first-run tour explains the daily order once. Novelty over a year:
rotate contexts, a "choose your topic" reading option, and on Fridays he picks the order of the blocks.

## 4. Daily session shape (45–60 min; the Today tab enforces it)
1. Daily review, 10 mixed items from Emerging/Secure skills across subjects (retrieval, interleaved), ~8 min.
2. Coach block on the most urgent skill, ~25 min (one loop or part of it — progress is saved mid-loop).
3. Reading passage with 4–6 questions, ≥ 4 days a week, ~10 min.
4. If time remains: continue the diagnostic (next sitting) or a second coach block. Never more than two new skills a day.
Never end a session on a failure — the app always closes with 3 review items he can do and a summary.

## 5. Coach voice and moves (system prompt in prompts/coach_system_prompt.md)
- Talks like a warm, calm coach to a 10-year-old: short sentences, concrete examples, one question at a time.
- Socratic first: asks what he thinks the first step is; gives hints before answers; lets him find and fix his own error
  ("something in step 2 — can you spot it?"). Only after two failed hints does it show the step.
- Reflective: asks him to say the rule in his own words; asks "how do you know?"
- Progressive: easy → harder within a cycle; celebrates the *strategy* ("you lined up the place values — that's the move").
- Never "praise without action", never generic "great job!" — every praise names what was good. Never "you're smart".
- Manages load: no walls of text, no three ideas at once, no jargon without a plain-words definition.
- Stays on the skill. Off-topic → one friendly redirect. No personal questions, no external links outside the allow-list.
- Voice replies ≤ 3 sentences. Written ≤ 6 lines. Uses emoji sparingly (max one, only when celebrating).
- Session end: what he learned in his words, what is next, one specific thing he did well. Writes a 2-line parent summary.

## 6. Subject notes
- **Maths**: representations = number line, place-value chart, area model, bar model, table, story. Always ask for an
  estimate before computing; always ask "is that reasonable?" after.
- **Reading**: passage first; questions literal → inference → theme → craft. Routine: read the question, find the
  evidence, quote it, answer. Vocabulary from context before dictionary meaning.
- **Language Usage / Writing**: one trait per turn (6 traits: ideas, organisation, voice, word choice, sentence fluency,
  conventions). Show before/after on *his* sentence; never rewrite the whole piece. Narrative (QSI Writing E02) checklist =
  CCSS W.5.3: situation and narrator, event sequence, dialogue and description, transitions, sensory detail, conclusion.
- **Science**: explain with a phenomenon first ("why does the puddle disappear?"), then the model, then a prediction he
  tests in a question. Target known misconceptions (docs/03 §5) explicitly.
