# TODAY Premium Recipes Separation Spec

- Date: 2026-08-21
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_SMART_DAY_PRODUCT_SPEC_READY`
  - `TODAY_SMART_DAY_DEMO_FLOW_READY`
  - `TODAY_SMART_DAY_DEMO_FLOW_IA_CLEANUP_READY`
- Verdict: **TODAY_PREMIUM_RECIPES_SEPARATION_SPEC_READY**

## Scope

Reports/spec only.

No runtime code, DB/schema/storage changes, migrations, production data changes, payment, AI runtime, diary writes, recipe import, PR, or commit work was done.

## Problem

POTOK already has recipes inside the food diary.

The word `recipes` can now mean two different product objects:

- recipes created by the user in the diary;
- ready-made POTOK recipes for TODAY Premium.

These must be separated clearly so free diary recipes do not become premium catalog content, and premium recipes do not mix with private user-created recipes.

## Definitions

### User Recipe

A recipe created by a user.

Product meaning:

- free diary feature;
- belongs to `Мои рецепты`;
- created and edited by the user;
- used by the user to add food to the diary.

### Premium Recipe

A ready-made recipe created by POTOK/owner/content team.

Product meaning:

- TODAY Premium content;
- belongs to `Готовые рецепты POTOK`;
- used by Smart Day, ready-made nutrition plans, replacements, and later shopping list;
- not editable by normal users;
- not PDF/download-first.

### Meal Template

A reusable planned meal object derived from a recipe or content rule.

It describes what can appear in Today:

- meal type;
- portion;
- calories/macros target;
- prep complexity;
- replacement eligibility;
- confirmation payload later.

Meal template is planned content, not a diary fact.

### Today Meal Item

A concrete item in a Today plan for a specific date.

Example:

```text
Завтрак -> Овсянка, банан, йогурт -> Перейти в дневник / Подтвердить
```

Today Meal Item must not write to the diary automatically.

### Diary Snapshot

The actual historical diary record created after explicit user confirmation.

It should preserve enough food/recipe data so historical diary entries remain stable even if the source premium recipe changes or premium access ends.

## Product Separation

### User Recipes

User recipes are:

- labeled `Мои рецепты`;
- part of the free diary feature;
- created by the user;
- conceptually `created_by_user_id = user`;
- visible only to the owner user unless explicitly shared later;
- editable by the owner user;
- available for adding to the diary without Premium.

User recipes should not become premium catalog items automatically.

### Premium Recipes

Premium recipes are:

- labeled `Готовые рецепты POTOK`;
- TODAY Premium content;
- created by POTOK/owner/content team;
- visible only with Premium access;
- used by Smart Day, ready-made nutrition plans, and replacement flows;
- organized into:
  - breakfasts;
  - lunches;
  - dinners;
  - snacks;
- not editable by normal users;
- not mixed into `Мои рецепты`;
- not PDF/download-first.

Premium access rules must not be mixed with private user recipe access rules.

## User Flows

### A. Use Premium Recipe From Smart Day

Flow:

```text
Smart Day -> Premium Recipe Catalog -> Meal Template -> Today Meal Item -> user confirms -> Diary Snapshot
```

The recipe appears as a planned meal in Today. It becomes a diary entry only after confirmation.

### B. Replace Meal In Today With Premium Recipe

Flow:

```text
Today Meal Item -> Не подходит / Заменить питание -> Premium alternatives -> selected replacement -> Today Meal Item updated
```

Replacement updates the plan item first. Diary write still requires explicit confirmation.

### C. Browse Premium Recipe Library

Premium users can browse `Готовые рецепты POTOK` by:

- breakfast;
- lunch;
- dinner;
- snack;
- goal;
- calories;
- preparation complexity;
- tags.

Browsing is a content experience, not a diary entry.

### D. Add Premium Recipe To Diary After Confirmation

Flow:

```text
Premium Recipe -> confirm portion/details -> create Diary Snapshot
```

The diary should store snapshot data, not a fragile dependency on premium access.

If Premium expires later, historical diary entries must remain visible and nutritionally stable.

### E. Use Personal Recipe As Optional Replacement

Users may optionally choose from `Мои рецепты` as a replacement source.

This should be clearly labeled as personal content, not POTOK Premium content.

## Technical Direction - No Migration Yet

This section is direction only. No migration should be created before a read-only schema/runtime audit.

### Option A: Extend Existing Recipes Table

Possible fields:

- `source`: `user | potok`;
- `is_premium`;
- `access_tier`;
- `created_by_user_id`;
- `created_by_role`;
- `published_status`;
- `meal_type`;
- `content_tags`.

Pros:

- one recipe model;
- easier reuse in existing recipe UI and diary flows;
- fewer tables.

Cons:

- higher risk of mixing user access and premium access;
- more careful RLS required;
- user-editable and owner-published content live together;
- mistakes could expose private recipes or premium catalog content incorrectly.

### Option B: Separate `premium_recipes` Catalog

Possible model:

- `premium_recipes`;
- `premium_recipe_versions`;
- `premium_recipe_meal_templates`;
- link tables for plans and Smart Day.

Pros:

- clean access separation;
- user recipes remain private and simple;
- premium content lifecycle can have owner review/publish states;
- easier to prevent normal user edits;
- safer for future content team workflows.

Cons:

- more integration work;
- mapping needed from premium recipe to diary snapshot;
- possible duplication of recipe-like fields.

## Recommendation

Recommended safest direction for POTOK:

Start with a read-only audit of the current recipe schema/runtime, then design a separate premium catalog or clearly separated source model.

If current recipe tables already have strong ownership/access boundaries, Option A may be possible. If not, Option B is safer because premium content and private user content should not share ambiguous access rules.

Do not choose a DB path until the current recipe implementation is audited.

## Required Technical Rules

- Do not mix access rules for `Мои рецепты` and `Готовые рецепты POTOK`.
- Premium recipes should not be editable by normal users.
- User recipes should not become premium catalog content automatically.
- Diary must use snapshots for actual logged entries.
- Premium access ending must not break historical diary entries.
- Today planned meal items must not automatically create diary entries.

## Integration With Today

Target path:

```text
Premium Recipe Catalog -> Meal Template -> Today Meal Item -> Confirm -> Diary Snapshot
```

Smart Day can select recipes by:

- meal type;
- day state;
- goal;
- calories;
- prep complexity;
- replacement tags.

Ready-made plans can reference premium recipes as meal templates.

Today actions:

- `Не подходит`;
- `Заменить питание`;

can show premium recipe alternatives when the user has Premium access.

## Non-Goals

Not included now:

- payment implementation;
- DB migration;
- bulk recipe import;
- PDF/download-first recipe product;
- AI runtime;
- automatic diary writes;
- recipe import;
- production data changes.

## Recommended Next Step

Before DB design:

1. Create a read-only audit of the current recipes schema/runtime.
2. Identify existing tables, ownership fields, RLS, diary links, and snapshot behavior.
3. Decide whether Option A or Option B is safer.
4. Then design MVP content model for premium recipes and meal templates.

## Final Status

User-created recipes and POTOK premium recipes should be treated as separate product concepts with separate access rules and a snapshot boundary before diary writes.
