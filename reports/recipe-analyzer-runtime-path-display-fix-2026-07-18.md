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

After `main-Dp0d-EJ1.js` was manually confirmed in production, the remaining mismatch pointed away from cache/deploy and back to parser unit detection.

## Root Cause

The parser used JavaScript `\b` word boundaries around Cyrillic unit tokens such as `мл`, `шт`, and `грамм`.

JavaScript `\b` is based on ASCII-style `\w` behavior, so Cyrillic tokens followed by punctuation, for example `мл.` and `шт.`, were not reliably detected as units.

When unit detection failed:

- `вода 500 мл.` fell back to default grams and rendered/calculated as `500 г`;
- `лук репчатый 1 шт.` fell back to default grams and rendered/calculated as `1 г`.

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
- Added Unicode-safe unit token detection before the legacy `\b` regex path.
- `RecipeAnalyzer.handleAnalyze` now uses `console.warn` and renders a temporary visible runtime trace block so manual smoke can confirm the actual handler and props path.

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
