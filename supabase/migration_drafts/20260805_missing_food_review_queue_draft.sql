-- Missing Food Review queue draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - persist admin review state for not-found food queries where no safe alias apply exists
-- - keep missing canonical food review separate from Admin-approved Alias Apply
-- - support classification of search quality events without creating foods or aliases
--
-- Safety:
-- - creates a review queue table only
-- - does not insert/update/delete public.foods
-- - does not insert/update/delete public.food_aliases
-- - defines no trigger/function that creates foods
-- - defines no trigger/function that creates aliases
-- - does not backfill diary/favorites/recipes
-- - does not recompute nutrition snapshots

begin;

create table if not exists public.food_missing_review_queue (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null,
  context text,
  frequency integer not null default 1,
  classification text not null,
  status text not null default 'pending',
  source_event_ids uuid[] not null default '{}',
  suggested_name text,
  suggested_category text,
  suggested_source text,
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_missing_review_queue_context_check
    check (context is null or context in ('diary', 'recipe', 'favorites', 'barcode', 'admin', 'other')),
  constraint food_missing_review_queue_classification_check
    check (classification in ('alias_candidate', 'missing_canonical_food', 'ambiguous_broad_query', 'typo_or_prefix')),
  constraint food_missing_review_queue_status_check
    check (status in ('pending', 'needs_research', 'approved_for_food_draft', 'rejected', 'snoozed')),
  constraint food_missing_review_queue_frequency_check
    check (frequency > 0),
  constraint food_missing_review_queue_query_not_blank_check
    check (length(trim(query)) > 0),
  constraint food_missing_review_queue_normalized_query_not_blank_check
    check (length(trim(normalized_query)) > 0),
  constraint food_missing_review_queue_suggested_name_not_blank_check
    check (suggested_name is null or length(trim(suggested_name)) > 0),
  constraint food_missing_review_queue_suggested_category_not_blank_check
    check (suggested_category is null or length(trim(suggested_category)) > 0),
  constraint food_missing_review_queue_suggested_source_check
    check (suggested_source is null or suggested_source in ('core', 'brand', 'barcode', 'open_food_facts', 'other')),
  constraint food_missing_review_queue_review_state_check
    check (
      (status = 'pending' and reviewer_id is null and reviewed_at is null)
      or (status in ('needs_research', 'approved_for_food_draft', 'rejected', 'snoozed') and reviewer_id is not null and reviewed_at is not null)
    ),
  constraint food_missing_review_queue_food_draft_shape_check
    check (
      status <> 'approved_for_food_draft'
      or (
        classification = 'missing_canonical_food'
        and suggested_name is not null
        and length(trim(suggested_name)) > 0
        and coalesce(array_length(source_event_ids, 1), 0) > 0
      )
    )
);

comment on table public.food_missing_review_queue is
  'Admin-only review queue for not-found food queries that may need missing-food, disambiguation, or noise decisions. Does not create foods or aliases automatically.';
comment on column public.food_missing_review_queue.classification is
  'Runtime/admin classification: alias_candidate, missing_canonical_food, ambiguous_broad_query, or typo_or_prefix.';
comment on column public.food_missing_review_queue.status is
  'Manual review state. approved_for_food_draft records intent only and does not insert into foods.';
comment on column public.food_missing_review_queue.source_event_ids is
  'Search analytics event ids used as review evidence. Array is informational; no automatic food or alias writes are triggered.';
comment on column public.food_missing_review_queue.suggested_source is
  'Draft source/provenance hint only. It is not written to foods by this migration.';

create index if not exists food_missing_review_queue_status_created_at_idx
  on public.food_missing_review_queue (status, created_at desc);

create index if not exists food_missing_review_queue_normalized_query_idx
  on public.food_missing_review_queue (normalized_query);

create index if not exists food_missing_review_queue_classification_status_idx
  on public.food_missing_review_queue (classification, status, updated_at desc);

create index if not exists food_missing_review_queue_frequency_idx
  on public.food_missing_review_queue (frequency desc);

create index if not exists food_missing_review_queue_context_idx
  on public.food_missing_review_queue (context)
  where context is not null;

create index if not exists food_missing_review_queue_source_event_ids_idx
  on public.food_missing_review_queue using gin (source_event_ids);

create unique index if not exists food_missing_review_queue_pending_unique_idx
  on public.food_missing_review_queue (
    normalized_query,
    coalesce(context, ''),
    classification
  )
  where status = 'pending';

create or replace function public.update_food_missing_review_queue_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_food_missing_review_queue_updated_at
  on public.food_missing_review_queue;

create trigger update_food_missing_review_queue_updated_at
  before update on public.food_missing_review_queue
  for each row
  execute function public.update_food_missing_review_queue_updated_at();

alter table public.food_missing_review_queue enable row level security;

drop policy if exists food_missing_review_queue_admin_all on public.food_missing_review_queue;
create policy food_missing_review_queue_admin_all
  on public.food_missing_review_queue
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
-- public.foods or public.food_aliases from food_missing_review_queue.
-- A future food creation workflow must be separately drafted, reviewed, and
-- owner-approved before any production food rows are inserted.

-- Suggested post-apply validation, if this draft is later approved:
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name = 'food_missing_review_queue';
--
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_missing_review_queue'
--   and column_name in (
--     'query',
--     'normalized_query',
--     'context',
--     'frequency',
--     'classification',
--     'status',
--     'source_event_ids',
--     'suggested_name',
--     'suggested_category',
--     'suggested_source',
--     'reviewer_id',
--     'reviewed_at',
--     'comment',
--     'metadata',
--     'created_at',
--     'updated_at'
--   )
-- order by column_name;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'food_missing_review_queue'
-- order by policyname;
--
-- select count(*) from public.food_missing_review_queue;
-- Expected: 0 immediately after apply.
--
-- select count(*) from public.foods;
-- select count(*) from public.food_aliases;
-- Expected: unchanged from pre-apply counts.

commit;
