# My Products Entry From Food Diary Add Modal MVP Plan

- Date: 2026-09-07
- Branch: `master`
- Target package: `MY_PRODUCTS_ENTRY_FROM_FOOD_DIARY_ADD_MODAL_MVP_PLAN`
- Verdict: **MY_PRODUCTS_ENTRY_FROM_FOOD_DIARY_ADD_MODAL_MVP_PLAN_READY**

## Scope

Plan the MVP update for the main Food Diary "Добавить продукт" modal in POTOK. The owner decision is to keep existing configured buttons unchanged and add two new entries: `Найти продукт` and `Мои продукты`.

This is plan/report-only. Runtime code was not changed, UI was not changed, Supabase SQL was not executed, staging was not mutated, production was not touched, Open Food Facts integration was not added, API clients were not added, Premium write paths were not touched, and no PR/commit was created.

## 1. Product Goal

The goal is to improve the main diary add entry point without breaking existing configured scenarios.

Product goals:

- give the user a fast entry into normal food search;
- give the user fast access to products they created themselves;
- keep existing tuned flows unchanged;
- avoid mixing `Мои продукты`, `Избранное`, and `Часто используемые`;
- preserve diary snapshot behavior when a selected product is added;
- keep shared catalog quality protected from user-created private foods.

Owner correction:

- Do not rename existing buttons.
- Existing labels are already configured and should remain stable.
- Add new buttons above them.

## 2. Current Modal

Current buttons to keep unchanged:

- `Ввод марки продукта`
- `Ввод своего продукта`
- `Анализатор рецепта`

These should keep their current labels, routing, tracking assumptions, and product meaning.

## 3. New Modal Structure

Recommended button order:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод марки продукта`
4. `Ввод своего продукта`
5. `Анализатор рецепта`

Reasoning:

- `Найти продукт` is the broadest and most common action.
- `Мои продукты` gives quick access to user-owned private foods.
- Existing creation/analyzer flows remain available and unchanged after the two new discovery entries.

## 4. Button Behavior

`Найти продукт`:

- Opens the existing normal food search experience.
- Search can include core/brand catalog and owned user foods according to existing search rules.
- Does not add Open Food Facts runtime search.
- Does not create new products by itself.

`Мои продукты`:

- Opens a list/screen/sheet of private foods created by the current user.
- Allows selecting a private food, entering weight, and adding it to diary through the existing diary-safe path.
- Does not show other users' private foods.

`Ввод марки продукта`:

- Keeps the current configured brand-product creation flow.
- Label remains unchanged.
- Behavior remains unchanged in this MVP plan.

`Ввод своего продукта`:

- Keeps the current custom/private product creation flow.
- Label remains unchanged.
- Behavior remains unchanged in this MVP plan.

`Анализатор рецепта`:

- Keeps the current recipe analyzer flow.
- Label remains unchanged.
- Behavior remains unchanged in this MVP plan.

## 5. My Products Behavior

`Мои продукты` should show only foods owned by the current user:

- `source='user'`;
- `created_by_user_id=current user`;
- no other user's private products are visible.

Expected user flow:

1. User opens `Добавить продукт`.
2. User taps `Мои продукты`.
3. App shows user's private foods.
4. User selects a product.
5. User enters weight.
6. App adds the product to diary through existing diary creation behavior.

Meal behavior:

- If opened from the main diary add button, the user must choose `meal_type`.
- If later opened from `+` inside a specific meal section, `meal_type` can be preselected.

The selected private product should remain a normal diary food source only for its owner. Diary entries should store calculated snapshot values and should not depend on later product edits for historical recomputation.

## 6. Data Rules

User-created product rules:

- A user-created product is stored as a private food.
- It remains scoped to the creating user.
- It does not automatically become part of the shared POTOK catalog.
- It does not become a verified catalog row.
- It does not enter Premium plans.
- It does not become public search content for other users.

Later phase:

- Candidate queue/review for promoting user-created foods into the shared catalog is a later phase.
- Promotion must remain explicit and owner/admin-reviewed.
- This MVP modal entry does not create or apply candidate review schema.

## 7. Section Differences

`Мои продукты`:

- Products created by the current user.
- Private owned foods.
- Filtered by `source='user'` and `created_by_user_id=current user`.

`Избранное`:

- Products explicitly saved/favorited by the user.
- Can include shared catalog foods or other allowed product types depending on existing favorite rules.
- It is not the same as products the user created.

`Часто используемые`:

- Automatic list derived from diary history/usage.
- It is not manually created product ownership.
- It should not be confused with favorites or private product creation.

`Найти продукт`:

- General search entry.
- Searches approved food sources according to existing search rules.
- Can include core/brand foods and owned user foods.
- Does not mean "only my products."

## 8. Implementation Phases

### A. Route / Component Audit

- Locate the current Food Diary add modal component.
- Confirm current routing/handlers for the three existing buttons.
- Confirm existing food search route/entry.
- Confirm current private user food query/service behavior.
- Confirm diary add flow requirements for `meal_type` and `weight_g`.

### B. Add New Buttons To Existing Modal

- Add `Найти продукт` and `Мои продукты`.
- Preserve existing button labels exactly:
  - `Ввод марки продукта`
  - `Ввод своего продукта`
  - `Анализатор рецепта`
- Use the recommended order.
- Avoid changing existing button behavior.

### C. Implement My Products Screen / Sheet

- Create or reuse a focused view for user private foods.
- Keep it distinct from favorites and frequently used sections.
- Include empty state for users with no private products.
- Include loading/error states.

### D. Connect Private User Foods List

- Query only current user's private foods.
- Enforce `source='user'`.
- Enforce `created_by_user_id=current user`.
- Do not rely only on UI filtering if service/RLS paths can enforce ownership.

### E. Add Selected Product To Diary

- Let the user enter weight.
- Require meal selection when opened from the main add button.
- Use preselected meal when launched from a specific meal section later.
- Use existing diary snapshot-safe creation path.

### F. Tests / Smoke / Review / Deploy

- Add focused tests for modal buttons and navigation.
- Add service/component tests for private food filtering.
- Add diary add tests for selected private product.
- Smoke existing flows.
- Review before deploy.

## 9. Tests Later

Future tests should cover:

- modal keeps `Ввод марки продукта` unchanged;
- modal keeps `Ввод своего продукта` unchanged;
- modal keeps `Анализатор рецепта` unchanged;
- modal shows `Найти продукт`;
- modal shows `Мои продукты`;
- `Найти продукт` opens existing food search;
- `Мои продукты` lists only current user's private foods;
- another user's private foods are not visible;
- product can be selected from `Мои продукты`;
- selected private product can be added to diary;
- meal is required when opened from the main add button;
- meal is preselected when opened later from a specific meal `+` entry;
- existing brand/custom/analyzer flows are not broken;
- diary snapshot values remain correct after add;
- user-created private foods do not enter verified catalog;
- user-created private foods do not enter Premium plans.

## 10. Non-Goals

This MVP plan does not include:

- renaming existing modal buttons;
- Open Food Facts integration;
- external provider search;
- API clients;
- Supabase SQL;
- RLS policy changes;
- candidate queue schema apply;
- Premium write paths;
- public catalog promotion;
- recipe import;
- production rollout.

## 11. Risks

Risks:

- Existing tuned modal flows could regress if handlers are refactored unnecessarily.
- Users may confuse `Мои продукты` with `Избранное` unless sections stay distinct.
- Private user foods could leak if filtering relies only on UI code.
- Adding from the main modal can be ambiguous unless `meal_type` is required.
- Historical diary snapshots could become unstable if add flow stores preview values instead of canonical/snapshot values.

Mitigations:

- Keep existing button labels and handlers stable.
- Add only two new entries.
- Use existing service/RLS-safe private food visibility rules.
- Add tests before runtime change.
- Keep candidate review/promotion for a later package.

## 12. Recommended MVP

Recommended MVP:

- Add `Найти продукт` as the first modal entry.
- Add `Мои продукты` as the second modal entry.
- Keep the three existing entries unchanged.
- Implement `Мои продукты` as a private user foods list only.
- Add selected private food through the existing diary snapshot-safe path.
- Require meal selection when launched from the main add button.

Recommended final modal order:

1. `Найти продукт`
2. `Мои продукты`
3. `Ввод марки продукта`
4. `Ввод своего продукта`
5. `Анализатор рецепта`

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
- no runtime code changes;
- no UI changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no Open Food Facts integration;
- no API clients;
- no API keys;
- no secrets;
- no DB writes;
- no RLS policy changes;
- no Premium writes;
- no payment enforcement;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**MY_PRODUCTS_ENTRY_FROM_FOOD_DIARY_ADD_MODAL_MVP_PLAN_READY**
