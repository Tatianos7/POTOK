-- Search Analytics / Admin Review draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - collect non-blocking food search analytics
-- - support an admin manual review queue for alias suggestions
-- - preserve manual-review-only rules:
--   * no automatic alias insertion
--   * no automatic food creation
--   * no silent canonical choice for ambiguous queries
--   * admin approval is required before any alias/catalog mutation
--
-- Safety:
-- - creates analytics/review tables only
-- - does not insert/update/delete foods
-- - does not insert/update/delete food_aliases
-- - does not backfill diary/favorites/recipes
-- - does not recompute nutrition snapshots

begin;

create table if not exists public.food_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_id_hash text,
  query text not null,
  normalized_query text not null,
  context text not null,
  event_type text not null,
  result_count integer not null default 0,
  selected_canonical_food_id uuid references public.foods (id) on delete set null,
  no_selection boolean not null default false,
  not_found boolean not null default false,
  ambiguous boolean not null default false,
  candidate_canonical_food_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint food_search_events_context_check
    check (context in ('diary', 'recipe', 'favorites', 'barcode', 'admin', 'other')),
  constraint food_search_events_event_type_check
    check (event_type in ('query', 'selection', 'no_selection', 'not_found', 'ambiguous')),
  constraint food_search_events_result_count_check
    check (result_count >= 0),
  constraint food_search_events_query_not_blank_check
    check (length(trim(query)) > 0),
  constraint food_search_events_normalized_query_not_blank_check
    check (length(trim(normalized_query)) > 0),
  constraint food_search_events_selection_consistency_check
    check (
      (
        event_type = 'query'
        and selected_canonical_food_id is null
        and no_selection = false
        and not_found = false
        and ambiguous = false
      )
      or (
        event_type = 'selection'
        and selected_canonical_food_id is not null
        and no_selection = false
        and not_found = false
        and ambiguous = false
      )
      or (
        event_type = 'no_selection'
        and selected_canonical_food_id is null
        and no_selection = true
        and not_found = false
        and ambiguous = false
      )
      or (
        event_type = 'not_found'
        and selected_canonical_food_id is null
        and no_selection = false
        and not_found = true
        and ambiguous = false
        and result_count = 0
      )
      or (
        event_type = 'ambiguous'
        and selected_canonical_food_id is null
        and no_selection = false
        and not_found = false
        and ambiguous = true
      )
    )
);

comment on table public.food_search_events is
  'Food search analytics events. Analytics only: never creates aliases, foods, diary rows, favorites, recipes, or canonical mappings.';
comment on column public.food_search_events.normalized_query is
  'Runtime-normalized query text. Should match normalize_food_text semantics.';
comment on column public.food_search_events.selected_canonical_food_id is
  'UUID foods.id selected by the user. Null for query/no_selection/not_found/ambiguous events.';
comment on column public.food_search_events.candidate_canonical_food_ids is
  'Optional candidate foods.id values shown for ambiguous/admin review diagnostics. Does not imply approval.';

create index if not exists food_search_events_created_at_idx
  on public.food_search_events (created_at desc);

create index if not exists food_search_events_user_created_at_idx
  on public.food_search_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists food_search_events_normalized_query_idx
  on public.food_search_events (normalized_query);

create index if not exists food_search_events_context_type_created_at_idx
  on public.food_search_events (context, event_type, created_at desc);

create index if not exists food_search_events_not_found_idx
  on public.food_search_events (normalized_query, created_at desc)
  where not_found = true;

create index if not exists food_search_events_ambiguous_idx
  on public.food_search_events (normalized_query, created_at desc)
  where ambiguous = true;

create index if not exists food_search_events_selected_canonical_food_id_idx
  on public.food_search_events (selected_canonical_food_id)
  where selected_canonical_food_id is not null;

alter table public.food_search_events enable row level security;

drop policy if exists food_search_events_insert_own on public.food_search_events;
create policy food_search_events_insert_own
  on public.food_search_events
  for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists food_search_events_select_own on public.food_search_events;
create policy food_search_events_select_own
  on public.food_search_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists food_search_events_admin_all on public.food_search_events;
create policy food_search_events_admin_all
  on public.food_search_events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  );

create table if not exists public.food_search_review_queue (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null,
  context text,
  suggested_canonical_food_id uuid references public.foods (id) on delete set null,
  frequency integer not null default 1,
  status text not null default 'pending',
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  comment text,
  source_event_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_search_review_queue_context_check
    check (context is null or context in ('diary', 'recipe', 'favorites', 'barcode', 'admin', 'other')),
  constraint food_search_review_queue_status_check
    check (status in ('pending', 'approved', 'rejected', 'snoozed')),
  constraint food_search_review_queue_frequency_check
    check (frequency > 0),
  constraint food_search_review_queue_query_not_blank_check
    check (length(trim(query)) > 0),
  constraint food_search_review_queue_normalized_query_not_blank_check
    check (length(trim(normalized_query)) > 0),
  constraint food_search_review_queue_review_state_check
    check (
      (status = 'pending' and reviewer_id is null and reviewed_at is null)
      or (status in ('approved', 'rejected', 'snoozed') and reviewer_id is not null and reviewed_at is not null)
    ),
  constraint food_search_review_queue_approval_target_check
    check (status <> 'approved' or suggested_canonical_food_id is not null)
);

comment on table public.food_search_review_queue is
  'Admin-only manual review queue for query-to-canonical suggestions. Approval records intent only; it does not create aliases automatically.';
comment on column public.food_search_review_queue.suggested_canonical_food_id is
  'Candidate foods.id for admin review. Not used as canonical mapping until a separate approved alias/apply step.';
comment on column public.food_search_review_queue.status is
  'Manual review status. approved does not automatically insert into food_aliases.';

create index if not exists food_search_review_queue_status_created_at_idx
  on public.food_search_review_queue (status, created_at desc);

create index if not exists food_search_review_queue_normalized_query_idx
  on public.food_search_review_queue (normalized_query);

create index if not exists food_search_review_queue_frequency_idx
  on public.food_search_review_queue (frequency desc);

create index if not exists food_search_review_queue_suggested_canonical_food_id_idx
  on public.food_search_review_queue (suggested_canonical_food_id)
  where suggested_canonical_food_id is not null;

create unique index if not exists food_search_review_queue_pending_unique_idx
  on public.food_search_review_queue (
    normalized_query,
    coalesce(context, ''),
    coalesce(suggested_canonical_food_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending';

create or replace function public.update_food_search_review_queue_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_food_search_review_queue_updated_at
  on public.food_search_review_queue;

create trigger update_food_search_review_queue_updated_at
  before update on public.food_search_review_queue
  for each row
  execute function public.update_food_search_review_queue_updated_at();

alter table public.food_search_review_queue enable row level security;

drop policy if exists food_search_review_queue_admin_all on public.food_search_review_queue;
create policy food_search_review_queue_admin_all
  on public.food_search_review_queue
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  );

-- Explicit anti-automation guard:
-- This draft intentionally defines no trigger/function/policy that writes to
-- public.food_aliases or public.foods from food_search_review_queue.
-- A future approved-alias apply step must be separately reviewed and approved.

-- Suggested post-apply validation, if this draft is later approved:
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('food_search_events', 'food_search_review_queue')
-- order by table_name;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('food_search_events', 'food_search_review_queue')
-- order by tablename, policyname;
--
-- select count(*) from public.foods;
-- select count(*) from public.food_aliases;
-- Expected: unchanged from pre-apply counts.

commit;
