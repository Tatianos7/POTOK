# Today Premium Read-Only UX Polish Plan

- Date: 2026-08-30
- Branch: `master`
- Source blocker commit: `734d3f0 today premium behavioral rls secure preflight retry blocker`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Target package: `TODAY_PREMIUM_READ_ONLY_UX_POLISH`
- Verdict: **TODAY_PREMIUM_READ_ONLY_UX_POLISH_PLAN_READY**

## Scope

Prepare a safe UX polish plan for Premium read-only runtime surfaces while behavioral RLS execution remains blocked.

This is a plan/report-only package. No runtime code was changed, no config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no table reads or network calls were made, no secrets/JWTs were collected, and no PR was created.

## Source Materials Reviewed

- `reports/today-premium-read-only-runtime-final-status-2026-08-29.md`
- `reports/today-premium-read-only-mounted-async-test-layer-final-status-2026-08-30.md`
- `reports/today-premium-behavioral-rls-secure-preflight-retry-with-env-2026-08-30.md`
- `src/pages/Today.tsx`
- `src/pages/PremiumRecipes.tsx`
- `src/pages/Paywall.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/FeatureCard.tsx`
- `src/utils/constants.ts`

## Why UX Polish Is The Safest Next Step

Behavioral RLS execution is blocked by missing local secure env:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- `TEST_USER_A_UUID`;
- `TEST_USER_B_UUID`;
- `TEST_USER_A_JWT`;
- `TEST_USER_B_JWT`.

Because RLS behavior cannot be verified yet, write-path work and production rollout must remain blocked. UX polish is the safest productive next step because it can improve clarity, fallback quality, loading states, disabled action copy, and visual consistency while preserving the current read-only/no-write runtime boundary.

Safe UX polish can be implemented and tested locally with mock/demo data and existing staging-read-only fallback contracts. It does not require real Supabase, staging auth, SQL, RLS policy changes, production config, payment enforcement, or user-owned Premium writes.

## Current Read-Only Baseline

Current Premium read-only runtime behavior:

- `/premium-recipes` uses mock recipes by default and reads catalog library/detail only under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`.
- `/today` uses `demoPlans`, `buildDemoDays`, mock replacement options, and mock shopping groups by default.
- `/today` can read catalog plans, plan days, meal slots, recipe details, replacements, and derived shopping under the staging read-only flag.
- fallback on unavailable/error/empty data returns to mock/demo UI.
- technical service/Supabase errors are not intended to be user-visible.
- user Premium selections, diary writes, recipe import, shopping persistence, AI runtime, and voice input are not enabled.

## RLS Blocker Summary

Current blocker:

- secure env retry still ended with **STAGING_EXTERNAL_BLOCKER**;
- required staging URL, anon key, test user UUIDs, and test user JWTs are not available in the current local execution context;
- no RLS behavior tests can be safely run;
- no authenticated staging visual smoke can be completed from this environment;
- production rollout remains unapproved.

Implication:

- UX polish must not rely on verified user write policies;
- UX polish must not enable writes behind disabled buttons;
- UX polish must not introduce production queries or staging mutations;
- UX polish should improve read-only clarity and fallback trust.

## Surfaces In Scope

In scope for UX polish planning:

- `/today` plan list/detail;
- `/today` day detail;
- `/today` meal detail;
- `/today` replacements;
- `/today` shopping derived/in-memory view;
- `/premium-recipes` library;
- `/premium-recipes` detail;
- `/paywall`;
- Home Premium cards in `Dashboard` / `FeatureCard` / `getHomeFeatureCards`;
- loading, fallback, empty, and disabled/no-write states;
- visual consistency and responsive layout polish.

Out of scope:

- runtime write-path enablement;
- payment enforcement changes;
- production rollout;
- SQL/RLS policy changes;
- real staging data mutation;
- AI or voice runtime.

## `/today` Polish Opportunities

Plan list/detail:

- make the distinction between "demo/mock plan" and "catalog-backed read-only plan" clearer through calm UI copy when needed;
- improve empty/fallback messaging when catalog plan reads return unavailable/error/empty;
- keep returned catalog days honest, without synthesizing days 3-14 as database data;
- tighten day cards and plan summary spacing for quick mobile scanning;
- keep plan selection actions no-write until RLS/write package is explicitly approved.

Day detail:

- add a softer loading/intermediate state for catalog meal slot reads;
- add an empty meal-slot state that keeps the day usable instead of looking broken;
- clarify that `Подтвердить день` is not yet active, without implying a failed action;
- ensure workout summary remains visually secondary to meals while still readable.

Meal detail:

- improve empty ingredients/steps/hints states when catalog recipe detail is incomplete;
- reduce repetition between "Подсказки без весов" intro copy and actual hints;
- make disabled `Добавить в дневник` copy explain future availability without exposing technical reasons;
- preserve local navigation and replacement entry behavior.

Replacements:

- improve fallback copy when replacement options are unavailable and mock options are shown;
- make local-only replacement apply feel intentional for demo/read-only mode;
- keep selection feedback clear on small mobile widths;
- avoid implying the chosen replacement is saved to a server.

Shopping:

- clarify that the list is generated from selected days and remains local/in-memory;
- improve empty derived shopping fallback state;
- keep `1`, `2`, `3`, and `7` day period controls compact and readable;
- make checkbox local-only behavior feel expected without adding persistence;
- avoid adding `premium_shopping_items` or `user_premium_shopping_checks`.

## `/premium-recipes` Polish Opportunities

Library:

- add a calm loading state for catalog library reads under the flag;
- add a fallback/empty state that keeps mock recipe library usable;
- improve category chips so they feel like scan aids rather than inactive filters, unless filtering is explicitly implemented;
- improve card density and long-title wrapping for mobile.

Detail:

- add empty states for missing ingredients, hints, or steps;
- clarify disabled `Добавить в план` and `Добавить в дневник` actions as future/save-disabled actions;
- preserve read-only detail behavior and avoid adding diary/plan writes;
- keep technical Supabase/service errors out of visible UI.

## `/paywall` Polish Opportunities

Current paywall:

- shows `POTOK Premium`;
- explains plan, recipes, replacements, no-scale hints, shopping list, and 14-day review;
- has local demo access via `enableDemoPremiumAccess()`;
- subscription buttons are present but not wired to payment enforcement in the reviewed package.

Safe polish:

- refine copy to set expectations that current Premium demo/read-only flows are preview-like until owner approval;
- improve disabled or not-yet-wired subscription action treatment if needed;
- keep `Посмотреть демо Premium` clear and local-only;
- keep "free diaries remain available" copy;
- avoid Stripe/payment enforcement, checkout, subscription management, or entitlement logic changes.

## Home Premium Cards Polish Opportunities

Current Home behavior:

- before Premium/demo access, first card is `POTOK Premium` and routes to `/paywall`;
- after Premium/demo access, `Мой Поток` routes to `/today`;
- `Сборник рецептов` appears for Premium/demo access and routes to `/premium-recipes`;
- workouts and progress cards remain non-Premium.

Safe polish:

- tune subtitles for clearer product expectations;
- improve Premium/Home card visual hierarchy without adding premium badges to workouts/progress;
- keep route behavior unchanged unless separately approved;
- keep demo access as local state only;
- avoid auth/payment/entitlement changes.

## Loading / Fallback / Empty State Plan

Loading states:

- add lightweight skeleton or subdued status copy for catalog read effects;
- keep layout dimensions stable so mobile screens do not jump;
- avoid spinners that imply a blocking production workflow.

Fallback states:

- prefer user-facing copy such as "Показываем демо-вариант" instead of technical service names;
- never show raw `read_failed`, `supabase_unavailable`, stack traces, or Supabase messages;
- keep fallback mock/demo data usable.

Empty states:

- provide domain-specific copy for no recipes, no meals, no replacements, and no shopping products;
- keep primary navigation available;
- avoid instructing users to retry production/staging actions.

## Disabled / No-Write Action Copy Plan

Actions that must remain disabled/no-write:

- `/premium-recipes`: `Добавить в план`;
- `/premium-recipes`: `Добавить в дневник`;
- `/today` day detail: `Подтвердить день`;
- `/today` meal detail: `Добавить в дневник`;
- any Premium plan/user selection save action;
- any server-backed shopping checkbox persistence.

Copy direction:

- explain future availability in product language;
- avoid technical wording such as RLS, Supabase, staging, SQL, or policy;
- avoid making disabled actions look broken;
- avoid adding onClick handlers that perform writes;
- keep local-only interactions clearly local where needed.

## Visual Consistency Plan

Design polish should:

- preserve the compact mobile-first Premium flow;
- keep bottom action bars consistent across `/today` detail screens;
- keep cards at modest radius and avoid nested decorative cards;
- keep typography within current app scale;
- improve text wrapping/truncation where long meal/recipe titles can overflow;
- keep colors aligned with existing neutral/emerald accents without turning the flow into a one-note palette;
- maintain readable disabled button states.

## Risks

- UX copy could imply persistence or production readiness if not worded carefully.
- Disabled action explanations can become noisy if repeated on every screen.
- Loading states can accidentally reveal technical staging/read mode if they use internal names.
- Visual polish can drift into route/payment/entitlement changes unless scope is held tightly.
- Any attempt to "make buttons useful" would cross into write-path work and must stay out of this package.

## Phased Implementation Plan

Phase 1: copy-only no-write clarity

- refine disabled action copy;
- clarify local/demo/fallback state copy;
- keep runtime behavior and routes unchanged.

Phase 2: `/today` loading/fallback/empty polish

- add stable loading/intermediate state for read-only catalog effects;
- improve empty/fallback states for plan/day/meal/replacements/shopping;
- keep replacement apply and shopping checkboxes local-only.

Phase 3: `/premium-recipes` loading/fallback/empty polish

- add library/detail loading and incomplete-detail states;
- keep add-to-plan/add-to-diary disabled;
- keep fallback mock recipes usable.

Phase 4: Paywall/Home clarity polish

- refine Home Premium card subtitles and paywall expectation copy;
- keep payment/entitlement/demo access behavior unchanged;
- keep dashboard card routing unchanged unless separately approved.

Phase 5: focused test/report pass

- update or add static/render tests for changed copy/states only;
- run targeted Premium tests and build;
- create implementation and review reports before commit.

## What Must Not Be Changed

Do not change:

- `user_premium_plan_selections` writes;
- `user_premium_meal_selections` writes;
- diary writes;
- workout writes;
- `public.recipes` writes;
- `recipe_ingredients` writes;
- recipe import;
- shopping persistence;
- `premium_shopping_items`;
- `user_premium_shopping_checks`;
- AI runtime;
- voice input;
- payment enforcement;
- production rollout;
- production config/query;
- Supabase SQL;
- RLS policies;
- service-role usage;
- staging data;
- auth/payment/entitlement behavior.

## Next Recommended Implementation Package

Recommended next package: **TODAY_PREMIUM_READ_ONLY_UX_POLISH_IMPLEMENTATION_PHASE_1**.

Scope:

- implement copy-only no-write clarity improvements;
- keep runtime write behavior unchanged;
- avoid config/dependency changes;
- avoid Supabase SQL, staging mutation, production query, real table reads, and network calls;
- preserve feature flag behavior and fallback contracts;
- add/update tests only for copy/state contracts touched by the polish.

Suggested first files to consider:

- `src/pages/Today.tsx`;
- `src/pages/PremiumRecipes.tsx`;
- `src/pages/Paywall.tsx`;
- `src/utils/constants.ts`;
- related static/render tests.

Any broader layout polish, payment behavior, DOM/Vite test setup, RLS execution, or production rollout should remain separate owner-approved packages.

## Verification

- `git diff --check`
  - Result: passed.
- No runtime code changes in this plan package.
- No config/dependency changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No RLS behavior tests.
- No real table reads.
- No network calls.
- No secrets/JWT collection.
- No service-role keys.
- No RLS policy changes.
- No write paths.
- No PR.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_UX_POLISH_PLAN_READY**
