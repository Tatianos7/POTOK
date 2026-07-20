# Recipe Analyzer Unit Normalization Production Fix

- Timestamp: 2026-07-19T00:00:00+03:00
- Scope: frontend-only Recipe Analyzer unit parsing, display, and calculation
- Production DB changes: none
- Migrations/import/apply/backfill/recompute/diary writes: not run
- Final verdict: **FRONTEND_BUILD_PASS_TEST_RUNNER_BLOCKED_BY_LOCAL_ESBUILD_MISMATCH**

## Runtime Fix

- Replaced the short-window unit lookup with one centralized RU unit normalizer.
- Recognized units now include:
  - `г`, `гр`, `грамм`, `граммов`;
  - `кг`, `килограмм`;
  - `мл`, `миллилитр`;
  - `л`, `литр`;
  - `шт`, `штука`, `штуки`;
  - `ч.л.`, `чайная ложка`;
  - `ст.л.`, `столовая ложка`;
  - `ложка`, `ложки`;
  - `щепотка`;
  - `зубчик`;
  - `ломтик`, `кусок`;
  - `стакан`.
- UI display fields preserve original amount/unit separately from calculation grams.
- Calculations use `gramsEquivalent` / `quantity_g`.
- Unknown units no longer silently fallback to grams.
- Recognized units without a product conversion rule produce a warning and remain unresolved, blocking save.

## Conversion Rules Added

| input unit/product | grams equivalent |
| --- | ---: |
| `лук репчатый 1 шт` | 110 |
| `масло оливковое 1 столовая ложка` | 13.5 |
| `масло растительное 1 столовая ложка` | 13.5 |
| `вода 1 мл` | 1 |

## Regression Coverage

Added regression assertions for:

- `вода 500 мл` -> display `500 мл`, `gramsEquivalent = 500`;
- `лук репчатый 1 шт` -> display `1 шт`, `gramsEquivalent = 110`;
- `масло оливковое 1 столовая ложка` -> display `1 столовая ложка`, `gramsEquivalent = 13.5`;
- unknown unit `мерка` -> display retained, `gramsEquivalent = 0`, unresolved warning.

## Verification

- `npm run build`: PASS.
- Local production bundle from build: `main-C-E07WJp.js`.
- `npx tsx --test src/services/__tests__/recipeAnalyzerReal.food-core.test.ts`: BLOCKED before assertions by local tooling mismatch:
  - host esbuild `0.27.3`;
  - binary esbuild `0.21.5`.

## Debug Cleanup

- Removed temporary visible runtime trace from Recipe Analyzer.
- Removed temporary console warning trace.
