# Progress Daily Goal Game Layer 320px Layout Fix

- Date: 2026-08-16
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_UI_FOUNDATION_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_GOAL_LOGIC_FIX_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_320PX_LAYOUT_FIX_READY**

## Scope

Applied a targeted responsive layout fix for the `Цель дня` card in general Progress at narrow mobile width around `320px`.

No business logic changed. No Progress calculations changed. No DB/schema/storage changes were made. No production data was changed. No Today, AI, payment, Plan Store, or Coach logic was added. No PR was created.

## Owner Screenshot Issue Summary

Owner visual review found that on about `320px` width the checklist label `Питание в рамках цели` broke vertically letter-by-letter.

The visual issue happened when the long metadata chip, for example `Записано 1075 ккал из 1546 ккал`, stayed on the right side and consumed too much horizontal space.

## Root Cause

The previous checklist row used one flex row:

- icon;
- label;
- right-side `em` chip.

The chip was `flex: 0 0 auto`, while the label had `overflow-wrap: anywhere`. On very narrow width, the label became too narrow and the browser was allowed to break it between letters.

## What Changed

The row structure now separates checklist content from the icon:

- icon stays fixed on the left;
- label and metadata chip live inside `progress-daily-goal-item-content`;
- content uses `flex-wrap: wrap`;
- label uses normal word wrapping, not letter-by-letter breaking;
- metadata chip can move to the next line.

Updated files:

- `src/components/ProgressDailyGoalCard.tsx`
- `src/pages/ProgressHub.css`
- `src/components/__tests__/ProgressDailyGoalCard.test.tsx`

## 320px Behavior

Expected narrow behavior:

```text
Питание в рамках цели
[Записано 1075 ккал из 1546 ккал]
```

The label should wrap by words only. The chip is allowed to become a second line instead of squeezing the label.

The same layout also protects smaller chips:

- `5 ст.`;
- `UI-only`.

## Normal Mobile Widths

On common mobile widths like `375px`, `390px`, and `430px`, the row can still remain compact. If the chip and label fit together, they share a line; if not, the chip wraps below cleanly.

The card height may increase slightly only for rows with long metadata, which is preferable to vertical letter breaking.

## Business Logic Confirmation

No completion rules were changed:

- nutrition still uses the existing `90-110%` calorie target range;
- water remains read-only derived from the existing day model;
- workout completion still comes from existing workout diary entries;
- `Проверить Progress` remains UI-session only.

## Tests Run

Targeted tests:

```text
npx tsx --test src/components/__tests__/ProgressDailyGoalCard.test.tsx src/utils/__tests__/progressDailyGoal.test.ts
```

Result:

```text
tests 14
pass 14
fail 0
```

Coverage added:

- long nutrition label and long metadata render together;
- metadata has a separate layout class;
- narrow wrapping classes are present;
- label does not use `overflow-wrap: anywhere`;
- existing completion states still render;
- component still has no diary/workout write imports.

## Build Result

```text
npm run build
```

Result: passed.

Build produced existing maintenance warnings only:

- browser baseline data is old;
- Browserslist/caniuse-lite data is old;
- existing `mealService` dynamic/static import overlap warning;
- some chunks exceed 500 kB.

These warnings are not blockers for this layout fix.

## Known Limitations / Polish

- No browser screenshot artifact was captured in this package.
- A future visual smoke can verify `320px`, `375px`, `390px`, and `430px` in Playwright or browser devtools.
- If the nutrition chip becomes even longer in future locales, a compact chip format like `1075 / 1546 ккал` can be added as a separate polish task.

## Recommendation

Safe to keep the Progress Daily Goal/Game Layer enabled and proceed with the next Progress visual smoke or derived metrics package.

## Final Status

The 320px layout issue is fixed without changing Daily Goal business logic or any persistence path.
