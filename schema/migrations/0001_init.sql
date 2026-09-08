-- Elchin Learning — migration 0001 (Phase 1). Source: schema/supabase_schema.sql (package v1.4) plus the additions
-- listed at the end. Apply with the Supabase MCP `apply_migration` or the SQL editor.

create extension if not exists pgcrypto;

create type role_t as enum ('student','parent');
create type status_t as enum ('not_yet','emerging','secure','mastered');
create type test_kind_t as enum ('diagnostic','targeted','review','practice10','confirm5','daily_review','manual','knowledge_check','map_mock');
create type loop_state_t as enum ('EXPLAIN','PRACTICE_10','CONFIRM_5','SECURE');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role role_t not null,
  display_name text not null,
  student_id uuid,                       -- for parent rows: the student they supervise
  map_rit_math int, map_rit_reading int, map_rit_language int, map_rit_science int,
  settings jsonb not null default '{"daily_minutes":50,"voice":true,"pass_rate":0.9,"regress_rate":0.7,"tier3_slip_replacement":true,"russian_fallback":true}'
);

create table skills (
  id text primary key,
  subject text not null,
  strand text not null,
  qsi_unit text,
  standard text,
  name text not null,
  grade int not null,
  prerequisites text[] not null default '{}',
  priority int not null default 2,
  active boolean not null default true,
  -- additions (v1.4 build):
  aliases text[] not null default '{}',  -- QSI paper-diagnostic labels (E02.5, G4.4 …) → data/qsi_crosswalk.json
  planned_month text,                    -- from data/scope_sequence.json; drives learn-ahead (docs/06 §1)
  fluency boolean not null default false,-- needs the `fast` flag (docs/02 §3)
  map_area text                          -- MAP instructional area label for the parent view
);

create table skill_state (
  student_id uuid references profiles(id) on delete cascade,
  skill_id text references skills(id) on delete cascade,
  status status_t not null default 'not_yet',
  last_rate numeric, clean_streak int not null default 0,
  loop_state loop_state_t, cycle_number int not null default 0, representation_used text[] not null default '{}',
  review_stage int not null default 0, next_review_at timestamptz,
  attempts int not null default 0, items_seen int not null default 0, time_spent_s int not null default 0,
  fast boolean, error_notes text,
  stability numeric, difficulty numeric default 5, last_review_at timestamptz, planned_month text,
  reviews_passed int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table tests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  subject text not null,
  kind test_kind_t not null,
  skill_id text references skills(id),   -- for practice10 / confirm5
  loop_id uuid,                          -- coach_sessions.id the practice/confirm set belongs to
  status text not null default 'open',   -- open | sitting_complete | complete
  plan jsonb,                            -- adaptive plan (skills, counts, cursor)
  started_at timestamptz, submitted_at timestamptz, duration_s int,
  score numeric, per_skill jsonb,
  created_at timestamptz not null default now()
);

create table test_items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  skill_id text references skills(id),
  position int not null,
  tier int not null,
  format text not null,
  item jsonb not null,                   -- stem, options, answer, rubric, explanation, generated_by, verification
  stem_hash text not null,
  answer_given text, correct boolean, partial numeric, retry_used boolean default false,
  marked_by text,                        -- rule | llm | parent
  confidence numeric, feedback text,
  time_s int,
  answered_at timestamptz
);
create index on test_items (student_id, skill_id, answered_at desc);
create index on test_items (skill_id, stem_hash);
create index on test_items (test_id, position);

create table coach_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  skill_id text references skills(id),
  started_at timestamptz not null default now(), ended_at timestamptz,
  loop_state loop_state_t not null default 'EXPLAIN', cycle_number int not null default 1,
  representation text,
  messages jsonb not null default '[]',  -- [{role, content, ts, voice}]
  practice_test_id uuid, confirm_test_id uuid,
  outcome text,                          -- secure | in_progress | break | flagged
  parent_summary text, flag_note text,
  off_topic_hits int not null default 0, active_s int not null default 0
);

create table item_bank (
  id uuid primary key default gen_random_uuid(),
  skill_id text references skills(id) on delete cascade,
  tier int not null, format text not null,
  item jsonb not null, stem_hash text not null,
  verified boolean not null default false, used boolean not null default false,
  created_at timestamptz not null default now()
);
create index on item_bank (skill_id, tier, used, verified);

create table points (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  delta int not null, reason text not null, at timestamptz not null default now()
);
create table rewards (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  name text not null, cost int not null, redeemed_at timestamptz
);

create table telemetry (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  session_id uuid, kind text not null,          -- visible | hidden | idle | active | answer | coach_turn
  at timestamptz not null default now(), payload jsonb
);
create index on telemetry (student_id, at desc);

create table map_results (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  term text not null, subject text not null, rit int not null, area_scores jsonb, tested_at date
);

create table passages (
  id uuid primary key default gen_random_uuid(),
  title text, author text, origin text not null,   -- public_domain | llm | link
  url text, text text, word_count int, fk_grade numeric, lexile_est int,
  genre text, topic text, used_count int not null default 0,
  questions jsonb                                   -- optional pre-written question set (docs/03 §4)
);

create table events (
  id bigserial primary key,
  student_id uuid, kind text not null, payload jsonb, at timestamptz not null default now()
);

-- additions (v1.4 build)
create table explanations (               -- data/explanations/*.md, one canonical explanation per priority-1 skill
  skill_id text primary key references skills(id) on delete cascade,
  body text not null, updated_at timestamptz not null default now()
);
create table llm_usage (                  -- daily cost cap (GAPS.md): Worker falls back to practice-only when exceeded
  id bigserial primary key,
  day date not null, model text not null, purpose text,
  input_tokens int not null default 0, output_tokens int not null default 0, usd numeric not null default 0,
  at timestamptz not null default now()
);
create index on llm_usage (day);

-- RLS. Student sees own rows; parent sees rows of their student. The Worker uses the service key and bypasses RLS.
-- NB: a policy on profiles must not sub-select profiles (infinite recursion) → security-definer helper.
create or replace function public.supervised_student() returns uuid
language sql security definer stable set search_path = public as
$$ select student_id from public.profiles where id = auth.uid() and role = 'parent' $$;

alter table profiles enable row level security;
alter table skills enable row level security;
alter table skill_state enable row level security;
alter table tests enable row level security;
alter table test_items enable row level security;
alter table coach_sessions enable row level security;
alter table item_bank enable row level security;
alter table points enable row level security;
alter table rewards enable row level security;
alter table telemetry enable row level security;
alter table map_results enable row level security;
alter table passages enable row level security;
alter table events enable row level security;
alter table explanations enable row level security;
alter table llm_usage enable row level security;

create policy "skills readable" on skills for select using (auth.role() = 'authenticated');
create policy "passages readable" on passages for select using (auth.role() = 'authenticated');
create policy "explanations readable" on explanations for select using (auth.role() = 'authenticated');
create policy "own profile or supervised" on profiles for select using (id = auth.uid() or id = supervised_student());
create policy "own or supervised" on skill_state    for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on tests          for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on test_items     for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on coach_sessions for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on points         for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on rewards        for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on telemetry      for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on map_results    for select using (student_id = auth.uid() or student_id = supervised_student());
create policy "own or supervised" on events         for select using (student_id = auth.uid() or student_id = supervised_student());
-- item_bank and llm_usage: no client policies → invisible to the browser. All writes go through the Worker.
