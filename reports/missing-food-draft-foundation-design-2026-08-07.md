# Missing Food Draft Foundation Design

- Timestamp: 2026-08-07T00:00:00Z
- Basis: `reports/missing-food-review-queue-management-ui-production-smoke-2026-08-07.md`
- Related DB status: `reports/missing-food-review-queue-db-applied-final-status-2026-08-06.md`
- Scope: read-only design for draft-only missing food preparation before any production food creation
- Verdict: **MISSING_FOOD_DRAFT_FOUNDATION_DESIGN_READY**

## Safety

- Design/report only.
- Production DB schema was not changed.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called.
- No foods were created.
- No aliases were added.
- No writes were made to `foods` or `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Current State

Missing Food Review Queue is production-ready:

- `food_missing_review_queue` exists.
- Admin UI can display and manage rows.
- Owner production smoke confirmed `pending -> needs_research`.
- `reviewer_id`, `reviewed_at`, and `updated_at` are persisted.
- No foods or aliases are created by the queue.

Current queue fields are enough for review intent:

- query;
- normalized query;
- classification;
- status;
- source events;
- suggested name;
- suggested category;
- suggested source;
- reviewer/comment metadata.

They are not enough for a safe production `foods` insert because nutrition, unit, provenance, duplicate checks, and final owner approval are still missing.

## Existing Food Contract

Runtime `Food` type includes:

- `name`
- `normalized_name`
- `category`
- `source`
- `calories`
- `protein`
- `fat`
- `carbs`
- `fiber`
- `unit`
- `brand`
- `barcode`
- `verified`
- `created_by_user_id`
- `stable_food_id`
- `canonical_food_id`

Important semantics:

- Shared foods should be `source = 'core'` or `source = 'brand'`.
- User foods are `source = 'user'` and must not become shared Missing Food drafts.
- Fiber nullability must be preserved:
  - `fiber = null` means unknown/unprovided;
  - `fiber = 0` means confirmed zero.
- Diary nutrition snapshots are immutable and must not be recomputed after a new food is added.

## Draft-Only Model

Recommendation: introduce a separate draft preparation layer before any production food creation.

Do not write directly from `food_missing_review_queue` into `foods`.

Preferred future DB object:

- `public.food_missing_food_drafts`

This table should be admin-only and should reference the review queue row.

Suggested fields:

- `id`
- `source_review_id`
- `query`
- `normalized_query`
- `name`
- `normalized_name`
- `category`
- `source`
- `brand`
- `barcode`
- `calories`
- `protein`
- `fat`
- `carbs`
- `fiber`
- `unit`
- `data_source`
- `source_url`
- `source_notes`
- `reviewer_notes`
- `status`
- `prepared_by`
- `prepared_at`
- `reviewed_by`
- `reviewed_at`
- `metadata`
- `created_at`
- `updated_at`

Allowed draft statuses:

- `draft`
- `needs_revision`
- `ready_for_owner_apply`
- `rejected`
- `applied`

The `applied` state should be written only after a separate owner-approved food creation step succeeds.

## Field Contract

Identity/display:

- `name`: canonical Russian display name.
- `normalized_name`: generated using current food normalization semantics.
- `category`: product category used by Food Core/admin UI.
- `source`: restricted to shared candidate values, initially `core` or `brand`.
- `brand`: nullable; required only for brand/barcode products.
- `barcode`: nullable; allowed only for brand/barcode/OFF-backed drafts.

Nutrition per 100 g/ml:

- `calories`
- `protein`
- `fat`
- `carbs`
- `fiber`

Nutrition rules:

- calories/protein/fat/carbs are required before `ready_for_owner_apply`;
- values must be finite and non-negative;
- all-zero macros require explicit allowed-zero justification;
- `fiber` may be `null`;
- never coerce unknown fiber to `0`;
- nutrition values must have source/provenance.

Unit:

- default `unit = 'g'`;
- allow `g`, `ml`, `piece`, `portion` only after explicit product decision;
- serving-size support should remain separate from per-100g nutrition.

Provenance:

- `data_source`: required before `ready_for_owner_apply`;
- `source_url`: optional but recommended;
- `source_notes`: free-form source/provenance notes;
- `reviewer_notes`: admin reasoning and unresolved caveats.

Audit:

- `prepared_by`, `prepared_at`;
- `reviewed_by`, `reviewed_at`;
- source review row;
- source search event ids via linked review row or copied metadata.

## Flow

Phase 0: current state

- Admin classifies/reviews not-found query.
- Missing queue row moves:
  - `pending -> needs_research`
  - `needs_research -> approved_for_food_draft`
- No food is created.
- No alias is created.

Phase 1: draft preparation

- Admin opens an `approved_for_food_draft` row.
- Admin prepares a draft with canonical name, category, source, unit, macros, fiber, and provenance.
- Draft status starts as `draft`.
- Draft can move to `needs_revision` or `ready_for_owner_apply`.
- No food is created.

Phase 2: owner apply package

- A separate package selects exactly reviewed `ready_for_owner_apply` drafts.
- Owner runs pre-check:
  - duplicate normalized name;
  - conflicting barcode;
  - invalid source;
  - invalid nutrition;
  - missing provenance;
  - current counts.
- Owner applies exactly the approved food rows.
- Post-check confirms only expected `foods` count changed.

Phase 3: alias follow-up

- After a canonical food exists, the original query may become an alias candidate.
- Alias insertion remains separate through Admin-approved Alias Apply.
- No automatic alias is created from food creation.

## Validation Before Food Creation

A future food creation workflow must validate:

- `source_review_id` exists and is `approved_for_food_draft`;
- draft status is `ready_for_owner_apply`;
- normalized name is non-blank;
- no existing shared food has the same `normalized_name` unless explicitly resolved;
- no conflicting barcode exists;
- source is allowed for shared catalog creation;
- macros are finite and non-negative;
- fiber is either null or finite/non-negative;
- all-zero macro products have explicit justification;
- data source/provenance is present;
- owner approval is explicit.

## Recommended DB Plan

Next DB draft should create a draft table only:

- `food_missing_food_drafts`

It should not:

- insert into `foods`;
- insert into `food_aliases`;
- create a trigger from queue status;
- create a trigger from draft status to foods;
- run imports;
- run backfills;
- recompute diary/favorites/recipes.

RLS:

- admin-only using `user_profiles.id_user = auth.uid()`.

Indexes:

- `source_review_id`;
- `status, updated_at desc`;
- `normalized_name`;
- `source`;
- optional `barcode` partial index where barcode is not null.

Uniqueness:

- do not make `normalized_name` globally unique in draft table at first;
- instead add duplicate-check queries and optional partial unique for active draft rows after review.

## Recommended UI Plan

Extend `/admin/missing-food-review` with a draft preparation panel for rows in:

- `approved_for_food_draft`

UI fields:

- name;
- category;
- source;
- brand;
- barcode;
- calories;
- protein;
- fat;
- carbs;
- fiber with explicit unknown/null control;
- unit;
- data source;
- source URL;
- source notes;
- reviewer notes.

UI states:

- save draft;
- mark needs revision;
- mark ready for owner apply;
- reject draft.

The UI must show:

- duplicate normalized-name warnings;
- existing contains/exact food candidates;
- current source events;
- reviewer notes and provenance.

The UI must not show:

- "Create food" as an immediate production action;
- Alias Apply for missing-food drafts.

## Guardrails

- No automatic food creation from not-found queries.
- No automatic food creation from `approved_for_food_draft`.
- No trigger from draft status to `foods`.
- No automatic alias creation after food creation.
- No broad-prefix food creation.
- No typo/noise food creation.
- Keep brand/OFF/barcode candidates separate from clean generic Core.
- Preserve diary snapshot immutability.
- Preserve nullable fiber semantics.
- Require explicit owner approval for any production food insert.

## Open Decisions

The design is ready, but these product decisions should be made before DB draft apply:

- Whether first missing-food drafts allow only `source='core'` or also `source='brand'`.
- Whether `unit` should initially be restricted to `g` only.
- Which provenance values are allowed in `data_source`.
- Whether `barcode` belongs in the first draft table or waits for the brand/barcode layer.
- Whether draft rows should copy `source_event_ids` or rely only on `source_review_id`.

These are not blockers for the foundation design, but they matter before a production schema apply.

## Final Recommendation

Prepare a DB draft for `food_missing_food_drafts` next, but keep it draft-only. The next implementation should let admins prepare complete food drafts from approved Missing Food Review rows without inserting into `foods` or `food_aliases`. Production food creation must remain a later owner-approved apply package with strict pre/post validation.
