# Offline authoring week preview

The owner deferred physical recipe testing until application testing before launch. This step actually runs bounded offline selection over the existing master recipe references. It never supplies draft data to the trusted runtime or emits fabricated validation/evidence.

## Reuse and scope

`boundedCartesianIndexesV1` extracts the strict week search's existing ordered, last-axis-fastest bounded traversal. The strict search continues to validate each visited week through the same real V2 validator, with unchanged limits/results. The new offline script reuses only this traversal. It does not claim to run the full admitted worker, optimizer or trusted week validator over the draft catalog.

The authoring experiment reads the existing exporter, rechecks finite reference nutrients and declared servings, and retains whole source portions. It sums the already per-serving references without dividing by declared recipe servings again. Unknown cooked grams remain null. It never treats workbook reference carbohydrate as independently confirmed available carbohydrate.

Scenario inputs explicitly declare meal category mappings, calorie target/tolerance, shortlist limits, day/week budgets and maximum recipe uses. The example uses LUNCH for the evening slot because the master has no primary DINNER category. This is a visible authoring assumption, not runtime applicability approval. No allergy/dietary filtering is claimed from unverified tags.

For each slot, reference candidates are ordered by distance from the declared calorie share and stable semantic ID. A bounded nearest prefix is rotated per day into shortlists. Each day enumerates whole-portion combinations, rejects duplicate recipe IDs, checks reference calorie tolerance and retains options with different recipe IDs. Week traversal checks the recipe-ID repeat cap and minimizes summed calorie distance among visited combinations. This is authoring shortlist policy, not a new production nutrition policy. Recipe families, protein targets, convenience and shopping optimization are not assessed.

```sh
node --import tsx scripts/contracts/recipe-authoring-week-preview-v1.ts MASTER.xlsx docs/premium/authoring-week-scenario-20261103.json
```

The script reads files and prints a separately versioned `potok-recipe-authoring-week-preview-v1` JSON report. It has no database, publication, worker deployment or activation operation. No source recipe bodies are committed to this repository.

## Actual source experiment, 2026-11-03

Master SHA-256 remains `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`. Of 132 recipes, 122 supply complete numeric reference inputs. Experiments use four slots, one whole declared serving per slot, 10% reference calorie tolerance, at most two uses of a recipe per week, ranked prefixes of up to twelve candidates per slot, four candidates per daily slot, four retained day options, 256 evaluations per day and 1024 per week. Targets below are technical inputs, not the owner's personal calorie prescription.

| Test calorie target | Result in evaluated pools | Distinct recipes | Daily reference kcal range |
| --- | --- | ---: | --- |
| 1400 | REFERENCE_WEEK_PREVIEW | 22 | 1400.0–1449.1 |
| 1600 | REFERENCE_WEEK_PREVIEW | 24 | 1567.7–1607.1 |
| 1800 | REFERENCE_WEEK_PREVIEW | 22 | 1671.0–1757.8 |
| 2000 | NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS | — | No selected week |

The three previews have `BEST_EVALUATED_PREFIX` scope: only 1024 of the retained 16384 week combinations were visited. Failure at 2000 is not proof of whole-catalog infeasibility. Neither target, tolerance nor portions are automatically relaxed. Missing categories, no matching evaluated day, week budget exhaustion and exhaustion of the retained pool remain separate diagnostics. The earlier naïve calorie-only day retention could hide alternative recipe choices; explicit day-pool diversity fixes that without changing the repeat cap.

## Validation and remaining work

Tests exercise shared enumeration order/ownership/budget, the original strict search, actual offline arithmetic and whole portions, deterministic ordering, repeat caps, missing DINNER, missing nutrients and unknown grams, malformed scenarios, and budget-versus-pool exhaustion. The actual source experiments are checked against original exported per-serving values and recipe IDs.

These reports remain unverified draft/reference content. They are not accepted Graph V2 plans, actual measured yields, a source publication, a complete safety review, a hosted Auth/PostgREST E2E, or proof that these particular weeks were stored by the server. The next connection is an explicitly marked test menu viewer. PLAN remains distinct from FACT, the source workbook is unchanged and the generator stays inactive.
