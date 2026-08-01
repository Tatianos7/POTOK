# Search Analytics Runtime Logging Implementation

- Timestamp: 2026-08-01T00:00:00Z
- Basis: `reports/search-analytics-admin-review-db-applied-final-status-2026-08-01.md`
- Guardrails: `reports/search-analytics-privacy-retention-guardrails-2026-08-01.md`
- Scope: runtime-only non-blocking food search analytics logging
- Verdict: **SEARCH_ANALYTICS_RUNTIME_LOGGING_READY**

## Safety

- Runtime code was changed only for non-blocking analytics logging.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No aliases were added.
- No foods were created.
- No import/backfill/recompute was run.
- Food search ranking/resolver behavior was not changed.
- Diary/favorites/recipes writes were not changed.
- No PR was created.

## Implementation

Added `src/services/searchAnalyticsService.ts`.

The service writes only to:

- `public.food_search_events`

It does not write to:

- `public.food_search_review_queue`;
- `public.foods`;
- `public.food_aliases`;
- diary/favorites/recipes tables.

Logged event types:

- `query`
- `selection`
- `not_found`
- `ambiguous`

`no_selection` is intentionally not logged yet to avoid noisy analytics.

## Guardrails Implemented

- Query is trimmed and internal whitespace is collapsed.
- Query and normalized query are limited to 120 characters.
- Queries shorter than 2 characters are skipped.
- Obvious email/phone PII queries are skipped.
- Metadata is allowlisted.
- `user_id` is used only when non-empty.
- Blank/missing `user_id` falls back to `session_id_hash`.
- Session id is random and locally scoped before hashing.
- Repeated events are deduped by context, event type, normalized query, and selected id.
- Insert failures are swallowed and do not block UX.

## Integration Points

`src/services/foodService.ts`:

- Logs search result analytics after `finalizeFoodSearchResults(...)`.
- Does not change result ranking, filtering, resolver behavior, or return value.
- Logs:
  - `query` for executed searches;
  - `not_found` when final result count is zero;
  - `ambiguous` only for existing manual disambiguation queries with multiple results.

`src/components/ProductSearch.tsx`:

- Logs `selection` when a user clicks a search result.
- Logging is fire-and-forget before the existing `onSelect(...)` callback.
- Product selection UX does not wait for analytics.

## Tests

Added targeted tests:

- `src/services/__tests__/searchAnalyticsService.test.ts`

Covered:

- mutually exclusive `query` + `not_found` payloads;
- ambiguous payloads with candidate canonical ids;
- selection payload with selected canonical id;
- short query and obvious PII skip;
- `session_id_hash` fallback when `user_id` is missing or blank;
- metadata allowlist;
- dedupe;
- insert failures are non-blocking.

## Verification

- `npx tsx --test src/services/__tests__/searchAnalyticsService.test.ts`: **PASS**, `7/7`.
- `npm run build`: **PASS**.

Build notes:

- Vite reported existing dynamic-import/chunk-size warnings.
- Browser data warnings were shown.
- No build failure.

## Deferred

- `no_selection` logging.
- Admin review queue runtime writes.
- Runtime generation of review queue candidates.
- Approved alias apply workflow.
- Retention cleanup job.
- Open Food Facts/barcode candidate persistence.

## Final Status

Search Analytics runtime logging is ready as a non-blocking analytics layer. It logs search events to `food_search_events` only, preserves existing search/resolver/diary behavior, and does not mutate Food Core or aliases.
