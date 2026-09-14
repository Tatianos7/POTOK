# Premium Route Entitlement Gate Audit

- Date: 2026-09-14
- Branch: `master`
- HEAD: `c6f0bf3 document premium today reference alignment audit`
- Source audit: `reports/premium-today-reference-alignment-audit-2026-09-14.md`
- Target package: `POTOK_PREMIUM_ROUTE_ENTITLEMENT_GATE_AUDIT`
- Verdict: **POTOK_PREMIUM_ROUTE_ENTITLEMENT_GATE_AUDIT_READY**

## Scope

Read-only audit of current Premium and paid-adjacent routes, authentication protection, Premium entitlement enforcement, demo Premium behavior, navigation visibility, and the smallest reusable route-gate pattern.

This is audit/report-only. Runtime code and UI were not changed, SQL was not executed, Supabase/staging/production were not touched, payment enforcement and Premium business logic were not changed, no DB schema/RLS changes were made, and no commit or PR was created.

## Executive Summary

Authentication protection exists, but route-level Premium entitlement protection does not exist for the two current Premium product surfaces:

- `/today`;
- `/premium-recipes`.

Both routes are wrapped in the generic `ProtectedRoute`. That component checks only `authStatus`; it does not inspect `user.hasPremium`, demo Premium access, or server entitlements. An authenticated Free user can therefore open both Premium routes directly by URL.

Navigation is more restrictive than routing:

- Premium Home is rendered only when `user.hasPremium || hasDemoPremiumAccess()` is true;
- `Сборник рецептов` appears in `Ещё` only under the same effective Premium condition;
- hiding these entry points does not protect `/today` or `/premium-recipes` from direct navigation.

The smallest reusable UI solution is a composed `PremiumRoute` guard using the same effective Premium predicate already used by Dashboard and App Shell. It should preserve authentication behavior, allow intentional demo access, and redirect an authenticated Free user to `/paywall` without changing payment or Premium business logic.

This client-side guard would be an application UX boundary, not a data-security boundary. The tracked Premium catalog SQL allows regular authenticated users to read active catalog rows. Any requirement to make Premium catalog data itself inaccessible to Free clients needs a separate server/RLS/RPC audit and explicit owner approval.

## Route Inventory

| Route | Current role | Auth required | Route-level Premium gate | Free direct URL | Demo Premium behavior | Current no-Premium result |
| --- | --- | --- | --- | --- | --- | --- |
| `/today` | Primary Premium Today / `Мой Поток` surface | Yes, via `ProtectedRoute` | No | Allowed | Demo flag affects Home/nav, but is not required by this route | Full Today surface renders |
| `/premium-recipes` | Premium Recipe Collection | Yes, via `ProtectedRoute` | No | Allowed | Demo flag reveals the menu entry, but is not required by this route | Recipe library renders |
| `/paywall` | Free-to-Premium entry and demo access screen | Yes, via `ProtectedRoute` | Correctly no | Allowed by design | Can set or clear local demo access | Paywall and demo CTA render |
| `/my-program` | Legacy/current program overview with mixed-tier behavior | Yes, via `ProtectedRoute` | No route gate | Allowed | Demo flag is not used | Service resolves Free tier; some capabilities are feature-gated |
| `/pose` | Mixed Free/Premium Pose Coach | Yes, via `ProtectedRoute` | No route gate by design | Allowed | Demo flag does not grant server entitlement | Free post-analysis mode; realtime is entitlement-gated in page runtime |
| `/coach-history` | Coach/AI-adjacent history surface | Yes, via `ProtectedRoute` | No | Allowed | Demo flag is not used | History surface attempts to load; product tier ownership is not explicit |

## Confirmed Premium Routes

### `/today`

Current protection:

- unauthenticated users are redirected to `/auth`;
- authenticated users are allowed regardless of Premium status;
- `Today` itself does not check `user.hasPremium` or demo access.

Implication:

- a Free authenticated user can bypass Home state and open `/today` directly;
- demo access is not an access requirement for the route;
- the route does not show a paywall or a locked state when Premium is absent.

### `/premium-recipes`

Current protection:

- unauthenticated users are redirected to `/auth`;
- authenticated users are allowed regardless of Premium status;
- `PremiumRecipes` has no internal entitlement check.

Implication:

- Free users do not see `Сборник рецептов` in `Ещё`;
- a Free authenticated user can still open `/premium-recipes` directly;
- current navigation behavior is not route enforcement.

## Paid-Adjacent Routes

### `/paywall`

This route should remain accessible to authenticated Free users. It is the conversion/demo entry and must not be wrapped in a Premium-only guard.

Current behavior:

- purchase controls remain disabled;
- `Посмотреть демо Premium` sets a local demo flag and navigates to `/today`;
- it does not mutate profile Premium status or call payment APIs.

### `/my-program`

Current reports describe `/my-program` as a legacy/current program overview rather than the primary Premium Today route.

Current service behavior is mixed-tier:

- active program reads explicitly allow `free`, `pro`, `coach`, and `vision_pro` tiers;
- explainability, feedback, generation, and adaptation have separate entitlement behavior;
- the page passes `user.hasPremium` into presentation/runtime context but has no route gate;
- demo Premium access is not considered.

Conclusion:

- do not add a blanket Premium route gate to `/my-program` in the first implementation package;
- owner must first decide whether the overview remains mixed-tier, becomes Premium-only, or is retired in favor of Today.

### `/pose`

`/pose` is not currently a Premium-only route:

- the page is available to authenticated Free users;
- it calls `entitlementService.canRealtimePose(user.id)`;
- allowed users receive realtime behavior;
- Free users receive the explicit post-analysis mode.

Conclusion:

- keep the route accessible;
- retain feature-level server-backed gating;
- do not treat local demo Premium as a substitute for realtime entitlement.

### `/coach-history`

The route is authentication-only and contains coach/trust history behavior, but no current route entitlement or explicit product-tier contract was found.

Conclusion:

- classify as paid-adjacent/undecided;
- do not gate it in the first implementation package without owner confirmation.

## Navigation Versus Enforcement

Current navigation rules are correct but incomplete as enforcement:

- Dashboard computes `effectiveHasPremium = user?.hasPremium || hasDemoPremiumAccess()`;
- App Shell computes the same condition for `AppBottomNavigation`;
- Free `Ещё` contains `Замеры`, `Прогресс`, and `Профиль`;
- Premium/demo `Ещё` additionally contains `Сборник рецептов`;
- Premium Home embeds `Today`; Free Home does not.

These conditions only decide what is rendered or linked. React route resolution still allows any authenticated user into both Premium routes.

Rule confirmed:

- hidden navigation item is not a route-level access check;
- route-level client check is not server-side data protection.

## Demo Premium Assessment

Current demo access:

- is stored as `potok_premium_demo_access = true` in local storage;
- is enabled and cleared only from `/paywall`;
- is honored by Dashboard and App Shell navigation;
- is not read by `/today`, `/premium-recipes`, `/my-program`, or `/pose` themselves.

Consequences:

- direct access to `/today` and `/premium-recipes` works even without enabling demo;
- demo state is browser-global rather than user-scoped;
- the flag can survive logout/account switching because auth cleanup does not clear it;
- demo access does not grant server entitlements and must not unlock server-gated capabilities such as realtime Pose.

Recommended demo contract for a future gate:

- real Premium OR explicit demo flag may pass the UI route guard for the approved read-only demo surfaces;
- demo must never mutate `profiles.has_premium`;
- demo must not be accepted by server write paths or server entitlement checks;
- owner should decide whether demo state should be cleared on logout or scoped to a user/session.

## Entitlement Sources

Current sources are not unified:

- `user.hasPremium` comes from `profiles.has_premium` in `AuthContext`;
- local demo access comes from `demoPremiumAccess`;
- `entitlementService` calls server RPCs such as `get_entitlements` and `get_paywall_state`;
- `AuthContext.entitlements` exists but is initialized/reset only and is not populated by current auth bootstrap;
- feature services use their own entitlement checks for selected program/Pose capabilities.

For the smallest route-gate package, reusing the current Home/App Shell predicate minimizes behavior drift. Replacing it with the server entitlement RPC is a broader access architecture change and should be planned separately.

## Minimal Reusable Gate Pattern

Recommended implementation shape:

- add a small `PremiumRoute` or `PremiumAccessRoute` component;
- compose or mirror `ProtectedRoute` booting/unauthenticated behavior;
- compute one shared `hasEffectivePremiumAccess(user)` predicate;
- allow when `user.hasPremium === true`;
- allow when approved demo access is enabled;
- redirect authenticated Free users to `/paywall`;
- optionally preserve the requested route in navigation state for a future post-purchase return flow;
- apply initially only to `/today` and `/premium-recipes`;
- leave `/paywall`, `/my-program`, `/pose`, and `/coach-history` unchanged until their product contracts are approved.

Required focused tests:

- unauthenticated Premium route redirects to `/auth`;
- authenticated Free `/today` redirects to `/paywall`;
- authenticated Free `/premium-recipes` redirects to `/paywall`;
- real Premium can open both routes;
- demo Premium can open both routes;
- `/paywall` remains available to Free users;
- `/my-program` and `/pose` keep current mixed-tier behavior;
- bottom-nav visibility and route enforcement use the same effective access helper.

## Data Enforcement Limitation

The tracked Premium data-model SQL grants authenticated users read access to active Premium catalog rows. Therefore:

- a React route guard can prevent normal UI navigation;
- it cannot prevent a knowledgeable authenticated Free client from calling permitted catalog reads directly;
- actual staging/production policy state was not checked in this report because Supabase access was prohibited.

If Premium catalog content must be protected as paid data, a later package must audit and design server/RLS/RPC enforcement. Do not silently change catalog RLS in the UI gate implementation package.

## Gaps

### Confirmed

- `/today` lacks Premium route enforcement;
- `/premium-recipes` lacks Premium route enforcement;
- demo access is not required for direct access and is not user-scoped;
- Premium access calculation is duplicated between Dashboard and App Shell;
- no route-gate tests cover Free direct URL behavior;
- client UI access and server catalog read policy do not form one entitlement contract.

### Requires Product Decision

- whether `/my-program` remains mixed-tier;
- whether `/coach-history` is FREE, PREMIUM, or internal/later;
- whether demo access survives logout and account switching;
- whether active Premium catalog rows are intentionally readable by every authenticated user;
- whether a Premium user with profile-load timeout should see a temporary loading state or the paywall.

## Risks

- Free users can open current Premium UI by direct URL.
- Navigation tests can pass while paid route enforcement remains absent.
- A client-only gate may create false confidence if catalog RLS remains authenticated-readable.
- Duplicated Premium predicates can drift between Home, bottom navigation, and routes.
- A persisted browser-global demo flag can expose demo navigation to another account on the same browser.
- Redirecting before Premium profile resolution is reliable can incorrectly send a paid user to `/paywall`.
- Broadly gating `/my-program` or `/pose` would regress existing mixed-tier behavior.

## Recommended Implementation Package

Recommended next small package:

- `POTOK_PREMIUM_ROUTE_ENTITLEMENT_GATE_IMPLEMENTATION_READY`

Strict scope:

- centralize the existing effective Premium predicate;
- add a reusable route-level UI guard;
- protect only `/today` and `/premium-recipes`;
- preserve current auth and demo behavior;
- keep `/paywall` Free-accessible;
- add focused route tests;
- do not change payment, Premium business logic, SQL, RLS, or server entitlement behavior.

Separate later package, only if owner requires data-level paid protection:

- `POTOK_PREMIUM_CATALOG_SERVER_ENTITLEMENT_AUDIT_READY`.

## Owner Approval Required

Owner approval is required before:

- implementing route-level Premium redirects;
- deciding whether demo access counts as permitted access to both Premium routes;
- clearing or user-scoping demo access;
- changing `/my-program` or `/coach-history` tier ownership;
- changing Premium catalog RLS/RPC rules;
- replacing `profiles.has_premium` with another entitlement source;
- adding payment enforcement or post-purchase redirects.

## Safety Confirmation

Confirmed for this package:

- audit/report-only;
- no runtime code changes;
- no UI changes;
- no SQL execution;
- no Supabase access or mutation;
- no staging or production mutation;
- no DB schema or RLS changes;
- no Premium business-logic changes;
- no payment enforcement;
- no API keys or secrets used;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**POTOK_PREMIUM_ROUTE_ENTITLEMENT_GATE_AUDIT_READY**
