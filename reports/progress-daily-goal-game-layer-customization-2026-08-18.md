# Progress Daily Goal Game Layer Customization

- Date: 2026-08-18
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_MONTH_UX_DEPLOYED`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_CUSTOMIZATION_READY**

## Scope

Implemented an in-card customization layer for the free Progress Daily Goal/Game Layer.

No DB/schema/storage migrations were added. No production data was changed. No diary, workout, or water write path was added. Today, AI, payment, Plan Store, Coach, and PR work were not touched.

## Owner UX Decision

The `Цель дня` block should be controlled directly inside Progress. Users should not be sent to a separate settings screen for this lightweight daily goal layer.

## Enabled / Disabled Behavior

- The card header always remains visible.
- Header keeps `Цель дня`.
- Header includes an inline `Вкл` / `Выкл` control.
- When disabled:
  - checklist is hidden;
  - month indicator is hidden;
  - score is hidden;
  - helper copy is shown: `Помогает отмечать базовые действия и видеть прогресс за месяц.`;
  - the user can re-enable from the same card.

## Setup Behavior

When enabled, the card exposes a compact inline setup via `Настроить пункты`.

Available items:

- `Питание в рамках цели`;
- `Тренировка / активность`;
- `Вода`;
- `Проверить Progress`.

Saving is allowed only when at least one historical objective item is selected:

- `Питание в рамках цели`;
- `Тренировка / активность`.

This prevents a `progress_check`-only setup from producing misleading month history.

## Preference Storage

MVP preferences are stored in `localStorage` with a per-user key:

- `progress_daily_goal_preferences_v1_<user_id>`

Storage is best-effort. If localStorage is unavailable or corrupted, the card falls back to the default enabled configuration.

## Default Behavior

Existing users keep the current visible behavior by default:

- block enabled;
- selected items:
  - `nutrition`;
  - `activity`;
  - `water`;
  - `progress`.

## Selected Item Completion Logic

Today score counts only selected checklist items.

Rules remain unchanged:

- nutrition completes only within `90-110%` of the calorie target;
- workout/activity completes when workout entries exist;
- water is today-only from existing `DailyMeals.water`;
- Progress check is UI-only for the current Progress session.

## Month Metric Logic

Month metric is read-only and recalculated from existing objective history.

It counts only selected historical objective items:

- if `nutrition` is selected, a historical day must be within the calorie target range;
- if `activity` is selected, a historical day must have workout/activity entries;
- if both are selected, both must be true;
- `water` is excluded from month history;
- `progress_check` is excluded from month history.

## Guardrails

- Checklist does not create food diary entries.
- Checklist does not create workout sessions.
- Checklist does not write water values.
- Month does not count `progress_check`.
- Month does not count local-only water history.
- No Today, AI, Plan Store, Coach, or payment logic was added.

## Tests Run

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 43
pass 43
fail 0
```

## Build Result

```text
npm run build
```

Result: passed.

Existing non-blocking build warnings remain:

- baseline browser mapping data age;
- Browserslist data age;
- existing `mealService` dynamic/static import overlap;
- large bundle chunk warning.

## Known Limitations

- Preferences are local to the current browser/device.
- Progress check remains UI-session only.
- Water remains today-only for this layer.
- There is no cross-device sync for the Daily Goal preferences yet.
- Component tests cover static render/source behavior; no browser visual test was added in this package.

## Future Supabase Sync Recommendation

If this customization becomes durable product behavior, add a separate owner-approved package for Supabase sync:

- schema/RLS design for user Progress Daily Goal preferences;
- migration draft;
- conflict behavior between local and remote preferences;
- tests for no diary/workout/water writes;
- rollout plan preserving current default-enabled behavior.

## Final Status

The Progress Daily Goal/Game Layer can now be enabled/disabled and customized directly inside the `Цель дня` card. The implementation stays local, free, read-only for diary facts, and safe for the current Progress scope.
