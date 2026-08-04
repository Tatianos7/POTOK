# Admin First Real Alias Apply Readiness

- Timestamp: 2026-08-03T00:00:00Z
- Basis: `reports/admin-approved-alias-apply-production-smoke-final-status-2026-08-03.md`
- Scope: read-only readiness audit for the first real Admin-approved Alias Apply
- Verdict: **NO_SAFE_CANDIDATE**

## Safety

- Read-only audit/report only.
- RPC was not called.
- No aliases were added.
- No foods were created.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No import/backfill/recompute was run.
- No PR was created.

## Current Counts

Read-only production counts:

| Table | Count |
| --- | ---: |
| `foods` | 2265 |
| `food_aliases` | 2890 |
| `food_search_events` | 50 |
| `food_search_review_queue` | 2 |
| `food_alias_apply_audit` | 0 |
| `food_diary_entries` | 159 |
| `favorite_products` | 6 |
| `recipes` | 14 |
| `recipe_ingredients` | 43 |

Notes:

- `food_search_review_queue = 2` are old rejected non-smoke rows.
- `food_alias_apply_audit = 0`.
- No smoke artifacts were found in the reviewed data.

## Reviewed Queue Rows

Current queue rows:

| Query | Context | Status | Frequency | Suggested canonical | Apply state |
| --- | --- | --- | ---: | --- | --- |
| `стей` | `diary` | `rejected` | 2 | none | none |
| `стей` | `diary` | `rejected` | 2 | none | none |

These rows are not candidates for first real apply because they are rejected and have no suggested canonical food.

## Candidate Review

Strict safe-candidate criteria used:

- source event type is `not_found`;
- query is not from the smoke marker;
- no related ambiguous event;
- no existing `food_aliases.normalized_alias` duplicate;
- exactly one shared canonical food exists by exact `foods.normalized_name`;
- canonical food source is shared: `core` or `brand`;
- candidate is not an old rejected/manual row.

Reviewed top real `not_found` queries:

| Query | Frequency | Existing alias | Exact shared canonical | Contains candidates | Decision |
| --- | ---: | ---: | ---: | --- | --- |
| `стей` | 2 | 0 | 0 | 0 | Not safe |
| `сте` | 2 | 0 | 0 | multiple unrelated/partial matches | Not safe |
| `стейк` | 2 | 0 | 0 | 0 | Not safe |
| `ывапролдж` | 2 | 0 | 0 | 0 | Not safe |
| `говяд` | 1 | 0 | 0 | multiple beef matches | Not safe |
| `говя` | 1 | 0 | 0 | multiple beef matches | Not safe |
| `гов` | 1 | 0 | 0 | multiple beef matches | Not safe |
| `стейцк` | 1 | 0 | 0 | 0 | Not safe |
| `стейц` | 1 | 0 | 0 | 0 | Not safe |
| `стейй` | 1 | 0 | 0 | 0 | Not safe |

## Why No Safe Candidate

No reviewed query has a single exact canonical target.

Examples:

- `стей`, `стейк`, `стейцк`, `стейц`, `стейй`: no exact shared canonical food was found.
- `гов`, `говя`, `говяд`: likely user intent may be beef, but matching catalog contains several plausible targets such as generic beef, boiled beef, lean boiled beef, beef mince, and other beef dishes. Choosing one would be a silent canonical decision.
- Random test-like strings such as `ывапролдж` have no canonical target.

Applying any of these as a first real alias would violate the manual-review rule because the canonical target is not exact and unambiguous.

## Duplicate / Conflict Risk

For reviewed queries:

- no existing exact `food_aliases.normalized_alias` duplicate was found;
- no alias conflict was found;
- blocker is not duplication, but missing/ambiguous canonical target.

## Owner Steps For First Real Apply

Use these steps only when a future query has a safe exact target.

1. Open `/admin/search-review`.
2. Pick a `not_found` query with real user intent.
3. Confirm the query has no existing alias.
4. Confirm exactly one canonical `core` or `brand` food is the intended target.
5. Create/update pending row with that candidate.
6. Approve the row.
7. Confirm row has non-empty `source_event_ids`.
8. Click `Apply alias` exactly once.
9. Expect UI result `applied`.
10. Validate `food_aliases +1`, `food_alias_apply_audit +1`, queue applied state, and `foods` unchanged.
11. Keep the alias only if it is a real reviewed alias, not smoke/test data.

Do not apply:

- partial stems such as `гов`, `говя`, `стей`;
- typo fragments without exact intended canonical;
- ambiguous queries with multiple plausible canonical targets;
- queries that require creating a new food;
- brand/barcode/OFF candidates before the separate brand layer exists.

## Readiness SQL For A Future Candidate

Before first real apply, run a read-only check for the proposed alias and canonical target:

```sql
-- Replace values before running.
with proposed as (
  select
    public.normalize_food_text('<alias_query>') as normalized_alias,
    '<canonical_food_id>'::uuid as canonical_food_id
)
select
  'alias_absent' as check_name,
  not exists (
    select 1
    from public.food_aliases fa, proposed
    where fa.normalized_alias = proposed.normalized_alias
  ) as actual,
  true as expected;

with proposed as (
  select '<canonical_food_id>'::uuid as canonical_food_id
)
select
  'canonical_is_shared' as check_name,
  exists (
    select 1
    from public.foods f, proposed
    where f.id = proposed.canonical_food_id
      and f.source in ('core', 'brand')
  ) as actual,
  true as expected;

with proposed as (
  select public.normalize_food_text('<alias_query>') as normalized_alias
)
select
  'ambiguous_events_absent' as check_name,
  not exists (
    select 1
    from public.food_search_events e, proposed
    where e.normalized_query = proposed.normalized_alias
      and e.event_type = 'ambiguous'
  ) as actual,
  true as expected;
```

## Deferred

- Wait for a real not-found query with exact canonical intent.
- Improve admin candidate suggestion UI for stems/typos without applying them automatically.
- Add an explicit manual override design for ambiguous rows.
- Add brand/barcode candidate layer before applying brand-specific aliases.

## Final Recommendation

Do not perform the first real Alias Apply yet.

Current production search analytics does not contain a safe real not-found candidate with one exact canonical target. Wait for a clearer query or review a future candidate manually, then apply through the existing approved Admin UI flow.
