-- 10 Sep 2026: boss rounds. A wrong answer in a quest summons a 5-question boss on that skill; the big boss mixes every
-- boss skill of the quest. Both are ordinary tests (kind boss / big_boss) so marking, mastery and points stay unchanged.
alter type test_kind_t add value if not exists 'boss';
alter type test_kind_t add value if not exists 'big_boss';
