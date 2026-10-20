# POTOK — Issue #170: live audit findings and proposed implementation gates

**Date:** 2026-10-19  
**Status:** TECHNICAL AUDIT / PROPOSED PLAN — **NOT APPROVED FOR IMPLEMENTATION**  
**Scope:** Nutrition Integrity V1, Free diary and recipes, future Premium / Today.  
**Source boundaries:** read-only inspection of GitHub `master`, Draft PR #169, #172 and **metadata/function definitions** in the active POTOK Supabase project. No user food or diary rows inspected. No role impersonation, write tests, migration, or production rollout performed.

## 1. Executive verdict

**NO-GO for direct production/runtime rollout of Nutrition Integrity V1.** Current diary fields and paths do not consistently preserve native quantities and certainty; database RLS limits ownership but does not enforce nutritional correctness. No required nutrition integrity trigger currently exists on `public.food_diary_entries`. The v1 design contract in Draft PR #169 is **not installed** and its SQL is explicitly non-applicable. Do not merge or apply SQL based on this audit alone.

Preserve **PLAN != FACT**, immutable historical nutrition snapshots, `null` for unknown fiber, never fabricate mass or KБЖУ and never claim legacy numbers are `CONFIRMED` merely because values exist.

## 2. Confirmed read-only evidence

### GitHub code
- `src/services/diaryCreateService.ts`: `CreateDiaryEntryRequest.weight_g` is required; `calculateDiarySnapshot` scales current food nutrients per 100 g, while fiber can remain null. This is application service logic, **not a DB-enforced universal write barrier**.
- `src/services/mealService.ts`: numerous DB access paths, including direct `food_diary_entries` writes; `saveMealsForDate` has a legacy upsert route and fallback which removes display unit fields after schema errors. The app must not silently strip future integrity metadata.
- `src/pages/CreateCustomProductPage.tsx`: UI offers per-100-g, per-100-ml, and per-portion entry, but current creation/diary path does not retain the selected native nutrient basis and writes grams.
- `src/pages/RecipeAnalyzer.tsx`, `src/pages/RecipeDetails.tsx`, `src/services/recipesService.ts`, `src/services/recipeDiaryService.ts`: analyzer derives per-100-g from summed input-ingredient masses; saved recipe does not represent the approved optional cooked yield and two bases; diary entry uses a generated per-save recipe ID, not a stable saved-recipe linkage.
- `src/utils/nutritionCalculator.ts`: unresolved ingredients are excluded from the totals; avoid representing partial totals as complete.
- Draft PR #169 `codex/nutrition-integrity-v1-contract` (head `52742c69ae9316fdf772dd83945c7f95f856a4ca`) provides a reference calculator, synthetic tests, contract, and **design-only SQL**; not runtime-connected. SQL deliberately raises an exception immediately.
- Draft PR #172 holds owner-approved requirements for food drafts, calorizator recovery, and raw/cooked recipe variants. These are **product requirements**, not evidence of current implementation.

### Live Supabase: POTOK (metadata only)
- Active project `POTOK` (ref `dtsdnhbcwpbfrhcazqkb`) inspected. Separate inactive staging project was **not** altered.
- `foods`, `food_diary_entries`, `recipes`, `recipe_ingredients` have both RLS and FORCE RLS enabled.
- Policies for authenticated users implement owner-scoped access: `food_diary_entries.user_id = auth.uid()`; `recipes.user_id = auth.uid()`; `recipe_ingredients` ownership through parent recipe; `foods` catalog SELECT and owner-scoped personal foods. **Static policy reading does not replace actual cross-user/role tests.**
- `food_diary_entries.weight` is `numeric(8,2) NOT NULL` with a positive-weight CHECK marked `NOT VALID`. Calories/protein/fat/carbs are `numeric(8,2) NOT NULL`; fiber is nullable. Its `integrity_contract_v1`, `integrity_status_v1`, `source_amount_v1`, `source_unit_v1`, `nutrient_basis_v1` columns are absent.
- No application nutrition-integrity INSERT/UPDATE trigger on `food_diary_entries` was found.
- `recipe_ingredients.amount_g` is positive `numeric(10,2)`; recipe total recalculation is triggered AFTER INSERT/DELETE/UPDATE of graph ingredients by `trg_recipe_ingredients_recompute`.
- `public.recompute_recipe_totals(recipe_uuid)` calculates recipe calories/macros from joined `foods` using `amount_g/100`; its computation assumes a valid underlying gram basis. It is `SECURITY INVOKER` and `EXECUTE` is granted to `anon`/`authenticated` (actual RLS and access behavior remain to be tested).
- `public.recompute_food_entries_for_food_ids(food_ids uuid[])` is `SECURITY DEFINER`. It checks `user_profiles.is_admin = true` for `auth.uid()`, then UPDATEs **historical** diary calories/macros/fiber from today's food values and existing weight. Its `EXECUTE` ACL is available to `anon`/`authenticated`, but internal admin check prevents concluding from ACL alone that arbitrary users can invoke it successfully. This function conflicts with the historical-snapshot principle if executed on past records.
- Other schema constraints and current direct-write grants are **not sufficient evidence** of Nutrition Integrity protection.

## 3. Risks and gates

| Priority | Confirmed issue | Required gate |
|---|---|---|
| BLOCKER | Numeric diary requires gram mass; native ml/portion may have unknown grams | Approve additive native-amount schema/API including nullable normalized grams and all readers/writers |
| BLOCKER | Missing authoritative stored integrity status, provenance, source quantity/basis | Approve versioned nullable metadata, read semantics and trustworthy authoritative resolver |
| BLOCKER | DB does not enforce one nutrition write gate | Design server/DB recomputation and classify on every nutrition-changing INSERT/UPDATE, including direct PostgREST, old clients and admin paths |
| BLOCKER | Admin recompute can rewrite prior snapshots | Inventory its callers, design no-retroactive-recompute guard/replacement and explicit admin procedure review |
| HIGH | Recipe total trigger assumes per-100-g product values | Validate ingredient food basis/current evidence before recomputation; prevent partial/false totals |
| HIGH | Separate client writers/upsert and stripped-field retry | Full writer matrix plus safe coordinated cutover; no silent downgrade of metadata |
| HIGH | Combined save, recipe ingredient delete/insert, generated recipe IDs | Atomicity/partial-failure/identity review; stable recipe association and diary snapshot |
| HIGH | Missing cooked-yield/dual-basis recipe storage | One recipe with raw/cooked calculation bases, captured yield and provenance; never rewrite logged history |
| HIGH | RLS policy definitions/EXECUTE not yet role-tested | Anon/user A/user B/admin/service-role matrix in disposable staging |
| HIGH | Autodrafts and partial calorizator text not persisted | Separate durable draft architecture and offline/recovery UX audit (not a substitute for confirmed diary data) |

## 4. Proposed implementation sequence (each gate requires owner approval)

**Gate 0 — complete read-only preflight:** refresh exact `master` and all dependent PR heads; inspect all caller/writer routes (including basket, scan, recipe, update/copy, search, photo, `saveMealsForDate`, direct PostgREST), functions, grants, triggers, dependencies of `recompute_food_entries_for_food_ids`, existing recipe graph, user-defined units and source-specific legacy basis provenance. Inspect only needed schema metadata; do not read private user rows without separate approval.

**Gate 1 — owner policy decisions:** confirm safe handling of older user-created food with unknown basis, curated legacy per-100-g evidence, permitted user-declared density/portion measures as **ESTIMATE**, native ml/portion save when gram mass unknown, eligible usage of ESTIMATE in Free/Progress/Premium. Distinguish **confirmed consumption FACT** from **confidence in nutrition estimate**; neither implies the other. Honor owner-approved dual raw/cooked recipe design and drafts.

**Gate 2 — versioned contract and executable migration draft:** develop reviewed-evidence authority integration, `source_amount/unit`, nutrient basis, provenance, nullable `normalized_grams`, integrity status/refs, recipe revision & raw/cooked mass/basis, and reliable diary snapshots, subject to current schema and dependent readers. No backfill or old-history rewrite. Explicit ownership policies, narrowed function EXECUTE as appropriate, privileged bindings protected against clients. SQL review only; **separate approval before execution**.

**Gate 3 — trusted write implementation:** one server-resolved mechanism computes nutrients, verifies amount/basis and evidence, prevents clients assigning CONFIRMED, rejects/returns UNKNOWN without fabricated numeric diary rows, preserves fiber null. DB protection must cover direct writes, old clients, admin operations and all relevant mutation paths. Ensure idempotency compares native amount/unit and resolved evidence/revision, not only a derived mass.

**Gate 4 — app and recipe integration:** update product creation, native-amount entry, modal/basket/copy/edit, recipe analyzer and saved personal recipes, raw/cooked basis selector and optional cooked yield; use stable recipe identity and persisted immutable diary snapshot. Preserve user's incomplete input on failure; connect multiple auto-saved drafts via separately reviewed storage.

**Gate 5 — isolated verification and rollout:** use disposable/staging DB (currently staging project is inactive; do not activate it without approval), role and RLS matrix, direct PostgREST injection tests, negative/unknown/error cases, evidence revision invalidation, ml/g/l/spoons/portions, raw/cooked recipe serving, concurrent saves, offline/restart/drafts, admin recompute, history consistency, old-client compatibility, idempotency, rollback safety. Review each phase and obtain explicit production migration/rollout approval.

## 5. Strict prohibitions and acceptance conditions

- No schema/SQL execution, production writes, merge, tag, or rollout under this documentation-only approval.
- Never treat `unit=g` or presence of numerical KБЖУ as reviewed `CONFIRMED`.
- Never assume `1 ml = 1 g`, or let a `PER_100_ML` value flow into the 100-g writer.
- Never persist UNKNOWN by substituting zero; missing fiber remains null, and a missing fiber value alone must not silently fabricate status.
- Never reclassify or recalculate historical diary entries when a product or recipe changes.
- Existing legacy Free diaries must remain usable with **honest ESTIMATE status** where defensible, rather than indiscriminately blocked.
- Treat product decisions in PR #172 and the architecture from PR #169 as **inputs**, not permission to install them directly.
- Require functional server enforcement, role tests, and staged acceptance tests before any production execution.

## 6. Current status and next recommended action

**Audit documented; code/runtime is NOT implemented.** Before executable schema or implementation, complete Gate 0 call-path inventory (notably all callers of the admin history-recompute function) and owner decisions at Gate 1. Then prepare a reviewed migration + server resolver proposal for separate sign-off.

References:
- Issue #170: https://github.com/Tatianos7/POTOK/issues/170
- Issue #171: https://github.com/Tatianos7/POTOK/issues/171
- Draft PR #169: https://github.com/Tatianos7/POTOK/pull/169
- Owner decisions Draft PR #172: https://github.com/Tatianos7/POTOK/pull/172
