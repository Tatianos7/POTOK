-- Missing Food Drafts draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - prepare complete draft-only food candidates from approved Missing Food Review rows
-- - keep draft preparation separate from production food creation
-- - preserve nutrition/provenance/reviewer notes before any owner-approved apply
--
-- Safety:
-- - creates a draft table only
-- - does not insert/update/delete public.foods
-- - does not insert/update/delete public.food_aliases
-- - defines no trigger/function that creates foods
-- - defines no trigger/function that creates aliases
-- - does not call Alias Apply RPC
-- - does not backfill diary/favorites/recipes
-- - does not recompute nutrition snapshots

begin;

create table if not exists public.food_missing_food_drafts (
  id uuid primary key default gen_random_uuid(),
  source_review_id uuid not null references public.food_missing_review_queue (id) on delete restrict,
  query text not null,
  normalized_query text not null,
  name text,
  normalized_name text,
  category text,
  source text not null default 'core',
  brand text,
  barcode text,
  calories numeric(8,2),
  protein numeric(8,2),
  fat numeric(8,2),
  carbs numeric(8,2),
  fiber numeric(8,2),
  unit text not null default 'g',
  data_source text,
  source_url text,
  source_notes text,
  reviewer_notes text,
  status text not null default 'draft',
  prepared_by uuid references auth.users (id) on delete set null,
  prepared_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  applied_food_id uuid references public.foods (id) on delete set null,
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_missing_food_drafts_status_check
    check (status in ('draft', 'needs_revision', 'ready_for_owner_apply', 'rejected', 'applied')),
  constraint food_missing_food_drafts_query_not_blank_check
    check (length(trim(query)) > 0),
  constraint food_missing_food_drafts_normalized_query_not_blank_check
    check (length(trim(normalized_query)) > 0),
  constraint food_missing_food_drafts_name_not_blank_check
    check (name is null or length(trim(name)) > 0),
  constraint food_missing_food_drafts_normalized_name_not_blank_check
    check (normalized_name is null or length(trim(normalized_name)) > 0),
  constraint food_missing_food_drafts_normalized_name_matches_check
    check (normalized_name is null or name is null or normalized_name = public.normalize_food_text(name)),
  constraint food_missing_food_drafts_category_not_blank_check
    check (category is null or length(trim(category)) > 0),
  constraint food_missing_food_drafts_source_check
    check (source = 'core'),
  constraint food_missing_food_drafts_brand_inactive_check
    check (brand is null),
  constraint food_missing_food_drafts_barcode_inactive_check
    check (barcode is null),
  constraint food_missing_food_drafts_unit_check
    check (unit = 'g'),
  constraint food_missing_food_drafts_data_source_not_blank_check
    check (data_source is null or length(trim(data_source)) > 0),
  constraint food_missing_food_drafts_source_url_not_blank_check
    check (source_url is null or length(trim(source_url)) > 0),
  constraint food_missing_food_drafts_source_notes_not_blank_check
    check (source_notes is null or length(trim(source_notes)) > 0),
  constraint food_missing_food_drafts_reviewer_notes_not_blank_check
    check (reviewer_notes is null or length(trim(reviewer_notes)) > 0),
  constraint food_missing_food_drafts_calories_check
    check (calories is null or (calories >= 0 and calories <= 1000)),
  constraint food_missing_food_drafts_protein_check
    check (protein is null or (protein >= 0 and protein <= 100)),
  constraint food_missing_food_drafts_fat_check
    check (fat is null or (fat >= 0 and fat <= 100)),
  constraint food_missing_food_drafts_carbs_check
    check (carbs is null or (carbs >= 0 and carbs <= 100)),
  constraint food_missing_food_drafts_fiber_check
    check (fiber is null or (fiber >= 0 and fiber <= 100)),
  constraint food_missing_food_drafts_ready_shape_check
    check (
      status not in ('ready_for_owner_apply', 'applied')
      or (
        name is not null
        and normalized_name is not null
        and category is not null
        and source = 'core'
        and unit = 'g'
        and calories is not null
        and protein is not null
        and fat is not null
        and carbs is not null
        and data_source is not null
        and length(trim(name)) > 0
        and length(trim(normalized_name)) > 0
        and length(trim(category)) > 0
        and length(trim(data_source)) > 0
        and prepared_by is not null
        and prepared_at is not null
        and reviewed_by is not null
        and reviewed_at is not null
      )
    ),
  constraint food_missing_food_drafts_applied_shape_check
    check (
      status <> 'applied'
      or (
        applied_food_id is not null
        and applied_by is not null
        and applied_at is not null
      )
    ),
  constraint food_missing_food_drafts_non_applied_shape_check
    check (
      status = 'applied'
      or (
        applied_food_id is null
        and applied_by is null
        and applied_at is null
      )
    )
);

comment on table public.food_missing_food_drafts is
  'Admin-only draft preparation table for future missing-food candidates. Does not create foods or aliases automatically.';
comment on column public.food_missing_food_drafts.source_review_id is
  'Approved Missing Food Review queue row used as the source for this draft.';
comment on column public.food_missing_food_drafts.status is
  'Draft preparation state. ready_for_owner_apply is intent only; it does not insert into foods.';
comment on column public.food_missing_food_drafts.fiber is
  'Nullable fiber per 100 g. NULL means unknown/unprovided; 0 means confirmed zero.';
comment on column public.food_missing_food_drafts.applied_food_id is
  'Optional future tracking field populated only after a separate owner-approved food creation step.';

create index if not exists food_missing_food_drafts_source_review_id_idx
  on public.food_missing_food_drafts (source_review_id);

create index if not exists food_missing_food_drafts_status_updated_at_idx
  on public.food_missing_food_drafts (status, updated_at desc);

create index if not exists food_missing_food_drafts_normalized_name_idx
  on public.food_missing_food_drafts (normalized_name)
  where normalized_name is not null;

create index if not exists food_missing_food_drafts_source_idx
  on public.food_missing_food_drafts (source);

create index if not exists food_missing_food_drafts_applied_food_id_idx
  on public.food_missing_food_drafts (applied_food_id)
  where applied_food_id is not null;

create or replace function public.update_food_missing_food_drafts_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_food_missing_food_drafts_updated_at
  on public.food_missing_food_drafts;

create trigger update_food_missing_food_drafts_updated_at
  before update on public.food_missing_food_drafts
  for each row
  execute function public.update_food_missing_food_drafts_updated_at();

alter table public.food_missing_food_drafts enable row level security;

drop policy if exists food_missing_food_drafts_admin_all on public.food_missing_food_drafts;
create policy food_missing_food_drafts_admin_all
  on public.food_missing_food_drafts
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
-- public.foods or public.food_aliases from food_missing_food_drafts.
-- A future food creation workflow must be separately drafted, reviewed, and
-- owner-approved before any production food rows are inserted.

-- Suggested post-apply validation, if this draft is later approved:
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name = 'food_missing_food_drafts';
--
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_missing_food_drafts'
--   and column_name in (
--     'source_review_id',
--     'query',
--     'normalized_query',
--     'name',
--     'normalized_name',
--     'category',
--     'source',
--     'brand',
--     'barcode',
--     'calories',
--     'protein',
--     'fat',
--     'carbs',
--     'fiber',
--     'unit',
--     'data_source',
--     'source_url',
--     'source_notes',
--     'reviewer_notes',
--     'status',
--     'prepared_by',
--     'prepared_at',
--     'reviewed_by',
--     'reviewed_at',
--     'applied_food_id',
--     'applied_by',
--     'applied_at',
--     'metadata',
--     'created_at',
--     'updated_at'
--   )
-- order by column_name;
--
-- select policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'food_missing_food_drafts'
-- order by policyname;
--
-- select count(*) from public.food_missing_food_drafts;
-- Expected: 0 immediately after apply.
--
-- select count(*) from public.foods;
-- select count(*) from public.food_aliases;
-- Expected: unchanged from pre-apply counts.

commit;
