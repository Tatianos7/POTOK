# Today Premium Home Paywall Visual Smoke

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE_READY`
  - `TODAY_PREMIUM_PAYWALL_VALUE_ONLY_POLISH_READY`
- Verdict: **TODAY_PREMIUM_HOME_PAYWALL_VISUAL_SMOKE_READY**

## Scope

Visual/runtime smoke for Home Premium access states and `/paywall` after value-only polish.

No runtime code, DB/schema/storage, migrations, payment, subscription mutation, auth/access, diary/workout writes, recipe import, AI runtime, Coach, voice input, or PR work was done.

## Runtime / Visual Notes

Attempted local browser smoke with Vite on `http://127.0.0.1:5178/`.

Result:

- Vite dev server started successfully.
- Playwright Chromium failed before page navigation with browser crash `SIGABRT`.
- This matches the known environment-level Playwright/browser instability seen in prior visual smoke work.
- No app runtime exception was observed because Chromium did not reach the page.

Fallback verification used targeted render/source tests and production build.

## Free State Check

Verified through `getHomeFeatureCards({ hasPremium: false })` targeted tests.

Pass:

- Home shows `POTOK Premium`.
- Subtitle is `Готовый план питания и тренировок под вашу цель`.
- Premium entry routes to `/paywall`.
- Separate `Сборник рецептов` card is not shown.
- `ТРЕНИРОВКИ` is not premium and has no premium color.
- `ПРОГРЕСС` is not premium and has no premium color.

## Paywall Check

Verified through `Paywall` render/source targeted tests.

Pass, must show:

- `POTOK Premium`;
- `Меньше думайте — больше выполняйте`;
- `Оформить подписку`;
- `Восстановить покупки`;
- ready nutrition and workout plans;
- recipes with calories/macros;
- meal replacements;
- shopping list.

Pass, must not show:

- `Почему доступ ограничен`;
- `Причина`;
- `paywall:default`;
- `Уверенность`;
- `Trust`;
- `Safety`;
- `Explainability`;
- `Manual Mode`;
- `Follow Plan`;
- `Coach Layer`;
- `AI`;
- `Coach`;
- `Поддержка`;
- `Произошла ошибка`.

Visual assessment from component structure:

- screen is value-only;
- no debug/status/access panels remain;
- one primary CTA;
- one secondary restore action;
- content is short enough for 320px mobile without a long debug wall.

## Premium State Check

Verified through `getHomeFeatureCards({ hasPremium: true })` targeted tests.

Pass:

- Home shows `Мой Поток`.
- Subtitle is `Ваше питание, тренировки и рекомендации на сегодня`.
- Separate `Сборник рецептов` card is shown.
- `POTOK Premium` purchase entry is not shown.
- `Мой Поток` routes to `/today`.
- `Сборник рецептов` routes to `/today` as a safe placeholder.
- `Сборник рецептов` does not route to `/nutrition/recipes`, avoiding mix with user-created recipes.
- `ТРЕНИРОВКИ` and `ПРОГРЕСС` remain without premium badges.

## Mobile 320px Check

Automated browser screenshot could not complete because Chromium crashed with `SIGABRT`.

Static/render review:

- Home card data uses existing `FeatureCard` layout already used on 320px Home.
- Paywall uses compact `ScreenContainer`, three cards, and stacked buttons by default.
- CTA buttons switch to row only from `min-[360px]`, so 320px remains stacked and readable.
- No technical/debug panels are present, so the page no longer reads as a debug screen.

## Tests Run

- `npx tsx --test src/pages/__tests__/PaywallPremiumCopy.test.ts src/pages/__tests__/DashboardFeatureBadges.test.ts` — passed.
- `git diff --check` — passed.

Notes:

- Paywall render test prints the existing React Router SSR `useLayoutEffect` warning from `MemoryRouter`. Tests pass.
- Playwright Chromium visual attempt failed with environment/browser `SIGABRT`.

## Build Result

- `npm run build` — passed.

Build completed with existing Vite/Browserslist/chunk-size warnings only.

## Blockers

No product/runtime blocker found in code checks.

Environment blocker:

- Playwright Chromium crashes with `SIGABRT` before page navigation, so live browser screenshot confirmation was not available in this environment.

## Recommendation

Proceed with code-level readiness. Re-run browser visual smoke in an environment where Playwright Chromium can launch, or validate manually in the owner browser before production deployment.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment implementation.
- No subscription mutation changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No AI runtime.
- No Coach.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_HOME_PAYWALL_VISUAL_SMOKE_READY**
