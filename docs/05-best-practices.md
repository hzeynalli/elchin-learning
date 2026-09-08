# 05 — What we borrow from the best systems (and from teachers)

| System | What it does well | What we take |
|---|---|---|
| **Math Academy** | Knowledge graph of prerequisites; adaptive diagnostic finds the "knowledge frontier"; spaced repetition with *implicit* credit (practising a harder skill counts as review of its prerequisites); slow-but-correct answers count as weaker evidence; "non-interference" (don't teach confusable topics back-to-back) | Prerequisite graph in `skills.prerequisites`; frontier-based "learn next"; implicit repetition credit (docs/06 §2); response time as evidence; interleaving rule that separates confusable skills |
| **ALEKS** | Knowledge Space Theory; periodic *knowledge checks* re-test mastered topics blind, and drop them if forgotten | Monthly blind Knowledge Check of 8–10 Mastered skills; regression rule |
| **Khan Academy / Khanmigo** | MAP-linked skill ladders; mastery levels (Familiar → Proficient → Mastered); Socratic tutor that never gives the answer | Status ladder; coach behaviour; link-outs for extra practice |
| **IXL** | Skill-level adaptive diagnostic; SmartScore that demands consistency at the end | Confirmation set must be clean; "Secure" needs consistency, not one lucky run |
| **Anki (FSRS) / Duolingo (HLR)** | Model each item's memory with stability and retrievability; schedule the review just before recall drops below the target (90%) | FSRS-lite per skill (docs/06 §2) instead of fixed intervals |
| **Third Space Learning (Skye)** | Human experts pre-script where a topic goes wrong and give the AI tutor scaffolds for each | `data/explanations/` per priority-1 skill with anticipated errors and scaffolds |
| **Beast Academy / Prodigy** | Engagement for 8–11-year-olds: variety, short wins, narrative | Points, variety of contexts, short sessions; no gamification that hides the maths |
| **Teachers (Rosenshine, mastery classrooms)** | Daily "do now" retrieval starter; weekly and monthly cumulative review; low-stakes quizzes; check for understanding before independent practice; high success rate (~80%) during practice | Today tab order; daily review; monthly Knowledge Check; practice tiers tuned so he succeeds ~80% of the time |

Teacher wisdom we encode as rules:
1. Never start a session cold — 3 retrieval questions first.
2. The student explains it back before he practises alone.
3. Success rate during practice should be high (≈80%); if he is failing half the items, the tier is wrong, not the child.
4. Mixed review beats blocked review for retention; blocked practice is only for the first day of a new skill.
5. Praise the strategy; correct the step; never the person.
6. End on a win.
