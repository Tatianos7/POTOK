-- User-Created Food Catalog Candidates Draft
-- Date: 2026-09-06
-- Status: DRAFT ONLY. Do not apply without explicit owner approval, schema review,
-- admin role model confirmation, and RLS behavior tests.
-- Scope: candidate/review table for user-created private foods and future provider
-- import candidates. This draft does not create foods, aliases, diary entries,
-- Premium rows, provider clients, or production rollout behavior.
--
-- Safety:
-- - Draft SQL only.
-- - Do not run on staging or production as-is.
-- - No data backfill.
-- - No writes to public.foods.
-- - No writes to public.food_aliases.
-- - No diary snapshot recompute.
-- - No Premium write path changes.

begin;

create table if not exists public.food_catalog_candidates (
  id uuid primary key default gen_random_uuid(),

  source_type text not null default 'user_submission',
  source_user_food_id uuid null references public.foods(id) on delete set null,
  created_by_user_id uuid null,

  proposed_name text not null,
  proposed_brand text null,
  normalized_name text null,
  normalized_brand text null,

  calories numeric not null,
  protein numeric not null,
  fat numeric not null,
  carbs numeric not null,
  fiber numeric null,
  barcode text null,

  review_status text not null default 'pending',
  review_reason text null,
  duplicate_of_food_id uuid null references public.foods(id) on delete set null,
  promoted_to_canonical_food_id uuid null references public.foods(id) on delete set null,
  rejected_reason text null,
  admin_notes text null,

  language_score numeric null,
  quality_score numeric null,
  nutrition_score numeric null,
  duplicate_score numeric null,
  barcode_conflict_status text null,
  ru_display_name text null,

  source_provider text null,
  source_provider_product_id text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null,

  constraint food_catalog_candidates_source_type_check
    check (source_type in ('user_submission', 'open_food_facts', 'provider_import')),

  constraint food_catalog_candidates_review_status_check
    check (review_status in ('pending', 'needs_review', 'approved', 'merged', 'rejected')),

  constraint food_catalog_candidates_proposed_name_not_blank
    check (length(trim(proposed_name)) > 0),

  constraint food_catalog_candidates_nutrition_non_negative
    check (
      calories >= 0
      and protein >= 0
      and fat >= 0
      and carbs >= 0
      and (fiber is null or fiber >= 0)
    ),

  constraint food_catalog_candidates_nutrition_not_all_zero
    check (
      calories > 0
      or protein > 0
      or fat > 0
      or carbs > 0
      or coalesce(fiber, 0) > 0
    ),

  constraint food_catalog_candidates_user_submission_source_link
    check (
      source_type <> 'user_submission'
      or source_user_food_id is not null
    ),

  constraint food_catalog_candidates_user_submission_owner
    check (
      source_type <> 'user_submission'
      or created_by_user_id is not null
    ),

  constraint food_catalog_candidates_provider_provenance
    check (
      source_type = 'user_submission'
      or source_provider is not null
      or source_provider_product_id is not null
    ),

  constraint food_catalog_candidates_approved_requires_promotion
    check (
      review_status <> 'approved'
      or promoted_to_canonical_food_id is not null
    ),

  constraint food_catalog_candidates_merged_requires_duplicate
    check (
      review_status <> 'merged'
      or duplicate_of_food_id is not null
    ),

  constraint food_catalog_candidates_rejected_requires_reason
    check (
      review_status <> 'rejected'
      or length(trim(coalesce(rejected_reason, ''))) > 0
    ),

  constraint food_catalog_candidates_reviewed_status_requires_review_metadata
    check (
      review_status in ('pending', 'needs_review')
      or (reviewed_at is not null and reviewed_by is not null)
    )
);

comment on table public.food_catalog_candidates is
  'DRAFT: Review queue for private user food submissions and future provider import candidates. Rows are not public catalog foods and must never be diary sources.';

comment on column public.food_catalog_candidates.source_user_food_id is
  'For user_submission candidates, references the private source=user food created for immediate owner use.';

comment on column public.food_catalog_candidates.promoted_to_canonical_food_id is
  'Set only after owner/admin approval creates or links a verified canonical food.';

comment on column public.food_catalog_candidates.duplicate_of_food_id is
  'Set when review merges/rejects candidate as duplicate of an existing verified food.';

create index if not exists food_catalog_candidates_review_status_created_idx
  on public.food_catalog_candidates (review_status, created_at desc);

create index if not exists food_catalog_candidates_created_by_user_idx
  on public.food_catalog_candidates (created_by_user_id);

create index if not exists food_catalog_candidates_source_user_food_idx
  on public.food_catalog_candidates (source_user_food_id);

create index if not exists food_catalog_candidates_normalized_identity_idx
  on public.food_catalog_candidates (normalized_name, normalized_brand);

create index if not exists food_catalog_candidates_barcode_idx
  on public.food_catalog_candidates (barcode)
  where barcode is not null;

create index if not exists food_catalog_candidates_duplicate_of_food_idx
  on public.food_catalog_candidates (duplicate_of_food_id)
  where duplicate_of_food_id is not null;

create index if not exists food_catalog_candidates_promoted_food_idx
  on public.food_catalog_candidates (promoted_to_canonical_food_id)
  where promoted_to_canonical_food_id is not null;

create index if not exists food_catalog_candidates_provider_identity_idx
  on public.food_catalog_candidates (source_provider, source_provider_product_id)
  where source_provider is not null or source_provider_product_id is not null;

-- RLS DRAFT ONLY:
-- Do not apply until the current admin role model is confirmed.
-- Candidates are not public search records.
-- Regular users must not read all candidates.
-- A future product decision may allow users to read limited status for their own
-- submissions, but not admin notes, duplicate internals, reviewer identity, or
-- provider/private metadata.
-- Owner/admin/service-role review is required for promotion.

alter table public.food_catalog_candidates enable row level security;

-- TODO: Replace this predicate with the production-correct admin role helper or
-- profile check used by the current admin surfaces before any apply.
--
-- Example only:
-- exists (
--   select 1
--   from public.user_profiles
--   where id_user = auth.uid()
--     and is_admin = true
-- )

-- Example admin-only policy draft. Keep commented until admin role model review.
--
-- create policy "Admins can review food catalog candidates"
--   on public.food_catalog_candidates
--   for all
--   using (
--     exists (
--       select 1
--       from public.user_profiles
--       where id_user = auth.uid()
--         and is_admin = true
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.user_profiles
--       where id_user = auth.uid()
--         and is_admin = true
--     )
--   );

-- Example limited owner insert/status policies. Keep commented until UX and
-- privacy fields are finalized.
--
-- create policy "Users can create own food catalog candidates"
--   on public.food_catalog_candidates
--   for insert
--   with check (
--     auth.uid() = created_by_user_id
--     and source_type = 'user_submission'
--     and review_status in ('pending', 'needs_review')
--   );
--
-- create policy "Users can read limited own food catalog candidates"
--   on public.food_catalog_candidates
--   for select
--   using (
--     auth.uid() = created_by_user_id
--   );

commit;

-- Future apply checklist:
--
-- 1. Confirm public.foods.id type is uuid in the target environment.
-- 2. Confirm gen_random_uuid() availability or adjust UUID default.
-- 3. Confirm current admin role model and profile columns.
-- 4. Decide whether users can read limited status of their own submissions.
-- 5. Add a redacted user-facing view if users can see status.
-- 6. Add updated_at trigger only after trigger helper review.
-- 7. Run RLS behavior tests before enabling runtime writes.
-- 8. Verify no candidate rows appear in regular search or Premium catalog paths.
