# 03 — Question-writing guidelines and verification

## 1. Tiers (every item has one)
- **Tier 1** — single step, direct recall or procedure. ("What is 6 × 7?", "Find the main idea in this paragraph.")
- **Tier 2** — expected Grade-5 mastery: 2 steps, standard format, mirrors Go Math / CCSS item style. This is the
  MAP-typical difficulty for his grade.
- **Tier 3** — A-level / MAP-stretch: multi-step, word problem with a distractor, "find and fix the error", "explain why",
  compare two methods, or the next grade's entry skill.

## 2. Item formats supported by the app
`numeric` (exact or tolerance), `mc4` (4 options, one correct, distractors = known misconceptions), `multi_select`,
`short_text` (rubric-marked), `ordering`, `fill_blank`, `passage_mc` (passage + questions), `writing` (rubric,
parent-marked, coach feedback). Every item JSON carries: `skill_id, tier, format, stem, answer, rubric?, distractor_rationale?,
explanation, source_style ("SBAC"|"NAEP"|"GoMath"|"IXL-like"|"CommonLit-like"), generated_by ("template"|"llm")`.

## 3. Mathematics — template generators (mandatory)
Every maths skill in data/ gets a generator in `worker/generators/math/<skill_id>.js` that returns `{stem, answer, tier,
working}` from a random seed, with the answer **computed in code**. Rules:
- Parameter ranges per tier, e.g. `E02.5` tier 1: 2-digit × 1-digit; tier 2: 3–4-digit × 2-digit; tier 3: word problem
  with an irrelevant number and a "how much more" final step.
- Word-problem wording: the generator produces a skeleton `{numbers, operation graph, answer}` and the LLM writes the
  story around it, then a second LLM call solves the story cold; the item ships only if the cold solve equals the coded
  answer. Otherwise regenerate. Store the pass in `verification.jsonb`.
- Distractors for `mc4`: compute them from named misconceptions (dropped regrouping, wrong order of operations, added
  denominators, moved decimal the wrong way). Never random.
- Unit tests: each generator gets ≥ 20 seeded cases in `worker/generators/__tests__` asserting the answer with an
  independent computation.
- Fluency items (times tables) are timed client-side; item carries `time_limit_s`.

## 4. Reading — passages and items
- Passage bank `data/passages/` and table `passages`. Sources, in order of preference: (1) public-domain texts (Project
  Gutenberg, Aesop, folktales, historical documents) cut to 250–500 words; (2) LLM-written original passages on
  age-appropriate topics, **flagged** `origin: "llm"`, and (3) links out to CommonLit / ReadWorks for him to read on
  their site (we do not copy their text).
- Readability check in code on every passage: Flesch–Kincaid grade 4.5–6.5 and mean sentence length 11–17 words for
  Grade-5 level; tier 3 may go to FK 7.0. Reject otherwise.
- Question set per passage: 5–6 items, at least one each of: literal detail with evidence (RL/RI.5.1), main idea or
  theme (RL/RI.5.2), vocabulary in context (L.5.4a), craft/structure or point of view (RL.5.4–6 / RI.5.5–6), and one
  short-text "quote the sentence that shows…" (SBAC/NAEP style).
- Style models: Smarter Balanced Grade 5 ELA sample items and NAEP Grade 4 reading released items (docs/04).

## 5. Science — items
- Anchor every item to an NGSS Grade 4/5 performance expectation (data/skills_science.json). Format mostly `mc4` and
  `short_text` "explain what will happen and why". Distractors from documented misconceptions, e.g.: plants get their
  mass from soil; heavier objects fall faster; the sun moves around the Earth; matter disappears when it dissolves/evaporates;
  seasons are caused by distance from the sun; energy is "used up".
- Include data-reading items (a small table or described graph) — MAP Science tests practices, not only facts.

## 6. Language Usage — items
- Each item states the **rule** in the explanation and carries the CCSS code (L.5.1a–e, L.5.2a–e, L.5.3, W.5.x).
- Formats: `mc4` "which sentence is correct", `fill_blank` (verb tense, conjunction), `ordering` (sentences into a
  paragraph), `short_text` (combine two sentences; add a comma; fix capitalisation), `writing` (short paragraph tasks with
  the W.5.3 checklist as rubric).
- Every LLM-generated LU item passes a second-call check: "Is the marked answer the only correct option? Reply JSON."
  Ship only on `true`.

## 7. Marking
- `numeric`, `mc4`, `multi_select`, `ordering`, `fill_blank`: rule-based in code (normalise spaces, commas, case, fraction
  forms, trailing zeros).
- `short_text`: LLM against the item rubric → `{correct, confidence, feedback}`. Confidence < 0.8 → parent queue; the
  skill state uses the parent's decision when it arrives and the LLM's provisional one meanwhile (flagged in UI).
- `writing`: LLM marks against the W.5.3 / 6-traits rubric with confidence; coach gives trait feedback immediately;
  parent reviews confidence < 0.8 and a monthly sample of pieces.

## 8. Dedupe and variety
Keep a per-skill history of stems (hash of normalised stem + numbers). Reject exact or near duplicates (Jaccard > 0.8 on
tokens) against the last 300 items. Rotate contexts (money, distance, recipes, sport, animals, school, Baku places) and
names (varied, including Azerbaijani names).
