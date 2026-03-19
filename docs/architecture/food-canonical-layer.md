# Food Canonical Layer

## Architecture Summary

POTOK already has the core primitives for a canonical food model:

- `public.foods`
- `public.food_aliases`
- downstream references:
  - `public.favorite_products.canonical_food_id`
  - `public.food_diary_entries.canonical_food_id`
  - `public.recipe_ingredients.food_id`

The target model is:

- `foods` is the only source of truth for nutritional identity
- canonical food rows are stable roots
- aliases resolve user/search/import text to a canonical food root
- downstream tables only store canonical references, not loose product identity

## Canonical Model

### Canonical food

A food row is canonical when:

- `foods.canonical_food_id = foods.id`

This row is the canonical nutrition identity used by:

- diary entries
- favorites
- recipe ingredients
- import resolution
- search resolution

### Non-canonical food

A non-canonical food row is a variant or duplicate candidate when:

- `foods.canonical_food_id <> foods.id`

Such a row may still exist for compatibility, but architecturally it should not
be the preferred downstream target.

### Alias

`public.food_aliases` stores alternative textual forms mapped to a canonical food:

- inflected names
- transliterations
- brand spelling variants
- shorthand search terms

Resolver logic should prefer alias mapping over creating a new standalone food
row when the nutritional identity already exists.

## Catalog vs User Foods

### Catalog foods

`foods.source in ('core', 'brand')`

Expected role:

- shared canonical catalog
- canonical root by default
- resolver destination for import/search when a public food already exists

### User foods

`foods.source = 'user'`

Expected role:

- private food rows
- owned by `created_by_user_id`
- canonical root for that user unless intentionally linked to another private
  canonical food owned by the same user

User foods must never leak across users.

## Resolver Layer

The resolver is a deterministic write-path layer that converts loose input into a
canonical food id.

Priority order:

1. exact UUID if already present
2. barcode match
3. exact normalized `(normalized_name, normalized_brand)`
4. alias match
5. reviewed manual choice
6. create a new user food only if no safe canonical match exists

The resolver should return:

- `canonical_food_id`
- `resolution_source`
- optional `resolution_confidence`
- optional `review_required`

## Existing Fields: sufficient vs gaps

### Already sufficient

- `foods.id`
- `foods.canonical_food_id`
- `foods.normalized_name`
- `foods.normalized_brand`
- `foods.source`
- `foods.created_by_user_id`
- `food_aliases.canonical_food_id`
- downstream canonical pointers in favorites/diary/recipe ingredients

### Recommended additive schema supports

Without destructive changes, the next useful additions are:

- `foods.canonical_resolution_status`
- `foods.superseded_by_food_id`
- `food_aliases.resolver_priority`
- downstream `canonical_resolution_source`

These are operational support fields.
They are not required to keep current flows working, but they improve migration,
auditing, and future dedupe safety.

## Recommended constraints and indexes

### Keep

- unique normalized key on `foods(normalized_name, coalesce(normalized_brand, ''))`
- unique normalized alias on `food_aliases(normalized_alias)`

### Add

- index on `foods(canonical_food_id)`
- index on `foods(superseded_by_food_id)` if that field is introduced
- index on `food_aliases(normalized_alias, resolver_priority, canonical_food_id)`

### Add later, not immediately enforce

- `foods.canonical_food_id is not null` as `NOT VALID` check first
- controlled validation only after legacy cleanup is complete

## Resolver Flows

### 1. Search input

Input:

- raw text, optional brand, optional barcode

Flow:

1. normalize text
2. search catalog roots first
3. search aliases
4. search user-owned foods for the current user
5. if exactly one safe match exists, return canonical id
6. if multiple or weak matches exist, require user selection

### 2. Import pipeline

Input:

- staged food rows

Flow:

1. normalize name/brand
2. reject invalid macro rows
3. upsert by normalized key for canonical catalog rows
4. attach aliases when alternate names are present
5. never create extra standalone rows when the same canonical identity exists

### 3. Recipe ingredient creation

Input:

- ingredient from search/manual recipe flow

Flow:

1. require `foods.id` resolution before insert into `recipe_ingredients`
2. store only canonical `food_id`
3. if ingredient text is unresolved, keep it in review flow, do not insert guessed ids

### 4. Manual custom food creation

Input:

- user-entered product

Flow:

1. normalize name/brand
2. search current user foods
3. search public catalog
4. if a public canonical identity is genuinely different, allow separate user food
5. set `source = 'user'`, `created_by_user_id = auth.uid()`, `canonical_food_id = id`

## Write-path Rules

### Diary entry

- always save `canonical_food_id` when resolver produced one
- if unresolved legacy/manual text is temporarily allowed, mark it as unresolved and
  keep it out of canonical analytics where possible

### Favorite

- store `canonical_food_id` as primary identity
- `product_name` remains a display/compat field, not identity

### Recipe ingredient

- store only `recipe_id`, `food_id`, `amount_g`
- `food_id` must already be canonical

### Duplicate prevention

- do not create a new `foods` row if normalized key resolves to an existing
  canonical catalog row
- prefer alias creation over duplicate food creation
- user-food creation must still check normalized collisions inside user scope

## Safe Migration Draft

Draft file:

- `supabase/migration_drafts/20260316_food_canonical_layer_draft.sql`

This draft is:

- production-safe
- idempotent
- non-destructive
- additive only

It must not be auto-applied before audit review.
