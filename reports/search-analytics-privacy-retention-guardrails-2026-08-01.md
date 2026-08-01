# Search Analytics Privacy / Retention Guardrails

- Timestamp: 2026-08-01T00:00:00Z
- Scope: runtime logging privacy, retention, and noise guardrails for Search Analytics/Admin Review
- Basis: `reports/search-analytics-admin-review-db-applied-final-status-2026-08-01.md`
- DB layer: `public.food_search_events`, `public.food_search_review_queue`
- Verdict: **SEARCH_ANALYTICS_PRIVACY_RETENTION_READY**

## Safety

- This is a guardrails/report update only.
- Runtime logging was not enabled.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No import/backfill/recompute was run.
- No aliases were added.
- No foods were created.
- No PR was created.

## Allowed Runtime Writes

Runtime may write only to `public.food_search_events`.

Allowed fields:

- `user_id`
- `session_id_hash`
- `query`
- `normalized_query`
- `context`
- `event_type`
- `result_count`
- `selected_canonical_food_id`
- `no_selection`
- `not_found`
- `ambiguous`
- `candidate_canonical_food_ids`
- `metadata`

Runtime must not write to:

- `public.food_search_review_queue`;
- `public.foods`;
- `public.food_aliases`;
- diary/favorites/recipes tables.

Review queue writes are reserved for an admin/manual review workflow after a separate implementation step.

## Event Rules

Runtime must keep event states mutually exclusive:

- `query`: no flags, `selected_canonical_food_id = null`.
- `selection`: `selected_canonical_food_id` is set, all flags false.
- `no_selection`: only `no_selection = true`, selected canonical is null.
- `not_found`: only `not_found = true`, `result_count = 0`, selected canonical is null.
- `ambiguous`: only `ambiguous = true`, selected canonical is null.

Runtime must not silently choose a canonical food for ambiguous queries.

## Query Limits

Recommended runtime limits before insert:

- trim whitespace;
- collapse repeated internal whitespace;
- drop events where trimmed query is blank;
- minimum query length: `2` characters after trim;
- maximum stored `query` length: `120` characters;
- maximum stored `normalized_query` length: `120` characters;
- truncate longer values instead of sending full raw text.

Reason:

- Food search queries are short by product nature.
- Long text increases privacy risk and review noise.
- The DB currently enforces non-blank text, not max length, so runtime must enforce the max limit.

## PII Guardrails

Runtime must not intentionally log:

- email addresses;
- phone numbers;
- full names;
- free-form notes;
- diary comments;
- recipe instructions;
- image/media URLs;
- auth tokens;
- Supabase JWT/session data;
- precise location;
- device identifiers;
- IP addresses.

If a query appears to contain obvious PII, runtime should either:

- skip logging the event; or
- store a redacted query such as `[redacted]` with `metadata.redacted = true`.

The safer MVP default is to skip logging obvious PII.

## Metadata Allowlist

Runtime `metadata` must be allowlisted and small.

Allowed metadata keys:

- `source_surface`: short UI source such as `food_diary_search`, `recipe_ingredient_search`, `favorites_search`, `barcode_search`;
- `app_version`: deployed app version or commit hash when available;
- `result_source_counts`: object with counts by source, for example `core`, `brand`, `user`;
- `latency_ms`: rounded integer;
- `redacted`: boolean;
- `reason`: short enum-like reason for `ambiguous`, `not_found`, or skipped canonical selection.

Forbidden metadata:

- raw result payloads;
- food nutrition snapshots;
- recipe text;
- diary entry details;
- user profile fields;
- email/phone/name;
- browser fingerprint fields;
- full URL with query params;
- auth/session/token data.

Recommended metadata size limit:

- keep serialized metadata under `2 KB`;
- drop unknown keys before insert.

## User / Session Rules

Authenticated event owner rules:

- Prefer `user_id = auth.uid()` for authenticated users when analytics needs per-user diagnostics.
- Use `session_id_hash` only when intentionally avoiding direct user identity.
- Do not send both `user_id = null` and `session_id_hash = null`.
- Do not derive `session_id_hash` from email, phone, name, or raw Supabase token.

Session hash rules:

- Generate a random local session id.
- Hash it client-side or in a small analytics helper.
- Rotate periodically, recommended at least every `30` days.
- Treat it as pseudonymous, not anonymous.

RLS note:

- Events with `user_id is null` are not visible to ordinary users under the current user select policy.
- Admins can review them through admin policy.

## Noisy Event Guardrails

Do not log `no_selection` on every keystroke or every render.

Allowed `query` logging:

- after debounce;
- only when search actually executes;
- only if query changed since the last logged query in the same context;
- optional client-side sampling if volume grows.

Allowed `no_selection` logging:

- when the user closes the search surface after seeing results;
- when the user clears a query after results were shown;
- when the user leaves the flow without selecting after a meaningful search.

Do not log `no_selection`:

- for blank queries;
- for queries shorter than the minimum;
- while the user is still typing;
- repeatedly for the same query/context in one search session.

Recommended dedupe window:

- one event per `normalized_query + context + event_type` per active search session.

## Non-Blocking Logging Contract

Search analytics must never block product UX.

Runtime behavior:

- search results must render even if logging fails;
- diary/recipe/favorite writes must proceed even if logging fails;
- logging promises should be awaited only when needed for tests, not for user navigation;
- failures should be swallowed or reported to console in development only;
- no user-facing error toast for analytics insert failure.

Retries:

- do not retry aggressively;
- no automatic retry loop on render;
- at most one quiet retry for transient network failure, if implemented;
- no offline queue for MVP unless separately designed.

## Retention / Cleanup Draft

Recommended retention before high-volume logging:

- raw `food_search_events`: keep `90` days;
- aggregated review metrics: keep longer through review queue frequency/status rows;
- reviewed queue rows: keep indefinitely unless privacy policy requires pruning;
- rejected/snoozed queue rows: review after `180` days.

Cleanup approach:

- scheduled SQL job or admin maintenance task deletes old `food_search_events`;
- cleanup must not touch `foods`, `food_aliases`, diary, favorites, recipes, or review decisions;
- cleanup should run in small batches if table grows.

Draft cleanup SQL for a later approved maintenance step:

```sql
delete from public.food_search_events
where created_at < now() - interval '90 days';
```

Do not enable cleanup until runtime logging volume and retention policy are owner-approved.

## Manual-Review-Only Rules

Runtime logging must not:

- insert aliases;
- create foods;
- auto-fill review queue approvals;
- approve/reject/snooze review items;
- silently resolve ambiguous queries;
- mutate diary history or nutrition snapshots;
- import or promote Open Food Facts/barcode candidates into Core.

Admin review remains a separate manual workflow.

## Implementation Gate For Runtime Logging

Before enabling runtime logging:

- implement a small analytics service with the allowlist above;
- add query length and PII guards;
- add event dedupe/noise control;
- add tests for each event type;
- verify logging failure is non-blocking;
- confirm `food_search_events` insert RLS works for authenticated users;
- confirm admin review can read events;
- keep review queue writes disabled unless admin workflow is implemented.

## Final Recommendation

Search Analytics privacy and retention guardrails are ready for the next runtime-only logging implementation phase. Start with non-blocking `food_search_events` writes only, keep metadata allowlisted, limit query length, avoid noisy `no_selection`, and defer review queue/admin workflows to a separate step.
