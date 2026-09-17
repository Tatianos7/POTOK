# Today Goal Lookup User Scoping Audit

- Date: 2026-09-17
- Branch: `master`
- HEAD: `238b67a fix github pages spa route restore marker`
- Target package: `POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_AUDIT`
- Verdict: **POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_AUDIT_READY**

## Scope

Read-only audit of goal persistence and lookup paths used by Today, Dashboard, Food Diary, and Progress.

This package does not change runtime code or UI, does not read or mutate a user's browser storage, does not migrate or delete local keys, does not execute SQL, does not touch Supabase/staging/production, and does not create a commit or PR.

## Executive Summary

The user-scoping risk is confirmed.

Most current goal paths are already scoped by authenticated user ID:

- the canonical local key is `goal_${user.id}`;
- goal create/edit writes use the current user ID;
- `goalService`, Food Diary, AI advice, Dashboard Progress, and Progress use an explicit user ID;
- persisted `user_goals` reads and writes use `user_id`.

Today is the exception. `getStoredGoalSummary()` enumerates every local-storage key beginning with `goal_` and returns the first parsable goal payload. It does not receive the current authenticated user ID and the payload itself does not carry a trusted owner ID.

On a shared browser or after account switching, Today can therefore display another locally cached user's goal. The minimal safe fix is to make Today read only `goal_${currentUserId}`, return the no-goal state when that exact key is absent or invalid, and reset the resolved summary whenever the current user ID changes.

Recommended next package:

- `POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_IMPLEMENTATION_READY`

## Goal Storage Inventory

| Path | Read/write behavior | User scope | Assessment |
| --- | --- | --- | --- |
| `src/pages/GoalResult.tsx` | Calls `goalService.saveUserGoal(user.id, ...)` after the existing goal calculation. | Explicit current user ID. | Safe for this issue. |
| `src/pages/Goal.tsx` | Loads through `uiRuntimeAdapter.getGoalState(user.id)` and exact `goal_${user.id}` fallback; writes exact `goal_${user.id}`. | Explicit current user ID. | Safe for this issue. |
| `src/services/goalService.ts` | Reads/writes `public.user_goals` by `user_id`; local fallback is `goal_${userId}`. | Explicit method user ID, with session-user validation on remote paths. | Safe for this issue. |
| `src/pages/FoodDiary.tsx` | Reads `goal_${user.id}` when runtime targets are unavailable. | Explicit current user ID. | Safe for this issue. |
| `src/hooks/useAiAdvice.ts` | Calls `goalService.getUserGoal(user.id)` and reads `goal_${user.id}` for additional fields. | Explicit current user ID. | Safe for this issue. |
| `src/services/progressHubService.ts` | Receives `userId` and calls `goalRepo.getUserGoal(userId)`; Dashboard and Progress pass `user.id`. | Explicit current user ID. | Safe for this issue. |
| `src/services/progressAggregatorService.ts` and nutrition/workout consumers | Read goal targets through `goalService.getUserGoal(userId)`. | Explicit current user ID. | Safe for this issue. |
| `src/pages/Today.tsx` | Enumerates `Object.keys(window.localStorage)`, filters `goal_*`, and returns the first parsable goal. | No authenticated user binding. | Unsafe; fix required. |

## Current Local Contract

Current key format:

- `goal_<user_id>`.

Current payload can contain:

- `goalType`;
- current/start/target weight;
- calories and macros;
- dates and projection metadata;
- profile-derived goal inputs such as age, height, lifestyle, intensity, and training place.

The payload does not provide a reliable owner field. Ownership is represented by the key suffix, so scanning arbitrary `goal_*` keys discards the only available local ownership boundary.

No unscoped goal write was found in the current runtime paths reviewed. The issue is the Today lookup strategy, not the goal formula or save key.

## Risk Scenarios

### Multiple Goal Keys

If local storage contains `goal_user_a`, `goal_user_b`, and other legacy `goal_*` entries, Today returns the first parsable payload in browser key enumeration order.

Consequences:

- result depends on storage history rather than the authenticated account;
- a malformed first key can be skipped and a different user's valid key selected;
- adding or recreating keys can change which goal appears without any account data change.

### Account Switching / Shared Browser

Logout does not remove another account's local goal cache, which is reasonable for offline fallback. After a different user logs in, Today can still select the previous user's key because it scans globally.

The current component also retains `goalSummary` in React state. A safe implementation must update or clear this state when `currentUserId` changes; changing only the storage lookup function is not sufficient for an account switch that does not remount Today.

### Premium And Demo Premium

Dashboard embeds Today for real Premium and approved demo Premium access.

With a stale goal from another user, the current account can see:

- another goal label and weight trajectory;
- the goal-present plan surface instead of the no-goal state;
- plan/catalog content enabled from the wrong local goal-presence decision.

Demo query fixtures such as `demoGoal=1` are a separate existing test/demo contract. The scoping fix should preserve them and prevent the generic local fallback from overriding ownership.

### Free User

Dashboard's Progress lookup is already user-scoped. It can correctly decide that the current Free user has no goal and embed the Today no-goal surface with the Premium discovery entry.

Today can then scan another user's goal and replace that expected no-goal presentation with a goal-present surface. This creates a mismatch between the user-scoped Dashboard decision and the unscoped embedded Today state.

Authenticated Free direct `/today` remains protected by `PremiumRoute`; that entitlement behavior is separate and must not change in this package.

## Recommended Minimal Fix

Implement only user-scoped local lookup for Today.

Recommended contract:

1. Today receives the authenticated `currentUserId` from its existing callers.
2. Local lookup reads exactly `goal_${currentUserId}`.
3. If `currentUserId` is missing, return no local goal.
4. If the exact key is missing, malformed, or has no goal payload, return no-goal state.
5. Do not scan or fall back to any other `goal_*` key.
6. Re-resolve and clear/update `goalSummary` whenever `currentUserId` changes.
7. Preserve explicit demo-goal query fixtures independently from local account lookup.
8. Do not delete, rename, rewrite, or migrate existing keys.
9. Do not change Supabase, goal calculation, Premium plans, entitlement, or diary behavior.

Preferred small implementation shape:

- extract a pure Today goal-summary parser/resolver that accepts `currentUserId` and a storage-like reader;
- pass `user?.id` from `AppRoutes` to standalone Today;
- pass `user?.id` from Dashboard to embedded Today;
- make Today state react to `currentUserId` changes.

This keeps Today testable without coupling its presentational component directly to AuthContext.

## Likely Files Affected

Runtime:

- `src/pages/Today.tsx`;
- `src/pages/Dashboard.tsx`;
- `src/App.tsx`;
- optional focused helper such as `src/utils/todayGoalSummary.ts`.

Tests:

- `src/utils/__tests__/todayGoalSummary.test.ts` if the helper is extracted;
- `src/pages/__tests__/TodayPaidEntry.test.tsx`;
- `src/pages/__tests__/DashboardFeatureBadges.test.ts`;
- `src/components/__tests__/PremiumRoute.test.tsx` as a regression run, with no expected gate change;
- `src/services/__tests__/progressHubService.test.ts` as a regression run, with no expected service change.

No goal formula, SQL, schema, RLS, storage migration, or cleanup file should be affected.

## Tests Needed

Focused lookup tests:

- current user receives the goal stored at `goal_<current_user_id>`;
- another user's valid goal is ignored;
- several `goal_*` keys cannot change the current user's result;
- malformed current-user goal returns no goal and does not fall through to another user;
- missing current-user key returns no-goal state;
- missing user ID returns no-goal state;
- unavailable/throwing storage returns no-goal state.

Component/wiring tests:

- standalone `/today` receives the current authenticated user ID;
- embedded Premium Today receives the current user ID;
- embedded Free/no-goal Today receives the current user ID;
- changing the user ID clears/replaces the previous goal summary;
- explicit demo-goal query behavior remains available;
- Dashboard continues to render user-scoped Free, Premium, and no-goal branches.

Regression tests:

- Dashboard/Today tests remain green;
- ProgressHub continues to call `getUserGoal(userId)`;
- Progress calculations and goal targets remain unchanged;
- PremiumRoute behavior remains unchanged.

## Hidden Risks

- Today currently reads only local goal summary fields, while Dashboard Progress can use the remote `user_goals` source. Exact local scoping fixes cross-user leakage but does not unify remote/local source precedence.
- A current user with a remote goal but no local cache may still see a no-goal Today state. Source unification is a separate package and should not be mixed into this small fix.
- Component state must reset on user ID change; an exact lookup performed only once can still retain the previous account's in-memory summary.
- Malformed current-user data should fail closed to no-goal, not fall back to another key.
- Existing `goal_*` caches may contain sensitive goal details. This package must not enumerate, log, migrate, or delete them.

## FREE / PREMIUM Boundary

This fix is shared account-safety infrastructure:

- FREE Dashboard/no-goal presentation must not inherit another user's goal;
- Premium/demo Today must not expose another user's goal or unlock the goal-present presentation from stale local data;
- Premium entitlement and payment behavior remain unchanged;
- planned Premium data remains separate from completed diary and Progress facts.

## MVP vs Later

MVP now:

- exact current-user local key lookup;
- fail-closed no-goal behavior;
- account-switch state reset;
- focused tests.

Later, only with separate owner approval:

- unify Today with the remote-first `goalService`/runtime adapter source;
- define cache freshness/version metadata;
- review explicit local cache cleanup or migration policy.

## Owner Approval Required

Owner approval is required before:

- changing Today runtime lookup;
- changing Today source precedence from local to remote;
- migrating or deleting old local keys;
- changing goal calculations or persistence;
- making any SQL/RLS/Supabase change.

## Verification

- `git diff --check`: passed.

## Safety Confirmation

- audit/report-only;
- no runtime or UI changes;
- no localStorage read, cleanup, or migration;
- no SQL execution;
- no Supabase/staging/production access or mutation;
- no DB schema/RLS changes;
- no payment or Premium business-logic changes;
- no diary writes;
- no PR;
- no commit.

## Final Verdict

**POTOK_TODAY_GOAL_LOOKUP_USER_SCOPING_AUDIT_READY**
