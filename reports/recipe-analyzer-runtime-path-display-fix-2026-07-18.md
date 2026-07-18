# Recipe Analyzer Runtime Path Display Fix

- Timestamp: 2026-07-18T19:35:00Z
- Scope: frontend-only Recipe Analyzer display/calculation mismatch
- Production DB changes: none
- Migrations/import/apply/backfill/recompute/diary writes: not run

## Runtime Path

Observed source path:

1. `RecipeAnalyzer.handleAnalyze`
2. `recipeAnalyzerService.analyze`
3. `analyzeRecipeTextReal`
4. `parseRecipeText`
5. `CalculatedIngredient[]` stored in `RecipeAnalyzer` state
6. `RecipeAnalyzerResult`
7. `RecipeIngredientsTable`

No separate service worker or PWA runtime cache path was found in the repo.

## Field Contract

For UI rendering:

- `originalAmount`
- `originalUnit`
- `displayAmount`
- `displayUnit`
- `amountText`

For calculation:

- `gramsEquivalent`
- `quantity_g`

The UI must not render `gramsEquivalent` / `quantity_g` as the entered quantity.

## Expected Field Trace

| ingredient | originalAmount | originalUnit | displayAmount | displayUnit | gramsEquivalent | quantity | quantity_g | rendered |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | --- |
| `вода` | 500 | `мл` | 500 | `мл` | 500 | 500 | 500 | `500 мл` |
| `лук репчатый` | 1 | `шт` | 1 | `шт` | 110 | 1 | 110 | `1 шт` |

## Fix

- Added explicit `originalAmount`, `originalUnit`, `quantity`, and `quantity_g` fields to parsed analyzer ingredients.
- `RecipeIngredientsTable` now renders original/display units first.
- `calcTotals` and analyzer macro calculation use `quantity_g` / `gramsEquivalent`.
- `RecipeAnalyzer.handleAnalyze` logs `[RecipeAnalyzer] runtime ingredient field trace` with the exact fields above for manual smoke debugging.
- Regression coverage added for parser/analyzer fields and rendered result markup.

## Expected Manual Smoke

Input:

```text
250 грамм чечевицы, вода 500 мл., лук репчатый 1 шт., говядина 300 грамм
```

Expected UI:

- `чечевица 250 г`;
- `вода 500 мл`;
- `лук репчатый 1 шт`;
- `говядина 300 г`;
- onion macro calculation uses `110 г` equivalent internally.
