# Today Premium Read-Only Owner Demo Checklist

- Date: 2026-08-30
- Branch: `master`
- Source final status commit: `2060cfd today premium read only ux polish final status`
- Current UX polish HEAD: `2060cfd today premium read only ux polish final status`
- Target package: `TODAY_PREMIUM_READ_ONLY_OWNER_DEMO_CHECKLIST`
- Verdict: **TODAY_PREMIUM_READ_ONLY_OWNER_DEMO_CHECKLIST_READY**

## Scope

Prepare a manual owner demo checklist for the Premium read-only UX.

This is a report-only package. No runtime code was changed, no config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no real table reads or network calls were made, no secrets/JWTs were collected, and no PR was created.

## Source Materials Reviewed

- `reports/today-premium-read-only-ux-polish-final-status-2026-08-30.md`
- `src/pages/Today.tsx`
- `src/pages/PremiumRecipes.tsx`
- `src/pages/Paywall.tsx`
- `src/utils/constants.ts`

## A. Preconditions

Before the manual demo:

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Branch / HEAD | App is reviewed from `master` at or after `2060cfd today premium read only ux polish final status` |  |  |
| No-write mode | Premium UX is treated as read-only / demo preview |  |  |
| Demo access | Demo access is local-only and can be reset by leaving demo Premium |  |  |
| Payments | Payment enforcement is disabled; Paywall purchase-style actions are not active checkout flows |  |  |
| Premium selections | Premium plan/meal selection persistence remains disabled |  |  |
| Shopping | Shopping marks remain local-only and are not persisted |  |  |
| Diary writes | Premium screens do not create diary entries |  |  |
| RLS status | Behavioral RLS tests are still not executed |  |  |
| Production status | Production rollout is not approved |  |  |

## B. Home Before Demo Access

Start from Home without active Premium/demo access.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Premium entry card | Card title is `POTOK Premium` |  |  |
| Premium subtitle | Subtitle is `План питания, тренировки и покупки в демо-просмотре` |  |  |
| Premium route | Tapping the card opens `/paywall` |  |  |
| Workouts card | Workouts remains a regular non-Premium card |  |  |
| Progress card | Progress remains a regular non-Premium card |  |  |
| Premium badges | Workouts and Progress do not show Premium badges |  |  |

## C. Paywall

Open `/paywall`.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Main value copy | Paywall explains Premium as nutrition, training, recipes, replacements, hints, and shopping structure |  |  |
| Demo expectation | Copy says the demo helps evaluate Premium without оформлять доступ |  |  |
| Free areas | Free diaries, workouts, measurements, and Progress remain explicitly available |  |  |
| Demo button | `Посмотреть демо Premium` is visible and active |  |  |
| Demo action | Tapping `Посмотреть демо Premium` opens `/today` through local demo access |  |  |
| Subscription action | `Подписка скоро` is visible and disabled |  |  |
| Purchase restore action | `Покупки скоро` is visible and disabled |  |  |
| Payment expectation | Screen does not look like an active checkout/payment flow |  |  |
| Exit demo | If demo is active, `Выйти из демо Premium` is available and returns Home |  |  |

## D. Home After Demo Access

Return to Home after pressing `Посмотреть демо Premium`.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| My Potok card | `Мой Поток` appears |  |  |
| My Potok route | `Мой Поток` opens `/today` |  |  |
| My Potok subtitle | Subtitle is `План питания, тренировки и покупки на сегодня` |  |  |
| Recipe card | `Сборник рецептов` appears |  |  |
| Recipe route | `Сборник рецептов` opens `/premium-recipes` |  |  |
| Recipe subtitle | Subtitle is `Рецепты с КБЖУ, граммовками и подсказками` |  |  |
| Workouts card | Workouts remains non-Premium |  |  |
| Progress card | Progress remains non-Premium |  |  |
| Premium badges | Workouts and Progress still do not show Premium badges |  |  |

## E. `/today`

Open `/today` after demo access.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Plan screen | Plan screen is readable and usable |  |  |
| Loading copy | If loading appears, it says `Готовим план для просмотра...` and feels lightweight |  |  |
| Fallback copy | If fallback appears, it says `Показываем демо-вариант.` |  |  |
| Empty plans | Empty plan state reads as intentional, not broken |  |  |
| Empty days | Plan detail without days reads as intentional, not broken |  |  |
| Empty meals | Day detail without meals reads as intentional, not broken |  |  |
| Meal details | Ingredients, steps, and hints sections remain readable even when empty |  |  |
| Confirm day | `Подтвердить день` remains disabled/no-write |  |  |
| Add to diary | `Добавить в дневник` remains disabled/no-write |  |  |
| Replacements | Replacement selection says it applies only on the current screen |  |  |
| Shopping | Shopping marks say they stay only here / on this screen |  |  |
| Technical strings | No technical terms or raw service errors are visible |  |  |

## F. `/premium-recipes`

Open `/premium-recipes` after demo access.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Library | Recipe library is readable and usable |  |  |
| Recipe detail | Opening a recipe detail is readable and usable |  |  |
| Loading copy | If loading appears, it says `Готовим рецепты для просмотра...` and feels lightweight |  |  |
| Fallback copy | If fallback appears, it says `Показываем демо-рецепты.` |  |  |
| Empty library | Empty recipe library reads as intentional, not broken |  |  |
| Empty ingredients | Missing ingredients state reads as intentional, not broken |  |  |
| Empty steps | Missing steps state reads as intentional, not broken |  |  |
| Empty hints | Missing hints state reads as intentional, not broken |  |  |
| Add to plan | `Добавить в план` remains disabled/no-write |  |  |
| Add to diary | `Добавить в дневник` remains disabled/no-write |  |  |
| Free recipes separation | `/premium-recipes` remains separate from free `/nutrition/recipes` |  |  |
| Technical strings | No technical terms or raw service errors are visible |  |  |

## G. Mobile Visual Check

Run the same demo path on a narrow mobile viewport.

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Home cards | Cards are readable with no broken layout |  |  |
| Paywall copy | Copy wraps cleanly with no text overflow |  |  |
| Today screens | Plan/day/meal/replacement/shopping screens do not overflow horizontally |  |  |
| Premium recipes | Library/detail screens do not overflow horizontally |  |  |
| Bottom actions | Bottom actions do not overlap content |  |  |
| Disabled buttons | Disabled buttons look intentional, not broken |  |  |
| Empty/fallback copy | Empty/fallback text is useful and not too noisy |  |  |

## H. Must Not Happen

During the owner demo, these outcomes are blockers:

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Real payment | No real payment flow starts |  |  |
| Checkout | No checkout page/modal appears |  |  |
| Diary entry | No diary entry is created from Premium |  |  |
| Premium selection persistence | No Premium plan/meal selection is persisted |  |  |
| Shopping persistence | No shopping mark/list persistence occurs |  |  |
| AI/voice promise | No AI, voice, or human coach promise appears |  |  |
| Technical copy | No Supabase/RLS/staging/SQL technical copy is visible |  |  |
| Raw errors | No raw `read_failed` or `supabase_unavailable` text is visible |  |  |

## I. Pass / Fail Summary

Use this table after the manual demo.

| Area | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Preconditions | Read-only/demo boundaries are understood before testing |  |  |
| Home before demo | Premium entry routes to Paywall; workouts/progress are regular cards |  |  |
| Paywall | Demo expectations are clear; payment actions are disabled |  |  |
| Home after demo | My Potok and recipe cards route correctly; workouts/progress remain non-Premium |  |  |
| `/today` | Plan/day/meal/replacement/shopping UX is readable and no-write |  |  |
| `/premium-recipes` | Library/detail UX is readable and no-write |  |  |
| Mobile | No broken layout, overflow, or action overlap |  |  |
| Must not happen | No payment, writes, persistence, AI/voice promise, or technical copy appears |  |  |

## J. Known Limitations

- no authenticated staging visual smoke;
- no behavioral RLS tests;
- no full browser/Vite async coverage;
- no production rollout;
- no server persistence for Premium selections or shopping;
- no payment enforcement;
- no diary writes from Premium;
- no AI/voice runtime.

## K. Next Decision After Demo

If demo UX is acceptable:

- return to the RLS secure env blocker;
- proceed with RLS preflight/execution only after staging secure env, JWTs, and dedicated test users are ready.

If visual issues are found:

- create a focused visual polish package;
- keep it separate from RLS, SQL, staging, production, payment enforcement, and write paths.

If product copy issues are found:

- create a focused copy polish patch;
- keep copy changes small and covered by existing copy/no-write tests.

Recommended next action:

- commit this owner demo checklist separately;
- then choose either owner demo execution or RLS secure env readiness work based on whether secure env is available.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no config/dependency changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table reads;
- no network calls;
- no secrets/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no user Premium selections writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_OWNER_DEMO_CHECKLIST_READY**
