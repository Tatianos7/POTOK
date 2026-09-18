# Today Goal Lookup User Scoping Implementation

- Date: 2026-09-17
- Branch: `master`
- Base HEAD: `896e31f document today goal lookup user scoping audit`
- Source audit: `reports/today-goal-lookup-user-scoping-audit-2026-09-17.md`
- Target package: `POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_IMPLEMENTATION`
- Verdict: **POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_IMPLEMENTATION_READY**

## Executive Summary

Today goal lookup is now scoped to the current authenticated user.

The old behavior scanned every localStorage key with the `goal_` prefix and accepted the first parsable goal. The new helper reads only the exact key `goal_<currentUserId>` and fails closed to the no-goal state when the user ID, exact key, payload, or storage is unavailable.

No existing localStorage keys are deleted, rewritten, logged, or migrated. Goal calculation, `goalService`, Progress calculations, Premium behavior, payment, recipes, diary writes, SQL, RLS, Supabase, staging, and production are unchanged.

## Files Changed

Runtime:

- `src/utils/todayGoalSummary.ts`
- `src/pages/Today.tsx`
- `src/pages/Dashboard.tsx`
- `src/App.tsx`

Tests:

- `src/utils/__tests__/todayGoalSummary.test.ts`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`
- `src/components/__tests__/PremiumRoute.test.tsx`

Report:

- `reports/today-goal-lookup-user-scoping-implementation-2026-09-17.md`

## Runtime Behavior

`getTodayGoalSummaryForUser(currentUserId)` now:

- returns no goal when `currentUserId` is missing or blank;
- reads only `goal_<currentUserId>`;
- returns no goal when that exact key is missing;
- returns no goal when that exact payload is malformed or invalid;
- returns no goal when storage is unavailable or throws;
- never scans or falls back to another `goal_*` key.

`Today` now accepts `currentUserId` and keeps the loaded summary tagged with the user ID it belongs to. If the prop changes, a summary belonging to the previous ID is excluded from rendering immediately, then the effect resolves the new user's exact key.

Demo goal query fixtures remain separate and continue to take precedence only when an explicit demo query parameter is present.

## Wiring

- Standalone `/today` receives `user?.id` from `AppRoutes`.
- Premium Home embedded Today receives `user?.id` from Dashboard.
- Free no-goal embedded Today receives `user?.id` from Dashboard.
- `PremiumRoute` remains unchanged and continues to protect `/today`.

## Missing, Malformed, And Stale Goals

- Missing current-user key: Today renders the no-goal state.
- Malformed current-user payload: Today renders the no-goal state.
- Valid stale goal for another user: ignored.
- Multiple `goal_*` keys: only the exact current-user key can affect Today.
- Account switch in a mounted tree: the previous user's tagged summary is not rendered for the new user ID.

## Test Coverage

Focused helper coverage includes:

- exact current-user key lookup;
- other-user goal exclusion;
- deterministic behavior with multiple goal keys;
- malformed current-user payload without fallback;
- missing key and missing user ID;
- unavailable and throwing storage;
- sequential lookup after user switching.

Today/Dashboard/route regression coverage includes:

- removal of the global localStorage scan;
- owner-tagged state and `currentUserId` effect dependency;
- explicit demo-goal query behavior;
- user ID wiring for standalone and both embedded Today paths;
- unchanged PremiumRoute coverage;
- unchanged Progress Hub goal behavior.

## Verification

- Focused Today/Dashboard/helper/PremiumRoute tests: `81/81` passed.
- Extended Today/Dashboard/helper/PremiumRoute/Progress Hub suite: `110/110` passed.
- `npm run build`: passed.
- Build emitted existing non-blocking warnings about bundle size, browser data age, and the known mixed static/dynamic `mealService` import.
- `git diff --check`: passed.

## Hidden Risks

- Today still reads its user goal from localStorage while Dashboard Progress can resolve a remote goal. Source unification remains a separate package and is not required for this privacy fix.
- Existing stale keys remain in the browser by design. They are now ignored by other users but are not cleaned up.
- The existing Node test environment has no mounted browser DOM, so account-switch protection is covered by pure sequential helper tests plus the owner-tagged state/source contract. A browser smoke can add confidence after deploy without reading or modifying unrelated localStorage keys.

## Safety Confirmation

- No goal formula change.
- No `goalService` change.
- No Progress calculation change.
- No Premium business logic change.
- No PremiumRoute change.
- No payment or recipe change.
- No diary write change.
- No localStorage cleanup or migration.
- No SQL, DB schema, RLS, or Supabase change.
- No staging or production mutation.
- No PR.
- No commit.

## Final Verdict

**POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_IMPLEMENTATION_READY**
