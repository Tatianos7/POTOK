# Today Premium Replace Meal UI Mock

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_MEAL_DETAIL_UI_MOCK_READY`
  - `TODAY_PREMIUM_MEAL_DETAIL_VISUAL_POLISH_READY`
- Verdict: **TODAY_PREMIUM_REPLACE_MEAL_UI_MOCK_READY**

## Scope

Implemented a UI-only mock replacement flow inside `/today` for the Premium `Мой Поток` meal detail screen.

No DB/schema/storage, payment/auth, diary/workout writes, recipe import, shopping list runtime, AI runtime, voice input, or PR work was done.

## Changed Files

- `src/pages/Today.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `reports/today-premium-replace-meal-ui-mock-2026-08-22.md`

## Implemented UI

Meal detail now opens a separate local `replace_meal` view when the user clicks `Заменить блюдо`.

Replace meal screen:

- back arrow returns to meal detail;
- centered title uses the meal type, for example `Заменить завтрак`;
- X closes back to Home;
- intro text: `Выберите похожий вариант по КБЖУ.`;
- filter chips:
  - `Проще`;
  - `Меньше калорий`;
  - `Больше белка`;
  - `Без готовки`;
  - `Похожее КБЖУ`;
- compact replacement rows:
  - `Омлет с овощами` — `420 ккал · Б 28 · Ж 18 · У 32`;
  - `Творог с ягодами` — `390 ккал · Б 32 · Ж 9 · У 42`;
  - `Сэндвич с индейкой` — `430 ккал · Б 30 · Ж 12 · У 48`;
- bottom CTA `Выбрать замену`, disabled until an option is selected.

## Local Mock Behavior

Selecting a replacement updates local component state only.

After confirmation:

- screen returns to meal detail;
- selected meal title/КБЖУ/ingredients/portion hints/preparation steps can display the selected mock replacement;
- no diary write is performed;
- no recipe table or runtime catalog is touched.

Future implementation note:

- day-level КБЖУ recalculation is intentionally not implemented yet;
- shopping list recalculation/runtime is intentionally not implemented yet.

## Tests

Targeted Today tests passed:

- `npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx`

Covered:

- `Заменить блюдо` opens replace meal view;
- replace title `Заменить завтрак`;
- filter chips render;
- replacement options render with КБЖУ and notes;
- `Выбрать замену` is disabled until a selection exists;
- selected replacement can appear in meal detail mock data;
- back returns to meal detail;
- no diary/write/payment/AI actions are introduced.

## Verification

- Targeted Today tests: passed, `31/31`.
- `npm run build`: passed.
- `git diff --check`: passed.

## Safety Confirmation

- No DB/schema/storage changes.
- No migrations.
- No payment/auth changes.
- No diary/workout writes.
- No recipe import.
- No shopping list runtime.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_REPLACE_MEAL_UI_MOCK_READY**
