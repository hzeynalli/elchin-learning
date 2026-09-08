# 06 — The whole year: learning ahead and remembering in March what he learned in September

## 1. Scope and sequence (Sep 2026 → Jun 2027)
- The app carries the **full Grade-5 map** (data/) plus Grade-4 gaps. Priority shifts through the year:
  each skill has `planned_month` (from the QSI unit order as it becomes known; Go Math chapter order as the proxy until
  then). Rolling rule: priority 1 = current and next QSI unit; 2 = MAP strands and last month's units; 3 = later.
- **Learn-ahead mode**: 1–2 weeks before a new QSI unit is engaged, the Today tab pre-teaches its first two skills
  (frontier rule: only skills whose prerequisites are Secure). He arrives in class already knowing the vocabulary and the
  first procedure; the school then does the deepening. Cap: two skills of the next unit; the rest waits for engagement. The parent flips a unit to "engaged" when the portal shows it.
- **MAP checkpoints**: Oct (first), then the winter and spring windows. Two weeks before each: a MAP-style adaptive mock
  (mixed strands, MC-heavy, 40 items, untimed but timed for data) to find the weakest instructional area; the last two
  weeks focus there. MAP results (RIT per instructional area) are entered in the parent view and re-weight priorities.

## 2. Retention engine (replaces fixed intervals) — FSRS-lite per skill
Each Secure skill carries `stability` S (days), `difficulty` D (1–10), `last_review_at`. Retrievability
`R(t) = (1 + t / (9·S))^-1`. Review is due when R ≤ 0.90 (target retention). After a passed review:
`S_new = S · (1 + e^(0.6) · (11 − D) · S^(−0.2) · (e^(0.1·(1−R)) − 1))` capped to ≤ 3·S; D moves toward 5 slowly.
After a failed review: S = max(1, 0.3·S), D += 1, status → Emerging, back into the coach loop. First S after Secure = 2 days.
Practical result: reviews at roughly 2, 6, 15, 35, 80, 180 days for a typical skill — March coverage of September skills
is automatic, and stable skills stop consuming time.
- **Implicit repetition (Math Academy's idea)**: a correct answer on a skill gives 0.5 review credit to each direct
  prerequisite (a 2-digit × 2-digit item also reviews times tables). Only for maths and grammar mechanics.
- **Timing as evidence**: correct but > 2× the expected time = half credit; fluency skills need the `fast` flag.
- **Interference rule**: never schedule two confusable skills (area vs perimeter, mean vs median, its vs it's) in the
  same session until both are Secure.
- Daily review cap: 10 items, most overdue first; weekly cap on total reviews so new learning keeps ≥ 60% of the time.

## 3. Monthly Knowledge Check (ALEKS-style)
First school week of each month: a blind 20-item check over Mastered skills, no coach, no hints. Skills < 0.9 drop to
Emerging and re-enter the loop. Five of the 20 items are written in "school style" (Go Math / QSI rubric wording) to
check transfer to the classroom format. The parent report shows "retention rate" = share of Mastered skills that held.

## 4. Calendar (draft, to be aligned with the teacher's unit plan when received)
| Month | School (expected) | App focus |
|---|---|---|
| Sep | Math E01–E02, Reading E01–E02, Writing E01–E02, CS E01 | Scope-A diagnostic; priority-1 to Secure; daily review starts |
| Oct | Math E03 (multiply/divide), Reading E03, Writing E03; MAP fall | Learn-ahead E03; MAP mock early Oct; Scope-B diagnostic (MAP strands) |
| Nov | Math decimals; informational reading; opinion writing | First Knowledge Check; fill Grade-4 gaps found in Scope B |
| Dec | Fractions add/subtract | Learn-ahead fractions (needs G4.NF Secure); cumulative review before the break |
| Jan | Fractions multiply/divide; MAP winter | MAP mock; weakest-strand push |
| Feb–Mar | Measurement, volume, coordinate plane; research writing | Retention checks show Sep–Nov skills holding; science strands |
| Apr–May | Geometry, data; MAP spring | MAP mock; year review; Grade-6 entry skills for strong strands |
| Jun | Wrap-up | Full-year Knowledge Check; summer review schedule at lower cadence |
