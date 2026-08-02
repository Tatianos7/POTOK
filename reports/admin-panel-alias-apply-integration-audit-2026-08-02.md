# Admin Panel Alias Apply Integration Audit

- Timestamp: 2026-08-02T00:00:00Z
- Scope: read-only audit/design for integrating Alias Apply into the existing Admin Panel
- Context: Search Analytics/Admin Review MVP is production-smoke ready
- Verdict: **ADMIN_PANEL_ALIAS_APPLY_INTEGRATION_READY**

## Safety

- This is a read-only audit/report.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No aliases were added.
- No foods were created.
- No import/backfill/recompute was run.
- No PR was created.

## Reviewed Files

- `src/App.tsx`
- `src/pages/AdminPanel.tsx`
- `src/pages/SearchAnalyticsAdminReview.tsx`
- `src/services/searchAdminReviewService.ts`
- `src/context/AuthContext.tsx`
- `src/services/profileService.ts`
- `src/pages/Dashboard.tsx`
- `supabase/migration_drafts/20260801_search_analytics_admin_review_draft.sql`
- `supabase/foods_schema.sql`
- `supabase/food_kb_2_1.sql`
- `reports/search-analytics-admin-review-production-smoke-2026-08-01.md`

## Current Admin Entry Points

Routes:

- `/admin`
  - Component: `src/pages/AdminPanel.tsx`
  - Protected by `ProtectedRoute`
  - Redirects authenticated non-admin users to `/`
  - Main admin surface
- `/admin/search-review`
  - Component: `src/pages/SearchAnalyticsAdminReview.tsx`
  - Protected by `ProtectedRoute`
  - Redirects authenticated non-admin users to `/`
  - Entered from `/admin` through the `Search Review` button
  - Has a back button to `/admin`

Other admin behavior:

- `src/pages/Dashboard.tsx` redirects authenticated admins to `/admin`.
- `AuthContext` exposes `user.isAdmin`.
- Admin status is based on `user_profiles.is_admin`.

Assessment:

- There is one primary Admin Panel: `/admin`.
- `/admin/search-review` is a secondary admin workflow page, not a separate product/admin system.
- No duplicate top-level admin app was found.
- Current Search Review entry is discoverable, but it is header-button based rather than part of the tab system.

## Current Admin Panel Contents

`AdminPanel.tsx` currently includes:

- stats tab;
- messages/support tab;
- users/admin-management tab;
- imports tab with `FoodIngestionPanel`;
- refresh button;
- logout button;
- `Search Review` entry button in the header.

Current tab model:

- `activeTab: 'stats' | 'messages' | 'users' | 'imports'`

Recommended extension:

- Keep `/admin` as the hub.
- Add a dedicated data-quality/search section in the existing tab/nav model.
- Keep `/admin/search-review` as a deep link, but present it as part of the same Admin Panel information architecture.

## Current Search Review Behavior

`SearchAnalyticsAdminReview.tsx`:

- reads frequent `not_found` / `ambiguous` events;
- shows frequency, context, last seen, candidate foods;
- creates/updates pending rows in `food_search_review_queue`;
- supports `approved`, `rejected`, `snoozed`, and comments;
- writes only to `food_search_review_queue`;
- does not insert aliases.

`searchAdminReviewService.ts`:

- reads `food_search_events`;
- reads pending `food_search_review_queue`;
- reads `foods` and `food_aliases` for candidates;
- writes only `food_search_review_queue`;
- has tests asserting it does not write `food_aliases`.

Production smoke:

- `SEARCH_ANALYTICS_ADMIN_REVIEW_PRODUCTION_SMOKE_READY`;
- `foods = 2265` unchanged;
- `food_aliases = 2890` unchanged;
- no aliases or foods were created.

## Alias Apply Product Contract

Alias Apply must be a separate explicit admin step after review approval:

1. Admin reviews analytics query.
2. Admin creates or updates `pending` review queue row.
3. Admin approves row with `suggested_canonical_food_id`.
4. Alias Apply validates the approved row.
5. Alias Apply inserts one row into `food_aliases`.
6. Alias Apply records audit trail.
7. Applied row becomes read-only/terminal for that alias decision.

Non-goals:

- no automatic alias insertion from search;
- no automatic food creation;
- no silent canonical choice for ambiguous queries;
- no diary/favorites/recipes remap;
- no historical nutrition snapshot recompute;
- no Food Core row mutation.

## Alias Apply Validations

Before inserting `food_aliases`, the workflow must validate:

- review row exists;
- row status is `approved`;
- current admin is authenticated and `is_admin = true`;
- `reviewer_id` exists in `auth.users`;
- `suggested_canonical_food_id` is present;
- `suggested_canonical_food_id` exists in `foods.id`;
- target food is an allowed shared target, normally `source in ('core', 'brand')`;
- alias text is non-empty;
- normalized alias is non-empty using DB `normalize_food_text`;
- no existing `food_aliases.normalized_alias` duplicate;
- no existing alias maps the same normalized alias to another canonical food;
- alias is not ambiguous by current review data;
- alias is not identical to a different canonical product name in a way that would hijack obvious intent;
- source event ids remain traceable;
- approved row has not already been applied.

Recommended first behavior for conflicts:

- block apply;
- show reason;
- keep row approved but unapplied, or move to `rejected/snoozed` with admin comment;
- never overwrite an existing alias automatically.

## Recommended UI Integration

Preferred MVP:

- Keep `/admin` as the single admin hub.
- Add a `Search Review` or `Data Quality` tab/section in `AdminPanel.tsx`.
- Keep `/admin/search-review` as the deep-link route for the detailed workflow.
- Add an `Alias Apply` subsection inside Search Review rows for approved queue items.

Suggested row states:

- `pending`: create/update candidates, approve/reject/snooze.
- `approved`: show `Apply alias` action if validation passes.
- `approved / blocked`: show duplicate/orphan/ambiguous validation reason.
- `applied`: show applied alias id, applied by, applied at.
- `rejected/snoozed`: no apply action.

Suggested admin copy:

- `Одобрено к добавлению алиаса`
- `Проверить и добавить алиас`
- `Алиас уже существует`
- `Целевой продукт не найден`
- `Нужна ручная проверка: запрос неоднозначный`

## DB Changes Needed Later

Do not apply in this audit. Prepare a separate draft before implementation.

Recommended DB additions:

- `food_search_review_queue.applied_alias_id uuid references food_aliases(id)`
- `food_search_review_queue.applied_by uuid references auth.users(id)`
- `food_search_review_queue.applied_at timestamptz`
- `food_search_review_queue.apply_error text` or structured metadata
- optional `food_alias_apply_audit` table for immutable audit records

Recommended RPC/function:

- `apply_food_search_review_alias(review_queue_id uuid)`
- `security definer`, admin-guarded
- validates in one transaction;
- inserts exactly one `food_aliases` row;
- records audit metadata;
- never writes to `foods`;
- never mutates diary/favorites/recipes;
- returns structured result:
  - `applied`;
  - `duplicate_alias`;
  - `orphan_canonical`;
  - `ambiguous_alias`;
  - `not_approved`;
  - `already_applied`;
  - `permission_denied`.

Important production schema note:

- Search Analytics migration had to use `user_profiles.id_user = auth.uid()`.
- Older schema files still contain examples with `user_profiles.user_id`.
- Future Alias Apply SQL must confirm the production admin identity column before apply and use the production-correct `id_user` path.

## Runtime Changes Needed Later

Runtime-only pieces after approved DB apply:

- add `aliasApplyService`;
- load approved/unapplied queue rows;
- call admin-only RPC;
- render validation result;
- refresh queue row after apply;
- keep failures non-destructive;
- add targeted tests for duplicate/orphan/permission/apply success paths.

Do not change search ranking/resolver behavior in the first Alias Apply step. Alias effects should come only from the inserted, explicitly approved alias.

## Test Plan Later

Service tests:

- approved row with valid candidate calls RPC;
- pending row cannot be applied;
- rejected/snoozed row cannot be applied;
- duplicate alias returns blocked state;
- orphan canonical returns blocked state;
- already-applied row cannot apply twice;
- non-admin receives permission denied;
- service never calls `foods.insert/update/delete`.

UI tests:

- approved row shows `Apply alias`;
- pending/rejected/snoozed rows do not show apply action;
- duplicate/orphan/ambiguous validation reason is visible;
- successful apply shows applied state;
- Search Review remains reachable from Admin Panel.

DB validation tests, if using SQL/RPC:

- no duplicate `food_aliases.normalized_alias`;
- no orphan `food_aliases.canonical_food_id`;
- `foods` count unchanged;
- diary/favorites/recipes counts unchanged;
- audit record created for applied alias.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Creating a second admin surface | Medium | Keep `/admin` as hub and make Alias Apply a Search Review/Data Quality section |
| Auto alias mutation | High | Require explicit approved row and admin apply action |
| Duplicate alias | High | Block with `food_aliases.normalized_alias` check before insert |
| Orphan canonical target | High | FK and explicit `foods.id` existence check |
| Ambiguous query becomes silent canonical | High | Block ambiguous rows unless admin explicitly selects target and comments |
| Wrong admin identity column | Medium/High | Pre-apply check production `user_profiles.id_user` |
| No audit trail | Medium | Add applied metadata or immutable audit table before apply |
| Brand/OFF pollution | Medium/High | Keep target/source rules explicit; no automatic brand/core promotion |

## Must Fix Now

No must-fix blocker was found for designing Alias Apply as part of the existing Admin Panel.

Do not implement Alias Apply until a separate DB/RPC draft and owner approval exist.

## Safe Deferred

- Merge `/admin/search-review` UI into AdminPanel tabs instead of header button.
- Real non-admin browser smoke for `/admin/search-review`.
- Orphaned admin profile cleanup.
- Search Analytics ambiguous event smoke.
- Retention cleanup for search analytics events.
- Open Food Facts / barcode candidate persistence.

## Final Recommendation

Proceed with Alias Apply as an extension of the existing Admin Panel Search Review workflow:

- keep `/admin` as the single admin hub;
- keep `/admin/search-review` as a deep link for now;
- add approved-row Alias Apply only after a reviewed DB/RPC draft;
- never auto-create aliases from analytics;
- never write `foods`;
- record an audit trail for every applied alias.
