-- DESIGN ONLY. Never apply this file as a migration. No production schema was inspected.
-- An immediate exception aborts the transaction to prevent accidental execution. Review the live schema,
-- privileges, reviewed-evidence authority, and all writers before producing an apply migration.
begin;
do $$ begin raise exception 'NUTRITION_INTEGRITY_V1_DESIGN_ONLY_DO_NOT_APPLY'; end $$;

-- Additive, nullable data. Existing rows are not updated or backfilled.
alter table public.foods
  add column if not exists declared_nutrient_basis_v1 text
    check (declared_nutrient_basis_v1 in ('PER_100_G_EDIBLE', 'PER_100_ML', 'PER_PORTION'));
-- This field is only a user assertion for source='user'. It never grants CONFIRMED.
-- Before apply: add a CHECK / write policy or trigger proving source='user' and owner=auth.uid().
-- Current core/brand foods get no inferred basis from unit, verified, or non-null macros.

create schema if not exists nutrition_integrity_private;
revoke all on schema nutrition_integrity_private from public, anon, authenticated;

-- Populated only by a separately approved reviewed-evidence bridge, never by diary clients.
-- The bridge must verify canonical+nutrition revision digest, approval event, authority,
-- applicability, and absence of a later invalidation before making a binding active.
create table if not exists nutrition_integrity_private.reviewed_food_basis_v1 (
  food_id uuid primary key references public.foods(id),
  canonical_food_id uuid not null,
  nutrition_revision_id uuid not null,
  nutrition_digest text not null check (nutrition_digest ~ '^[0-9a-f]{64}$'),
  approval_event_id uuid not null,
  basis text not null check (basis = 'PER_100_G_EDIBLE'),
  food_state text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table nutrition_integrity_private.reviewed_food_basis_v1 enable row level security;
revoke all on nutrition_integrity_private.reviewed_food_basis_v1 from public, anon, authenticated;

-- Product-specific conversions are similarly privileged only when REVIEWED_EVIDENCE.
-- USER_DECLARED conversions may be accepted solely as ESTIMATE after ownership checks.
create table if not exists nutrition_integrity_private.food_conversions_v1 (
  food_id uuid not null references public.foods(id),
  input_unit text not null check (input_unit in ('ml', 'tbsp', 'tsp', 'piece', 'portion')),
  conversion_kind text not null check (conversion_kind in ('GRAMS_PER_ML', 'GRAMS_PER_UNIT', 'ML_PER_UNIT')),
  amount numeric(14,3) not null check (amount > 0),
  source_kind text not null check (source_kind in ('REVIEWED_EVIDENCE', 'USER_DECLARED')),
  evidence_ref text not null check (length(trim(evidence_ref)) > 0),
  primary key (food_id, input_unit, conversion_kind)
);
alter table nutrition_integrity_private.food_conversions_v1 enable row level security;
revoke all on nutrition_integrity_private.food_conversions_v1 from public, anon, authenticated;

alter table public.food_diary_entries
  add column if not exists integrity_contract_v1 integer,
  add column if not exists integrity_status_v1 text,
  add column if not exists source_amount_v1 numeric(14,3),
  add column if not exists source_unit_v1 text,
  add column if not exists nutrient_basis_v1 text,
  add column if not exists basis_provenance_v1 text,
  add column if not exists basis_reference_v1 text,
  add column if not exists conversion_reference_v1 text;

alter table public.food_diary_entries
  add constraint food_diary_integrity_v1_shape check (
    (integrity_contract_v1 is null and integrity_status_v1 is null)
    or (integrity_contract_v1 = 1
      and integrity_status_v1 in ('CONFIRMED', 'ESTIMATE')
      and source_amount_v1 > 0
      and source_unit_v1 in ('g', 'ml', 'l', 'tbsp', 'tsp', 'piece', 'portion')
      and nutrient_basis_v1 in ('PER_100_G_EDIBLE', 'PER_100_ML', 'PER_PORTION')
      and basis_provenance_v1 in ('REVIEWED_REVISION', 'USER_DECLARED', 'LEGACY_CONTRACT')
    )
  );

-- Mandatory server gate before exposing V1 writes:
-- BEFORE INSERT / BEFORE nutrition-changing UPDATE trigger on food_diary_entries.
-- 1. Check auth.uid()=NEW.user_id and ordinary RLS ownership; client-provided status,
--    totals, basis, references and normalized weight are never authoritative.
-- 2. Fetch the current food and server-owned reviewed binding or owner declaration.
--    A legacy 100g contract claim must be explicitly curated; food.unit and verified
--    cannot establish it. The 254 ambiguous Food Core rows stay UNKNOWN pending review.
-- 3. Resolve source amount+unit. g is exact mass; l->ml is exact volume. ml->g needs
--    current food-specific density evidence. Spoons/pieces/portions need their own
--    matching conversion. Never silently use 1 ml=1 g or a fixed household mass.
-- 4. Compute with SQL numeric, rounded explicitly; overwrite client totals and status.
--    CONFIRMED requires active reviewed basis AND reviewed conversion when needed.
--    USER_DECLARED/LEGACY_CONTRACT can only produce ESTIMATE. UNKNOWN has no totals
--    and must be rejected from this numeric diary table.
-- 5. Recheck idempotency against source quantity, unit, basis/provenance and revision,
--    not merely date/name/weight. On edit/copy/recipe writes run the same gate.
-- 6. Existing rows with NULL integrity_contract_v1 retain historical numbers and
--    read as UNKNOWN. An explicit user edit creates a new classified snapshot;
--    metadata-only updates must not recalculate old nutrition.
-- 7. During cutover, reject old unversioned INSERTs and nutrient-changing UPDATEs.
--    Do not use a fallback that accepts client totals or strips V1 columns.
-- 8. Revoke or gate any direct INSERT/UPDATE path that cannot be covered by this
--    trigger; test direct PostgREST writes under anon/authenticated and service roles.
--    Preserve SELECT/DELETE ownership and approved admin operations separately.
-- No trigger/function is installed in this design file: live schema and authority
-- preflight plus owner approval are required before executable SQL can be written.

-- Existing recompute_food_entries_for_food_ids updates historical snapshots from
-- current foods and weight. It must not run on V1 rows or legacy rows during this
-- rollout until explicitly redesigned and approved; do not execute it here.

-- The existing weight column is NOT NULL and means grams. Additive columns cannot
-- honestly store a per-100ml/per-portion diary entry without a known gram mass.
-- Such products may be created with a declared basis, but diary save is held until
-- a separately approved native-amount API/schema evolution removes that constraint.
rollback;
