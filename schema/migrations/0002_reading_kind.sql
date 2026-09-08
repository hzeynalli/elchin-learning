-- 0002: passage-based reading sets are their own test kind (docs/02 §4 step 3); ordinary qualifying evidence for mastery.
alter type test_kind_t add value if not exists 'reading';
-- bank stock helper for the cron (counts per skill/tier below a minimum)
create or replace function public.bank_low_stock(min_count int default 10)
returns table (skill_id text, tier int, stock bigint) language sql stable security definer set search_path = public as $$
  select s.id, t.tier, count(b.id) as stock
  from skills s cross join (values (1),(2),(3)) as t(tier)
  left join item_bank b on b.skill_id = s.id and b.tier = t.tier and b.used = false and b.verified = true
  where s.subject <> 'Mathematics' and s.active
  group by s.id, t.tier having count(b.id) < min_count order by s.id, t.tier
$$;
