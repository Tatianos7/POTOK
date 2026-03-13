# Nutrition Unified Architecture (POTOK)

## Target Graph (Source of Truth)
- `foods.id` is the canonical product node.
- `favorite_products.canonical_food_id -> foods.id` (when column exists; fallback by `product_name` is compatibility only).
- `food_diary_entries.canonical_food_id -> foods.id` (required when known).
- `recipe_ingredients.food_id -> foods.id`.
- `recipes.id -> recipe_ingredients.recipe_id`.
- `recipes.ingredients` JSON is compatibility shadow only.

## Current Audit Findings
### Data-link gaps
- `food_diary_entries` still contains many rows without `canonical_food_id` (example from runtime: 58/74 rows missing).
- `favorite_products` can be name-keyed (`product_name`) and may not have stable canonical linkage in some environments.
- Recipe UI still reads `recipes.ingredients` in multiple views; service needed graph-first reads.

### Flow gaps
- Add-food flow could save entries without explicit `canonicalFoodId` in UI payload, relying on partial fallback.
- Favorite flow used `user_id + product_name` as conflict key and could drift from `foods.id` graph.
- `recompute_recipe_totals` can return low/zero totals if linked foods have zero nutrient rows; reason was not surfaced at service layer.

## Fix Plan
### Phase 1 (Minimal safe, backward-compatible)
- Keep all existing tables and UX.
- Enforce canonical linkage in client payloads when UUID is available:
  - diary add/update flows
  - favorites add/increment/remove flows
- Read recipes graph-first (`recipe_ingredients + foods`), fallback to JSON.
- Add diagnostics and audit SQL; no destructive migrations.

### Phase 2 (Main hardening)
- Add/confirm `favorite_products.canonical_food_id` in all envs and migrate favorite flows to canonical-first conflict handling.
- Backfill `food_diary_entries.canonical_food_id` from `foods.normalized_name` + `food_aliases`.
- Introduce an optional strict DB check/report for `foods` rows with null/zero macros used in recipes.

### Phase 3 (Post-release)
- De-prioritize name-only favorite logic and JSON-only recipe ingredient consumers.
- Add background consistency job:
  - detect diary/favorites/recipes records not linked to `foods.id`
  - surface actionable report in admin panel.

## Security & Integrity Rules
- No cross-user access: all nutrition tables remain under RLS owner rules.
- `foods` mixed access: `core/brand` visible; `user` rows owner-only.
- No client-side `service_role` usage.
- No destructive backfills without dry-run SQL report first.

## Required Fields (Operational)
### For correct diary linkage
- `food_diary_entries.user_id`
- `food_diary_entries.date`
- `food_diary_entries.product_name` (compat)
- `food_diary_entries.canonical_food_id` (required when known)

### For correct favorites linkage
- `favorite_products.user_id`
- `favorite_products.product_name` (compat key)
- `favorite_products.canonical_food_id` (target key)

### For correct recipe totals
- `recipe_ingredients.recipe_id`
- `recipe_ingredients.food_id`
- `recipe_ingredients.amount_g > 0`
- `foods.calories/protein/fat/carbs` non-null and not all zero for meaningful totals

## Read-only Diagnostics
- SQL file: `scripts/sql/nutrition_graph_audit.sql`
- Run in Supabase SQL Editor as `postgres` for full coverage.
