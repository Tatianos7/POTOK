# Premium Today Reference Alignment Audit

- Date: 2026-09-14
- Branch: `master`
- HEAD: `861ac2a add app bottom navigation shell`
- Reference report: `reports/premium-flow-reference-extraction-2026-09-13.md`
- Target package: `POTOK_PREMIUM_TODAY_REFERENCE_ALIGNMENT_AUDIT`
- Verdict: **POTOK_PREMIUM_TODAY_REFERENCE_ALIGNMENT_AUDIT_READY**

## Scope

Read-only audit of the current `/today`, `/premium-recipes`, Premium Dashboard/Home, and bottom-navigation overflow against the source-grounded Premium flow reference.

This audit checks product alignment and code boundaries only. Runtime code and UI were not changed, SQL was not executed, Supabase/staging/production were not touched, Premium write paths were not added, DB schema/RLS were not changed, and no commit or PR was created.

## Executive Summary

Current alignment is safe but incomplete.

Already aligned:

- Premium Home directly reuses the existing `Today` surface through `<Today embeddedInAppShell />`;
- there is no CTA-only `Открыть день` gateway and no separate mock dashboard above Today;
- a Premium user without a detected goal is sent to the existing `/goal` calculation flow;
- a user with a goal sees the existing `Мой Поток` plan surface;
- Today contains 14-day plans, day calories/macros, four day states, meals, meal details, a workout summary, and a shopping list;
- `Сборник рецептов` is visible in `Ещё` only when the shell resolves Premium access;
- current Premium plan/catalog surfaces are read-only and do not automatically write food or workout diary facts;
- Workout Progress, History, Repeat, and Workout Diary MuscleMap continue to read completed workout entries, including the active `deleted_at is null` contract.

Main gaps:

- `/premium-recipes` is authenticated-only at route level, not Premium-entitlement protected; a Free authenticated user can potentially open the URL directly even though the menu item is hidden;
- goal discovery in `Today` scans the first parsable local-storage key prefixed with `goal_` instead of reading the current user's exact key, which is unsafe on a shared browser with multiple local users;
- the workout card has no `Облегчить`, `Заменить`, or `Начать` actions;
- meal/day confirmation is not implemented: diary/day actions remain disabled, while meal replacement changes local UI state only;
- Today and Recipe Collection can fall back to demo data, so presence of the surface does not by itself prove production Premium catalog completeness.

No blocker prevents this audit from being marked ready. The current implementation should be described as a read-only Premium Today foundation, not as the complete reference execution loop.

## Alignment Matrix

| Area | Status | Current evidence | Gap |
| --- | --- | --- | --- |
| Premium without goal | Green with risk | `Today` shows `Рассчитать цель` and navigates to `/goal`; `/goal` uses existing goal projection utilities. | Goal lookup is not scoped to the current user key. |
| Premium with goal | Green | `Dashboard` renders `<Today embeddedInAppShell />` directly. | Catalog may use demo fallback. |
| CTA-only/mock Home | Green | No intermediate `Открыть день` card or invented Premium summary blocks remain. | None in current audited surface. |
| Day calories/macros | Green | Day detail renders calories and macro details. | The information is present even though it is not headed by the exact label `КБЖУ дня`. |
| Day state | Green/read-only | Four reference states are available. | State is local UI state and does not yet drive an approved adaptation contract. |
| Meals | Green/read-only | Meal cards and detail include calories/macros, ingredients, portion hints, preparation, and replacement. | No meal confirmation contract; replacement is local state only. |
| Workout | Partial | Day detail shows workout title, duration, and focus. | Missing simplify, replace, and start actions. |
| Day confirmation | Deferred | Disabled `Подтвердить день` explicitly states that no data is written. | Execution/confirmation contract is not implemented. |
| Recipe entry in `Ещё` | Green | Premium overflow includes `/premium-recipes`; Free overflow does not. | Visibility is not equivalent to entitlement enforcement. |
| Recipe route/content | Partial | Existing route renders categories and recipe details with KBJU, ingredients, hints, and preparation. | Direct route lacks Premium gate; plan/diary buttons are intentionally disabled. |
| Planned/completed boundary | Green by static audit | Premium surfaces use catalog reads and local state; completed-fact services remain separate. | Future action implementation can breach this boundary without explicit contracts and tests. |

## Goal Gate Assessment

For a Premium user without a detected goal:

- `Today` renders the existing no-goal state;
- `Рассчитать цель` navigates to `/goal`;
- the existing goal flow uses `goalProjection` calculations such as `calculateGoalTimeline`, `calculateTargetCalories`, and `calculateMacros`;
- no simplified formula from the prototype was copied into Today.

For a Premium user with a detected goal:

- Dashboard shows the existing Today content directly;
- embedded mode removes the duplicate standalone `Мой Поток` header and close action but preserves goal context, plans, and actions;
- standalone `/today` preserves its own route-level presentation.

Hidden goal risk:

- `getStoredGoalSummary()` scans all local-storage keys beginning with `goal_` and returns the first valid payload;
- it does not receive the authenticated user ID;
- on a shared browser or after account switching, Today may resolve a stale goal belonging to another locally stored account.

This does not introduce the prototype formula, but it should be hardened before relying on Today as a production user-specific Premium gate.

## Today Assessment

Present now:

- 14-day plan selection and plan-day navigation;
- day calories and macro details;
- states `Обычный день`, `Нет сил`, `Нет времени`, and `Готова работать`;
- daily meal cards;
- meal detail with grams/ingredients, portion hints, preparation, and replacement choices;
- workout title, duration, and focus when a workout exists;
- derived shopping list for 1 / 2 / 3 / 7 days;
- explicit read-only messaging where confirmation/write behavior is not connected.

Missing or incomplete against the reference:

- no workout `Облегчить` action;
- no workout `Заменить` action;
- no workout `Начать` action;
- no active meal confirmation;
- no active whole-day confirmation;
- day-state selection does not yet apply an approved plan adaptation rule;
- plan selection and confirmation do not persist an owner-approved Premium execution state.

These gaps are product-contract work, not justification for automatic diary writes.

## Recipe Collection Assessment

Current strengths:

- `Сборник рецептов` is in bottom-nav overflow `Ещё`, not among the five primary tabs;
- the shell shows the entry for Premium users and omits it for Free users;
- `/premium-recipes` is an existing route;
- categories and recipe details include KBJU, ingredients, portion guidance, and preparation;
- `Добавить в план` and `Добавить в дневник` are disabled, preserving the no-automatic-write rule.

Entitlement gap:

- `/premium-recipes` uses the generic authenticated `ProtectedRoute`;
- `ProtectedRoute` checks authentication only;
- `PremiumRecipes` has no independent Premium entitlement check;
- therefore the collection is Premium-only in navigation, but not demonstrably Premium-only by direct URL.

Any route-level Premium enforcement is a separate owner-approved package because it affects entitlement/payment behavior.

## Planned vs Completed Boundary

Static code review found no automatic diary bridge from `Today` or `PremiumRecipes`:

- no call to workout add/copy/update services;
- no food diary insert/upsert path;
- no automatic confirmation write;
- meal replacement and shopping checkmarks stay in local component state;
- `premiumCatalogService` methods used here perform catalog reads.

Completed workout consumers remain separate:

- Workout History reads persisted workout entries;
- Repeat uses active completed source entries;
- Workout Progress reads workout progress observations;
- Workout Diary MuscleMap is built from active diary entries;
- soft-deleted entries are filtered by the workout service and do not become active facts.

No import or call path was found that feeds Premium planned meals/workouts into Progress, History, Repeat, or MuscleMap.

## Gaps And Priority

### MVP Next

- audit and define Premium route entitlement behavior for direct URLs;
- scope Today goal lookup to the current authenticated user;
- define contracts for `Облегчить`, `Заменить`, `Начать`, and `Подтвердить` before implementation;
- add explicit boundary tests proving that planned actions do not create completed facts without user confirmation.

### Later

- persist selected plan and execution state after schema/RLS approval;
- implement day-state adaptation rules after product and safety approval;
- add explicit recipe-to-plan and recipe-to-diary confirmation flows;
- connect workout start to a reviewed planned-to-execution handoff without creating a completed workout automatically;
- implement 14-day recalculation only after its inputs and safety rules are approved.

## Hidden Risks

- Navigation-only Premium hiding can be mistaken for real entitlement enforcement.
- Unscoped local goal lookup can display the wrong goal after account switching.
- Demo fallback can make an incomplete production catalog look functionally complete during a shallow smoke.
- A future `Подтвердить` implementation could accidentally mix planned state and completed diary facts if contracts are not defined first.
- Workout `Начать` can be implemented incorrectly as an automatic completed entry rather than an explicit execution flow.

## Recommended Next Package

Recommended next small package:

- `POTOK_PREMIUM_ROUTE_ENTITLEMENT_GATE_AUDIT_READY`

Scope:

- read-only inventory of all Premium routes and current entitlement checks;
- verify direct-route behavior for Free, Premium, and demo Premium users;
- identify the smallest reusable gate pattern;
- document payment/access dependencies;
- do not implement payment enforcement without owner approval.

After that audit, prepare a separate advisory contract package for Today actions:

- `POTOK_PREMIUM_TODAY_ACTIONS_CONTRACT_DRAFT_READY`.

## Owner Approval Required

Owner approval is required before:

- adding route-level Premium/payment enforcement;
- changing how demo Premium access behaves;
- changing goal storage or migration behavior;
- implementing or persisting day-state adaptations;
- implementing meal/day confirmation;
- implementing workout replace/simplify/start behavior;
- writing any planned meal or workout into a completed diary;
- adding schema, RLS, or Premium write paths.

## Safety Confirmation

Confirmed for this package:

- audit/report-only;
- no runtime code changes;
- no UI changes;
- no SQL execution;
- no Supabase access or mutation;
- no staging or production mutation;
- no DB schema or RLS changes;
- no Premium writes;
- no payment enforcement;
- no API keys or secrets used;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**POTOK_PREMIUM_TODAY_REFERENCE_ALIGNMENT_AUDIT_READY**
