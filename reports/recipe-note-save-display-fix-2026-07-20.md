# Recipe Note Save And Display Fix

- Timestamp: 2026-07-20T00:00:00+03:00
- Scope: recipe note save/read/display path
- Production DB changes: none by Codex
- Migrations/backfill/recompute/history mutations: not run
- Final verdict: **FRONTEND_BUILD_PASS_WITH_SCHEMA_DRAFT_FOR_PERSISTENT_NOTES**

## Root Cause

Saving a recipe from a meal accepted a note in `SaveMealAsRecipeModal`, but `recipesService.createRecipeFromMeal()` only copied it into `recipe.instructions`.

The actual UI note display path uses `recipeNotesService` and the optional `recipe_notes` table:

- `RecipesGrid` loads notes with `recipeNotesService.getNotesByRecipeIds()`;
- `RecipesList` loads notes with `recipeNotesService.getNotesByRecipeIds()`;
- `RecipeDetails` loads and edits notes with `recipeNotesService.getNoteByRecipeId()` / `saveNote()`.

Because create-from-meal did not call `recipeNotesService.saveNote()`, the note was not available to the card/detail note display path.

## Production Schema Check

Read-only REST probe against production `dtsdnhbcwpbfrhcazqkb` returned:

- HTTP status: `404`;
- code: `PGRST205`;
- message: `Could not find the table 'public.recipe_notes' in the schema cache`.

So durable cross-device recipe notes require an additive schema migration before Supabase persistence can work.

## Frontend Fix

- `createRecipeFromMeal()` now saves the modal note through `recipeNotesService.saveNote(userId, recipe.id, note)` after the recipe row is created.
- `recipeNotesService.saveNote()` now writes localStorage before attempting Supabase.
- `recipeNotesService.getNoteByRecipeId()` and `getNotesByRecipeIds()` now return localStorage fallback when `recipe_notes` is absent or unavailable.
- `recipeNotesService.deleteNote()` now deletes localStorage fallback first.
- Existing `RecipesGrid`, `RecipesList`, and `RecipeDetails` display paths now receive the saved note through the service they already use.

## Schema Draft

Prepared but did not run:

```text
scripts/sql/production-add-recipe-notes-draft.sql
```

The draft is additive:

- creates `public.recipe_notes`;
- adds user/recipe unique index and lookup indexes;
- enables/forces RLS;
- grants authenticated CRUD;
- creates owner-only select/insert/update/delete policies;
- adds updated_at trigger;
- reloads PostgREST schema.

## Verification

- `npm run build`: PASS.
- Local production bundle from build: `main-BvuvuMvv.js`.
- Targeted `npx tsx --test ...`: BLOCKED before assertions by local tooling mismatch:
  - host esbuild `0.27.3`;
  - binary esbuild `0.21.5`.

## Manual Smoke Checklist

1. Open a meal with products.
2. Tap save meal as recipe.
3. Enter recipe name and a note.
4. Save.
5. Open "Мои рецепты" in the same browser.
6. Confirm the recipe card/list shows the note.
7. Open recipe details.
8. Confirm the note is visible.
9. Edit the note from recipe details.
10. Return to recipes and confirm the updated note is visible.

Until `recipe_notes` schema is approved/applied, notes are local to the browser profile.
