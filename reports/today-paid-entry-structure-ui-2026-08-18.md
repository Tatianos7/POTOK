# Today Paid Entry Structure UI

- Date: 2026-08-18
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_CUSTOMIZATION_DEPLOYED`
  - `TODAY_FOUNDATION_AUDIT_AND_SPEC_READY`
  - `POTOK_FREE_PROGRESS_AND_PAID_TODAY_STRUCTURE_READY`
- Verdict: **TODAY_PAID_ENTRY_STRUCTURE_UI_READY**

## Scope

Implemented the first UI foundation for `/today` as a paid execution entry structure.

No DB/schema/storage, production data, diary/workout writes, payment, AI generation, Plan Store, trainer marketplace, Coach Network, or PR work was done.

## Product Decision Summary

Free POTOK remains goal, diaries, Progress, hints, and the Daily Goal/Game Layer inside Progress.

Today is not the free checklist. Today is the paid execution mode where POTOK can guide the user through a concrete daily plan from AI, a purchased program, or a human coach.

## What Changed On `/today`

- Replaced the old program/coach-heavy runtime screen with a calm paid-entry UI.
- Added a header that explains the Free vs paid boundary.
- Added navigation back to free Progress.
- Removed the old impression that Today is a self-guided free checklist.
- Avoided duplicating the Progress Daily Goal/Game Layer.
- Updated home plan-card routes from broken `/plans` and `/plan` destinations to `/today`.

## AI Card Behavior

`POTOK AI` is shown as a paid direction placeholder:

- daily adaptive plan;
- nutrition and training under the user's goal;
- replacement flow for `Не подходит`;
- day/week analysis later.

The CTA is disabled and marked as `Скоро`.

## Plans Card Behavior

`Готовые программы` is shown as a paid direction placeholder:

- ready-made plan without a trainer;
- program unfolds by days in Today;
- explicitly framed as not a PDF;
- for users who want structure without personal support.

The CTA is disabled and marked as `Скоро`.

## Coach Card Behavior

`Персональный тренер` is shown as a paid direction placeholder:

- verified coach;
- coach assigns a plan;
- plan appears in Today;
- corrections and control later.

The CTA is disabled and marked as `Скоро`.

## Guardrail Copy

The screen includes the planned-vs-actual guardrail:

`План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или выполнили.`

## What Was Intentionally Not Implemented

- Payment.
- AI generation.
- Plan Store/catalog.
- Trainer marketplace.
- Coach Network.
- Diary/workout write actions.
- DB/schema/storage changes.
- A second Today-like route.

## Tests Run

Targeted tests:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed.

```text
tests 6
pass 6
fail 0
```

Note: the test renderer logs the existing React Router SSR `useLayoutEffect` warning from `MemoryRouter`; it does not fail the test and is not a `/today` runtime error.

## Build Result

```text
npm run build
```

Result: passed (`tsc && vite build`, then GitHub Pages fallback generated).

Build logs still include existing maintenance warnings about browser data age, chunk size, and a `mealService` dynamic/static import overlap. They are not specific to this `/today` change and did not fail the build.

## Known Limitations

- Cards are placeholders and do not start purchase, AI, plan browsing, or coach matching flows yet.
- Existing deeper program delivery services remain untouched for future paid Today implementation.
- The old `/today` runtime data experience is not exposed in this foundation screen.

## Recommended Next Step

Recommended next package:

`TODAY_PAID_ENTRY_STRUCTURE_SMOKE_AND_COPY_REVIEW`

Suggested scope:

- visual smoke on 320/390/mobile and desktop widths;
- owner copy review for AI/Plans/Coach cards;
- decide first paid direction to implement behind the Today entry.
