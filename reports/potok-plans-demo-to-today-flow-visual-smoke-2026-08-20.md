# POTOK Plans Demo To Today Flow Visual Smoke

- Date: 2026-08-20
- Branch: `master`
- Status basis:
  - `POTOK_PLANS_DEMO_TO_TODAY_FLOW_READY`
- Verdict: **REQUIRES_FIXES**

## Scope

Visual/runtime smoke attempt for the demo flow:

```text
Готовые программы -> demo catalog -> program day -> Today items
```

No runtime code, DB/schema/storage, production data, diary/workout/water write-path, payment, AI, Coach, real Plan Store purchase, PR, or commit changes were made in this smoke package.

## Checked Flow

Target flow:

1. Open `/today`.
2. Find `Готовые программы`.
3. Click `Смотреть программы`.
4. See `Похудение дома · 7 дней`.
5. Select a program day.
6. Open the day as Today items.
7. Confirm meal/workout/water items.
8. Confirm diary/workout navigation actions.
9. Confirm `Выполнено` and `Не подходит` are mock/local only.
10. Confirm planned-vs-actual guardrail.
11. Confirm no payment/AI/Coach/real Plan Store implementation.

## Screenshots / Visual Notes

Full Playwright visual smoke could not complete in this local environment.

Both browser engines failed before page navigation:

- Chromium: `SIGABRT` / `Received signal 6` at launch.
- WebKit: `Abort trap: 6` at launch.

Because the browser process never opened a page, no reliable screenshot was produced for the 320px visual review.

Dev server route availability was verified separately:

```text
curl -I http://127.0.0.1:5177/today
HTTP/1.1 200 OK
```

## Pass / Fail By Step

1. `/today` opens: **PASS via dev server 200**, browser visual not completed.
2. `Готовые программы` card exists: **PASS via targeted component/source tests**.
3. `Смотреть программы` opens demo preview: **PASS by implementation/test coverage**, browser click smoke not completed.
4. `Похудение дома · 7 дней` exists: **PASS via provider/page tests**.
5. Program day selection exists: **PASS by implementation**, browser visual not completed.
6. Program day produces Today items: **PASS via provider tests**.
7. Meal item renders data: **PASS via provider tests**.
8. Workout item renders data: **PASS via provider tests**.
9. Water/task item renders data: **PASS via provider tests**.
10. `Перейти в дневник` routes to `/nutrition`: **PASS via page source test**, browser navigation smoke not completed.
11. `Начать тренировку` routes to `/workouts`: **PASS via page source test**, browser navigation smoke not completed.
12. `Выполнено` changes only mock state: **PASS via provider tests**.
13. `Не подходит` stores mock reason: **PASS via provider tests**.
14. Guardrail copy exists: **PASS via page test**.
15. No diary/workout/water writes: **PASS via source tests**.
16. No payment/AI/Coach/real Plan Store: **PASS via source tests**.

## Blockers

Browser-based visual smoke is blocked by local Playwright browser startup failure, not by an observed `/today` runtime error.

This means the 320px visual criteria were not fully verified:

- screen length;
- card wrapping;
- button stability;
- text clipping;
- user clarity of the demo flow.

## Non-Blocking Polish

No app cosmetic issue was observed because the browser did not launch.

Potential follow-up once browser smoke is available:

- capture 320px screenshot after selecting a day;
- verify long labels and CTAs do not wrap awkwardly;
- confirm day-grid spacing feels compact enough on 320px.

## Tests

Passed:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx src/services/__tests__/demoTodayPlansProvider.test.ts
```

Result: 14 tests passed.

## Build

Passed:

```text
npm run build
```

Build completed with existing Vite/browser-data/chunk-size warnings only.

## Recommendation

Do not change product/runtime code based on this smoke attempt.

Repeat the visual smoke in an environment where Playwright browsers can launch, or manually verify `/today` at 320px in a browser before deploy.

## Final Status

Implementation remains test/build ready, but the requested visual runtime smoke cannot be marked fully ready until browser-based 320px verification is completed.
