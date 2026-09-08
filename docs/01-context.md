# 01 — Context

## Student
Elchin Zeynalli, 10, QSI International School of Baku. QSI names classes by age: the 10-year-old class is the US Grade 5
equivalent (5-year-old = Kindergarten). Instruction in English. Homeroom teacher for Math, Reading, Writing and Cultural
Studies: Maria Taljaard. Father (owner/operator of this app): Huseyn Zeynalli.

## QSI mastery system (facts that shape the app)
- Each course is split into Essential Units (E01, E02…). Each unit lists measurable outcomes written as "TSW …"
  ("The Student Will…"). Units take roughly 12–18 class periods.
- Grades are per unit, not per term: **A** (mastery with higher-order skills), **B** (mastery), **P** (in progress —
  "you're not done yet"). No C/D/F.
- Elementary maths units are keyed to Houghton Mifflin *Go Math!* chapters; Mathematics-10 ≈ Go Math Grade 5.
- The QSI unit sheets (TSW lists) are not on the public web and **will not be obtained**. Decision (owner, 8 Sep): teach
  the entire curriculum for his age — US Grade 5 (Common Core Math/ELA + NGSS Science) plus Grade-4 gaps — which is what
  QSI's Grade-5-equivalent units are built from. QSI unit names in data/ are labels for the parent dashboard only; the
  skill maps and `data/scope_sequence.json` are the source of truth for what is taught and when.

## Engaged units as of 8 Sep 2026 (all "P", normal three weeks in)
See data/qsi_engaged_units.json. Academic units that matter for 1 Oct:
Math E01 Mathematical Foundations, E02 Place Value & Expressions; Reading E01 Establish Myself as a Reader, E02 Short
Stories; Writing E01 Establish Myself as a Writer, E02 Narrative Fiction Drafting; Cultural Studies E01 Ancient World:
Research Part 1. Science not yet engaged.

## MAP Growth (NWEA)
- QSI administers MAP Growth in all its schools. Elchin's fall MAP is in October or later.
- Adaptive test; result is a RIT score per subject (Math, Reading, Language Usage, Science) plus instructional-area
  scores. There is no maximum; the target is growth versus the 2020 norms. Grade 5 fall median ≈ 205–211 Math,
  ≈ 205–209 Reading (norms tables in docs/04).
- NWEA's **Learning Continuum** lists the exact skills per 10-point RIT band, but only the school can print it.
  Requested from the school together with the MAP Family Report (last spring's scores). When they arrive: set
  `students.map_rit_*` and re-weight `priority` in the skill maps to the two RIT bands around his score.
- MAP items are built to Common Core (Math, Reading, Language Usage) and NGSS-style standards (Science). That is why the
  MAP layer of each skill map uses CCSS / NGSS codes.

## Timeline
- 8 Sep: Math Diagnostic 1 on paper (Elchin_Math_Diagnostic_1.pdf). Its scorecard is entered by the parent as the first
  `tests` row of kind `diagnostic` (manual entry screen in Phase 2, or SQL insert).
- By 1 Oct: QSI E01/E02 skills Secure.
- Oct+: MAP-driven loop continues all year.

## Constraints
- 45–60 minutes a day, supervised by a parent or the family's educator most days; the app must work unsupervised too.
- Devices: iPad/laptop in Chrome (Web Speech API works best in Chrome).
- Mastery bar agreed with the parent: 90%+ on two consecutive checks, then spaced review (not 100%).
