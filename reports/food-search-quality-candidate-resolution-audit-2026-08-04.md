# Food Search Quality / Candidate Resolution Audit

- Timestamp: 2026-08-04T00:00:00Z
- Basis: `reports/admin-approved-alias-apply-production-smoke-final-status-2026-08-03.md`
- Prior first real apply readiness: `reports/admin-first-real-alias-apply-readiness-2026-08-03.md`
- Scope: read-only audit of current Food Search not-found/ambiguous queries, candidate resolution, and safe next actions
- Verdict: **FOOD_SEARCH_QUALITY_AUDIT_READY**

## Safety

- Read-only audit/report only.
- RPC was not called.
- No aliases were added.
- No foods were created.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- Food Core data was not changed.
- Resolver/ranking/runtime behavior was not changed.
- No import/backfill/recompute was run.
- No PR was created.

## Current Production Counts

Read-only count checks:

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

- `food_search_review_queue = 2` are old rejected non-smoke rows for `стей`.
- `food_alias_apply_audit = 0`.
- No smoke alias/audit artifacts remain.
- `foods` and `food_aliases` remain at the expected baseline.

## Reviewed Search Events

Current review-event read found 17 `not_found`/`ambiguous` events.

- All current review events are `not_found`.
- No current `ambiguous` event was found in the reviewed event set.
- Current `candidate_canonical_food_ids` are empty for these not-found events.
- Context is `diary`.

Grouped current not-found queries:

| Query | Frequency | Event type | Existing exact alias | Exact shared canonical | Contains samples | Classification |
| --- | ---: | --- | ---: | ---: | --- | --- |
| `стей` | 2 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `сте` | 2 | `not_found` | 0 | 0 | milk pasteurized, sterlet, lobster, parsnip, cheeses, stevia, worcester sauce | `typo_or_prefix` |
| `стейк` | 2 | `not_found` | 0 | 0 | none | `missing_canonical_food` |
| `ывапролдж` | 2 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `говяд` | 1 | `not_found` | 0 | 0 | beef, boiled beef, lean boiled beef, fried beef, marbled beef, beef mince, beef dishes | `ambiguous_broad_query` |
| `говя` | 1 | `not_found` | 0 | 0 | beef, boiled beef, lean boiled beef, fried beef, marbled beef, beef mince, beef dishes | `ambiguous_broad_query` |
| `гов` | 1 | `not_found` | 0 | 0 | beef, boiled beef, lean boiled beef, fried beef, marbled beef, beef mince, beef dishes | `ambiguous_broad_query` |
| `стейцк` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `стейц` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `стейй` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `ыва` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `ывап` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |
| `ывапролд` | 1 | `not_found` | 0 | 0 | none | `typo_or_prefix` |

## Classification Summary

`alias_candidate`:

- None.

`missing_canonical_food`:

- `стейк`: real user intent is plausible, but no exact shared canonical food exists in `foods`.
- This should go to missing-food review, not Alias Apply.

`ambiguous_broad_query`:

- `гов`
- `говя`
- `говяд`

These are broad/prefix beef intents. The catalog contains several plausible shared foods, including generic beef, cooked beef variants, lean beef, marbled beef, beef mince, and beef dishes. Applying any of these as one alias would silently choose a canonical target.

`typo_or_prefix`:

- `стей`
- `сте`
- `стейцк`
- `стейц`
- `стейй`
- `ыва`
- `ывап`
- `ывапролд`
- `ывапролдж`

These are incomplete prefixes, misspellings, or test-like strings. They do not have a single safe canonical target.

## Search / Resolver Path Review

Runtime Food Search:

- `foodService.searchFoods(...)` checks user foods, public Supabase foods, exact `food_aliases.normalized_alias`, manual disambiguation phrases, and local fallback.
- Search ranking distinguishes canonical exact, alias exact, canonical prefix, alias prefix, canonical contains, alias contains, and fallback matches.
- Exact alias lookup appends matching canonical foods but does not create aliases.
- Manual disambiguation currently exists only for selected broad terms such as `овсянка` and `чай`.
- Runtime logs `query`, `not_found`, `ambiguous`, and `selection` through `searchAnalyticsService`; logging is non-blocking.

Admin Review:

- `searchAdminReviewService.getReviewItems()` reads `food_search_events` where event type is `not_found` or `ambiguous`.
- Candidate suggestions come from event candidate IDs, exact alias lookup, and `foods.normalized_name/name ilike`.
- Candidate display is review support only; it is not a resolver decision.
- Queue rows can be approved/rejected/snoozed/commented, but approval alone does not insert aliases.

Alias Apply:

- Alias creation is possible only through explicit admin action calling `public.apply_admin_approved_food_alias(...)`.
- No trigger exists from approved queue status.
- Current reviewed queries do not satisfy the safe alias criteria.

## Risks

| Area | Finding | Severity | Recommendation |
| --- | --- | --- | --- |
| First real alias apply | No current query has one exact canonical target | Medium | Do not apply a real alias yet |
| `стейк` | Real term appears absent from canonical catalog | Medium | Route to missing-food review |
| Beef prefixes | `гов/говя/говяд` match many plausible beef foods | Medium/High | Do not alias broad prefixes |
| `сте` prefix | Contains search returns unrelated partial matches | Medium | Treat as prefix/noise unless full intent is clear |
| Test-like strings | Random keyboard strings create not-found events | Low/Medium | Filter or classify as noise in Admin Review later |

## Safe Next Actions

Alias Apply only when exact canonical exists:

- Use Alias Apply only if one shared `core` or `brand` canonical food is the clear target.
- Confirm `food_aliases.normalized_alias` has no duplicate.
- Confirm no ambiguous event is tied to the review row.
- Confirm source evidence exists in `source_event_ids`.

Missing food review when canonical is absent:

- `стейк` should not become an alias until a canonical target exists.
- If the product needs steak support, create a separate missing-food review flow and decide whether the canonical should be generic `Стейк` or a set of specific steak/cut entries.
- Any food creation must be a separate owner-approved Food Core action, not an alias apply.

No alias for broad prefixes:

- Do not alias `гов`, `говя`, or `говяд`.
- These should become either resolver UX improvements, search ranking improvements, or manual disambiguation candidates.
- Short stems and prefixes should not silently canonicalize to generic beef.

Admin Review improvements later:

- Add a visible classification field: alias candidate, missing canonical food, ambiguous broad query, typo/prefix/noise.
- Add a not-aliasable reason to queue rows or UI metadata.
- Suppress or down-rank noisy prefix/test strings before they become review work.
- Consider a separate missing-food queue before adding new canonical foods.

## First Real Alias Apply Status

The first real Alias Apply should remain blocked until a future query has:

- real user intent;
- no existing alias;
- exactly one exact shared canonical target;
- no ambiguous source event;
- non-empty source event evidence;
- owner/admin approval in the existing Admin Review UI.

Current production data does not contain such a candidate.

## Final Recommendation

Proceed with Food Search Quality work as a classification/resolution block, not as immediate alias insertion. The current not-found data is useful, but it points to missing canonical food and broad-prefix handling rather than a safe first real alias apply.
