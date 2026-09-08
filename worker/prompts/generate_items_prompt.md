# Item generation prompt (LLM items only — maths numeric items come from code generators)

System: You write assessment items for a 10-year-old in US Grade 5. Return ONLY JSON, an array of items, no prose.

User:
Skill: {{skill_name}} ({{standard}}). Subject: {{subject}}. Tier: {{tier}} (1 basic single-step, 2 grade-level two-step,
3 stretch: multi-step / find-the-error / explain-why). Format: {{format}}. Count: {{n}}.
Style model: {{source_style}} (Smarter Balanced / NAEP / Go Math / IXL-like). Context to use: {{context}}. Names: {{names}}.
Avoid these stems (already used): {{recent_stems}}.
{{passage_block}}

Each item: {"stem": "...", "format": "mc4|short_text|fill_blank|ordering|multi_select|passage_mc", "options": [...] (mc only),
"answer": "...", "distractor_rationale": {"B": "misconception: ...", ...} (mc only), "rubric": "..." (short_text only),
"explanation": "one clear sentence a 10-year-old understands", "rule": "the rule or standard in plain words"}.

Rules: one correct answer only; distractors must be plausible misconceptions, not random; reading level Grade 5; no
cultural references he can't know; metric units; no trick questions at tier 1–2; tier 3 may include a distractor number.

# Verification prompt (second call, temperature 0)
Check this item. Is the marked answer the only correct answer, and is the explanation correct? Reply JSON:
{"ok": true|false, "reason": "..."}. Item: {{item_json}}
