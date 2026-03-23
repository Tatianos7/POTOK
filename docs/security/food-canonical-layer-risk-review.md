# Food Canonical Layer Risk Review

## Objective

Define a canonical food layer without breaking:

- nutrition diary
- favorites
- recipe analyzer
- recipe ingredients
- import/search flows

## Main Risks

### 1. Wrong canonical merges

Risk:

- two foods with similar names but different nutrition identities get collapsed

Impact:

- wrong macros in diary and recipes
- user distrust

Mitigation:

- no mass updates in phase one
- alias-first strategy before duplicate-row rewrites
- manual review for ambiguous candidates

### 2. Cross-user leakage

Risk:

- user foods accidentally resolve to another user's private row

Impact:

- privacy breach

Mitigation:

- user foods remain private under RLS
- resolver must not cross user boundaries for `source='user'`
- user canonical roots must remain owner-scoped

### 3. Legacy rows without canonical ids

Risk:

- analytics/recompute/search use partial identity data

Impact:

- inconsistent nutrition behavior

Mitigation:

- keep read-only audits
- backfill only through reviewed scripts
- do not enforce hard not-null constraints until cleanup is done

### 4. Silent unit conversion errors

Risk:

- text ingredients or piece-based inputs become grams incorrectly

Impact:

- recipe totals become wrong

Mitigation:

- no automatic grams conversion for uncertain legacy values
- operator-reviewed mapping only for shadow JSON recovery

### 5. Catalog duplicate drift

Risk:

- import pipeline creates multiple standalone rows for the same canonical food

Impact:

- search noise
- downstream split references

Mitigation:

- normalized-key upsert
- alias-first expansion
- add canonical audit pack into regular ops checks

## Rollout Plan

### Phase 1: Audit only

- run canonical linkage audits
- review duplicate foods and alias collisions
- review promotion/alias candidates

### Phase 2: Additive schema supports

- add indexes and optional diagnostic fields from the draft migration
- do not rewrite data yet

### Phase 3: Resolver adoption

- standardize all write-paths on canonical resolver output
- capture `canonical_resolution_source`

### Phase 4: Controlled cleanup

- reviewed backfills only
- no bulk destructive dedupe
- validate stricter constraints only after the graph is clean

## Read-only Audit Pack

- `scripts/sql/food_canonical_linkage_audit.sql`
- `scripts/sql/food_canonical_duplicates_audit.sql`
- `scripts/sql/food_alias_collisions_audit.sql`
- `scripts/sql/food_canonical_promotion_candidates_audit.sql`

## Decision Boundary

Do not:

- mass-update `foods`
- delete duplicate rows
- force canonical rewrites in diary/favorites/recipes
- validate new strict constraints before the audits are green

The canonical layer should be introduced as an additive, reviewable control
plane first, then adopted into write paths gradually.
