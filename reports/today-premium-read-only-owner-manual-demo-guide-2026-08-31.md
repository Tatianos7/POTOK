# Today Premium Read-Only Owner Manual Demo Guide

- Date: 2026-08-31
- Branch: `master`
- Source blocked execution commit: `0b22c5d today premium read only owner demo execution blocked`
- Checklist source: `reports/today-premium-read-only-owner-demo-checklist-2026-08-30.md`
- Target package: `TODAY_PREMIUM_READ_ONLY_OWNER_MANUAL_DEMO_GUIDE`
- Verdict: **TODAY_PREMIUM_READ_ONLY_OWNER_MANUAL_DEMO_GUIDE_READY**

## Purpose

Use this guide to run the Premium read-only UX owner demo manually in a normal browser.

The previous automated owner demo was blocked by the local Playwright/browser environment:

- Chromium failed before page navigation with `SIGABRT`;
- WebKit failed before page navigation with `Abort trap: 6`;
- Firefox was not installed in the local Playwright cache.

The local Vite server and HTTP preflight were OK, so this is an environment/browser automation blocker, not a confirmed product blocker. Manual browser review is the next safe path.

## Safety Scope

This guide is manual review only.

Do not:

- run Supabase SQL;
- mutate staging;
- touch production;
- collect or paste secrets/JWTs/passwords;
- use service-role keys;
- run behavioral RLS tests;
- create diary entries from Premium;
- persist Premium plan/meal selections;
- persist shopping items/checks;
- start checkout or real payment;
- enable AI/voice runtime;
- create a PR.

## Local App Start

From the repo root on `master`, start the app locally:

```sh
npm run dev -- --host 127.0.0.1 --port 5180
```

Open:

```text
http://127.0.0.1:5180/
```

If port `5180` is busy, use another local port and record it in the notes.

Stop the server after the demo with `Ctrl+C`.

## Demo Access Reset / Enable

Demo access is local browser state.

To reset demo access before testing:

1. Open browser DevTools.
2. Go to Console.
3. Run:

```js
localStorage.removeItem('potok_premium_demo_access');
location.href = '/';
```

To enable demo access without clicking Paywall, if needed for debugging only:

```js
localStorage.setItem('potok_premium_demo_access', 'true');
location.href = '/';
```

Preferred owner flow:

- reset demo access first;
- start from Home;
- enable demo by clicking `Посмотреть демо Premium` on Paywall.

## Step 1. Home Before Demo

Start at:

```text
http://127.0.0.1:5180/
```

Expected:

- `POTOK Premium` card is visible;
- subtitle says `План питания, тренировки и покупки в демо-просмотре`;
- tapping `POTOK Premium` opens `/paywall`;
- workouts card remains a regular non-Premium card;
- progress card remains a regular non-Premium card;
- workouts/progress do not show Premium badges.

## Step 2. Paywall

Open `/paywall` by tapping `POTOK Premium`.

Expected:

- Paywall explains Premium value as nutrition, training, recipes, replacements, hints, and shopping structure;
- copy says demo helps evaluate Premium without purchase/access оформлення;
- free diaries, workouts, measurements, and Progress remain explicitly available;
- `Посмотреть демо Premium` is visible and active;
- `Подписка скоро` is visible and disabled;
- `Покупки скоро` is visible and disabled;
- the screen does not look like active checkout or real payment.

## Step 3. Demo Premium

Tap:

```text
Посмотреть демо Premium
```

Expected:

- app opens `/today`;
- demo access is enabled only in the current browser local state;
- no payment, checkout, entitlement mutation, or server access is started.

## Step 4. Home After Demo

Return to Home:

```text
http://127.0.0.1:5180/
```

Expected:

- `Мой Поток` card is visible;
- `Мой Поток` routes to `/today`;
- subtitle says `План питания, тренировки и покупки на сегодня`;
- `Сборник рецептов` card is visible;
- `Сборник рецептов` routes to `/premium-recipes`;
- subtitle says `Рецепты с КБЖУ, граммовками и подсказками`;
- workouts/progress remain non-Premium and without Premium badges.

## Step 5. `/today`

Open:

```text
http://127.0.0.1:5180/today
```

Expected:

- plan screen is readable and usable;
- if loading appears, copy says `Готовим план для просмотра...`;
- if fallback appears, copy says `Показываем демо-вариант.`;
- empty states, if encountered, look intentional rather than broken;
- `Подтвердить день` remains disabled/no-write;
- `Добавить в дневник` remains disabled/no-write;
- no technical strings are visible.

Recommended path:

1. Open a plan.
2. Open a day.
3. Open a meal detail.
4. Confirm ingredient, hint, and step sections are readable.
5. Confirm disabled actions still look intentional.

## Step 6. Replacements

From a `/today` meal detail, open replacements.

Expected:

- replacement screen is readable;
- copy says the selection applies only on the current screen;
- choosing a replacement changes local preview only;
- no Premium meal selection is persisted;
- no diary entry is created;
- no server-save expectation is implied.

## Step 7. Shopping

From a `/today` day detail, open shopping.

Expected:

- shopping list is readable;
- day-period controls are usable;
- copy says purchase marks stay only here / on this screen;
- checking items changes local state only;
- no shopping persistence is created;
- no `premium_shopping_items` or `user_premium_shopping_checks` behavior is expected.

## Step 8. `/premium-recipes`

Open:

```text
http://127.0.0.1:5180/premium-recipes
```

Expected:

- recipe library is readable and usable;
- recipe detail is readable and usable;
- if loading appears, copy says `Готовим рецепты для просмотра...`;
- if fallback appears, copy says `Показываем демо-рецепты.`;
- empty ingredient/step/hint states, if encountered, look intentional;
- `Добавить в план` remains disabled/no-write;
- `Добавить в дневник` remains disabled/no-write;
- `/premium-recipes` remains separate from free `/nutrition/recipes`;
- no technical strings or raw service errors are visible.

## Step 9. Mobile / Narrow Viewport

Repeat the main path in a narrow viewport, ideally around `390px` wide and also `320px` if convenient.

Expected:

- Home cards are readable;
- Paywall copy wraps cleanly;
- `/today` plan/day/meal/replacement/shopping screens do not overflow horizontally;
- `/premium-recipes` library/detail screens do not overflow horizontally;
- bottom actions do not overlap content;
- disabled buttons look intentional;
- empty/fallback copy is useful and not too noisy.

## Pass / Fail Table

| Area | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Environment | Local app starts and opens in a normal browser |  |  |
| Home before demo | `POTOK Premium` opens Paywall; workouts/progress are regular cards |  |  |
| Paywall | Demo expectations are clear; payment-style actions are disabled |  |  |
| Demo Premium | Demo CTA opens `/today` through local demo access only |  |  |
| Home after demo | `Мой Поток` and `Сборник рецептов` route correctly |  |  |
| `/today` | Plan/day/meal UX is readable and no-write |  |  |
| Replacements | Replacement selection is local-only |  |  |
| Shopping | Shopping marks are local-only |  |  |
| `/premium-recipes` | Library/detail UX is readable and no-write |  |  |
| Mobile | No broken layout, overflow, or bottom-action overlap |  |  |
| Must-not-happen | No payment, checkout, writes, persistence, AI/voice promise, or technical copy appears |  |  |

## Must-Not-Happen Checklist

Mark any item below as a blocker if it occurs:

| Check | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Real payment | No real payment flow starts |  |  |
| Checkout | No checkout page/modal appears |  |  |
| Diary write | No diary entry is created from Premium |  |  |
| Premium selection persistence | No Premium plan/meal selection is persisted |  |  |
| Shopping persistence | No shopping item/check persistence occurs |  |  |
| AI promise | No AI runtime promise appears |  |  |
| Voice promise | No voice input/runtime promise appears |  |  |
| Human coach promise | No human coach promise appears |  |  |
| Technical copy | No Supabase/RLS/staging/SQL technical copy is visible |  |  |
| Raw errors | No `read_failed` or `supabase_unavailable` text is visible |  |  |

## What Counts As A Blocker

A blocker is any issue that breaks the read-only safety boundary or prevents owner demo completion:

- real payment or checkout starts;
- Premium creates diary entries;
- Premium persists plan/meal selections;
- shopping marks or shopping lists persist to a backend;
- production data is queried or mutated;
- staging is mutated;
- technical errors are shown as the main user experience;
- `/today`, `/premium-recipes`, Paywall, or Home cannot be opened at all;
- bottom actions make the primary content unusable on mobile.

## What Counts As A Minor Visual Issue

A minor visual issue is visible polish debt that does not break safety or the main flow:

- text feels slightly dense but remains readable;
- spacing is uneven;
- fallback/empty text is useful but could be shorter;
- disabled buttons are understandable but visually heavy;
- a card wraps awkwardly without hiding content;
- mobile layout needs refinement but remains usable.

Minor visual issues should go into a focused visual polish package.

## What Counts As A Copy Issue

A copy issue is product wording that could mislead or confuse while behavior remains safe:

- copy implies server persistence for demo/local-only actions;
- copy implies real payment is available;
- copy implies AI, voice, or human coach runtime exists;
- copy exposes technical implementation terms;
- disabled actions feel broken instead of intentionally unavailable;
- empty/fallback states feel alarming or noisy.

Copy issues should go into a focused copy patch.

## Suggested Screenshots

Screenshots are optional. If convenient, attach local screenshots for:

- Home before demo access;
- Paywall;
- Home after demo access;
- `/today` plan list;
- `/today` day detail;
- `/today` meal detail;
- `/today` replacements;
- `/today` shopping;
- `/premium-recipes` library;
- `/premium-recipes` detail;
- mobile Home;
- mobile Paywall;
- mobile `/today`;
- mobile `/premium-recipes`.

Do not include screenshots that show secrets, JWTs, local env values, browser devtools with tokens, or private user data.

## Next Decision

If UX is acceptable:

- return to the RLS secure env blocker;
- continue RLS work only after secure env, JWTs, and dedicated staging test users are ready.

If visual issues are found:

- create a focused visual polish package;
- keep it separate from RLS, SQL, staging, production, payment enforcement, and write paths.

If copy issues are found:

- create a focused copy patch;
- keep it small and covered by copy/no-write tests.

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

**TODAY_PREMIUM_READ_ONLY_OWNER_MANUAL_DEMO_GUIDE_READY**
