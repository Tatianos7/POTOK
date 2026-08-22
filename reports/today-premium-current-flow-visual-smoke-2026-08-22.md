# Today Premium Current Flow Visual Smoke

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE_READY`
  - `TODAY_PREMIUM_PAYWALL_VALUE_ONLY_POLISH_READY`
  - `TODAY_PREMIUM_DEMO_ACCESS_UNBLOCK_READY`
  - `TODAY_PREMIUM_MY_POTOK_NO_GOAL_VISUAL_SIMPLIFICATION_READY`
  - `TODAY_PREMIUM_MY_POTOK_GOAL_WEIGHT_DEDUP_POLISH_READY`
  - `TODAY_PREMIUM_MY_POTOK_GOAL_BUTTON_COPY_POLISH_READY`
- Verdict: **TODAY_PREMIUM_MY_POTOK_CURRENT_FLOW_VISUAL_SMOKE_READY**

## Scope

Smoke check for the current Premium flow:

`Home` -> `/paywall` -> demo Premium access -> `Home` premium state -> `/today` `Мой Поток`.

No runtime code, DB/schema/storage, migrations, payment, auth/access, diary/workout writes, recipe import, AI runtime, voice input, or PR work was done.

## Checks Covered

FREE Home:

- `POTOK Premium` entry is present before purchase/demo access.
- Subtitle is `Готовый план питания и тренировок под вашу цель`.
- `Мой Поток` is not shown in FREE state.
- `Сборник рецептов` is not shown in FREE state.
- `Тренировки` and `Прогресс` stay without `PREMIUM` badges.

Paywall:

- Shows `POTOK Premium`.
- Shows Premium value proposition copy.
- Shows `Оформить подписку`.
- Shows `Восстановить покупки`.
- Shows `Посмотреть демо Premium`.
- Does not show debug/technical/AI/Coach/support copy such as `paywall:default`, `Trust`, `Safety`, `Причина`, `Уверенность`, `AI`, `Coach`, `Поддержка`, or `Произошла ошибка`.

Demo Premium access:

- Demo helper defaults to false.
- Demo helper returns true when `potok_premium_demo_access=true`.
- Demo helper clears back to false.
- Home uses demo access as effective Premium state.
- Premium Home shows `Мой Поток` and `Сборник рецептов`.
- `Мой Поток` route remains `/today`.

`/today` no-goal:

- Clean screen with centered `Мой Поток`.
- Shows text `Рассчитайте свою цель` and `и здесь появится ваш план`.
- Shows bottom buttons `Рассчитать цель` and `Создать замеры`.
- Does not show plans by default.
- Does not show guardrail/debug/dashboard copy.

`/today` existing-goal/demo goal:

- Shows `Мой Поток`.
- Shows goal label `Похудение`.
- Progress bar shows start/target weight.
- Current weight is not duplicated when it equals start/target.
- Shows hint `Дополните данные, чтобы POTOK точнее подобрал план.`
- Shows compact plan rows:
  - `Питание + тренировки`;
  - `Питание без сложной готовки`;
  - `Тренировки дома`;
  - `Быстрое питание и короткие тренировки`.
- Shows bottom actions:
  - `Дополнить данные`;
  - `Изменить цель`;
  - `Создать замеры`.
- Does not show `Ваши планы на 14 дней`, `План ≠ запись в дневнике`, or `План не записывается`.

Routes/source:

- `Рассчитать цель` -> `/goal`.
- `Изменить цель` -> `/goal`.
- `Создать замеры` -> `/measurements`.
- `Мой Поток` -> `/today`.
- `POTOK Premium` -> `/paywall`.

Mobile/source confidence:

- `/today` uses `min-w-[320px]`.
- Title uses `whitespace-nowrap`.
- Bottom actions are fixed/sticky with extra bottom padding on content.
- No dashboard/card wrapper is used in the primary no-goal or existing-goal `/today` states.

## Browser Runtime Attempt

Playwright Chromium launch was attempted for browser smoke.

Result: blocked by environment/browser failure before loading the app:

- `browserType.launch: Target page, context or browser has been closed`
- Chromium process logged `Received signal 6`.

Conclusion: this is an environment/browser blocker, not an app runtime blocker. Fallback validation used targeted render/source tests plus production build.

## Tests

Targeted tests:

- `npx tsx --test src/pages/__tests__/DashboardFeatureBadges.test.ts src/pages/__tests__/PaywallPremiumCopy.test.ts src/services/__tests__/demoPremiumAccess.test.ts src/pages/__tests__/TodayPaidEntry.test.tsx`
- Result: passed, `27/27`.

Build:

- `npm run build`
- Result: passed.
- Existing warnings only: stale browser data, `mealService` mixed dynamic/static import warning, and large chunk warning.

Diff check:

- `git diff --check`
- Result: passed.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment implementation.
- No subscription mutation changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No premium recipe catalog implementation.
- No AI runtime.
- No Coach.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_MY_POTOK_CURRENT_FLOW_VISUAL_SMOKE_READY**
