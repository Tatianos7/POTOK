# Nutrition Integrity V1 — implementation contract (design only)

Base: `b86ca3ec4ddf0f18a38cf2e46b5f39b5525b503f`. This package is not wired into runtime. The SQL file is an intentionally non-applicable design. It does not inspect or change Supabase or user data.

## Meaning and authority

- `PER_100_G_EDIBLE`, `PER_100_ML`, `PER_PORTION`, `UNKNOWN` describe the denominator of the **stored nutrient values**, not a UI display unit. `foods.unit`, a non-null macro value, and `foods.verified` cannot establish it.
- `REVIEWED_REVISION` means the server has resolved an active approved nutrition revision, its canonical revision and digest, applicability/food state, and absence of invalidation. The existing `NutritionReviewedRevisionV1` supports only `PER_100_G_EDIBLE`. Its decoder validates an artifact but explicitly does not prove live authority or current status. No Draft PR is imported into runtime by this package.
- `USER_DECLARED` is the owner's explicit basis for their private food. `LEGACY_CONTRACT` is a versioned, auditable source-level 100 g claim selected by a server-owned resolver, never inferred from a food's unit. Neither is `CONFIRMED`.
- `CONFIRMED` requires reviewed nutrients and every conversion actually used to be reviewed and applicable to the same food. `ESTIMATE` permits valid arithmetic from a user declaration or a defensible legacy contract claim. `UNKNOWN` has no newly calculated KБЖУ. A missing conversion, ambiguous Food Core basis, invalid number, or missing basis is `UNKNOWN`.
- Quantity is always retained in its original unit. `l` to `ml` is an exact change of scale. `ml` to `g` requires food-specific density with provenance. Spoons, pieces and portions require food-specific measures. No default density or household mass is allowed.

`src/utils/nutritionIntegrityV1.ts` is a deterministic reference calculator and discriminated result type. Its `REVIEWED_REVISION` input is **not** a client attestation: only a future server resolver may construct that input after validating the current evidence chain. SQL `numeric` must be the authoritative arithmetic on writes. The pure calculator uses decimal strings, three fractional places, and half-up rounding to demonstrate outcomes; a server implementation must match or reject precision/overflow outside its chosen limits.

The result's `legacyGramWriterCompatible` is true only for per-100-g nutrition with actual normalized grams. It does not authorize a write by itself. An `ESTIMATE` remains an estimate after reload; `UNKNOWN` does not produce a new numeric diary row. A pre-V1 row has NULL integrity fields: return its saved historical values unchanged and display certainty `UNKNOWN`.

## Existing food compatibility

1. Resolve an active reviewed revision first. No such runtime lookup exists on this base; adding one is a separate approved integration.
2. An explicit user basis can be stored as `USER_DECLARED` after a backward-compatible schema/API change. On the current creation pages, selecting 100 ml or one portion must never fall through to the 100 g writer. Keep form state intact when explaining the temporary diary-save limit.
3. For core/brand legacy foods, use a curated mapping from stable food ID and source-version/retained source contract to `LEGACY_CONTRACT`, if the per-100-g claim is applicable and there is no conflicting evidence. For the tracked Food Core workbook, README's global 100 g statement is insufficient on its own to resolve the 254 `unit=ml/ml,g` rows. They remain UNKNOWN. `unit=g` is not itself evidence. Exact live catalog coverage is unverified.
4. An older user food without a recorded basis requires its owner to state the denominator before a new calculation. Do not silently promote its existing macros. Search, favorites and selection stay available; the decision occurs at portion entry.

This preserves ordinary legacy gram entry as visibly marked `ESTIMATE` where a source-level 100 g claim is defensible, without treating the entire catalog as reviewed. A strict reviewed-only mode would block every product lacking active reviewed evidence, not merely the 254 ambiguous workbook rows. The number of such products in Supabase is unknown.

## Write boundary and API

The server accepts `foodId` or a recipe revision, date/meal/idempotency context, and `{amount, unit}`. It resolves the food and basis, computes the result, and returns `{status, reason, totals|null, normalizedGrams|null, basis, provenance, conversionRef}`. It **ignores client-provided KБЖУ, status, weight and evidence IDs for authority**. `UNKNOWN` is a non-persisting result; the user may change units or provide a supported basis. Do not manufacture zero macros to satisfy a NOT NULL column.

Every nutrition-changing insert/update must pass the same gate: `addMealEntry`, `updateMealEntry`, copy, scan, search/favorites modal, basket, analyzed ingredients, `recipeDiaryService`, direct recipe rows and the legacy `saveMealsForDate` upsert. The last already avoids server-syncing canonical/recipe rows but still has a legacy write branch and local snapshot. Prevent offline local snapshots from claiming `CONFIRMED` before server confirmation. A batch must be all-or-nothing or report exactly which entries failed; do not show optimistic success before the gate confirms. Idempotent replay compares source amount/unit and resolved evidence revision, not only weight/name/date.

A TypeScript guard alone does not protect direct PostgREST writes. The eventual DB trigger must recompute and classify on insert and nutrition-changing update under existing ownership RLS. It must not accept a caller-supplied `CONFIRMED` flag. Reviewed bindings and reviewed conversions belong in a private, client-unwritable table populated only by an approved evidence bridge. User declarations remain estimates. A migration rollout must test grants/RLS for `anon`, `authenticated`, owner, other user and privileged maintenance paths; an old client with no V1 metadata must fail safely once the gate is active. Do not silently strip V1 columns on schema errors.

The existing admin `recompute_food_entries_for_food_ids` updates historical diary macros from today's food numbers and `weight`; it must be disabled or revised for V1 before any ingest flow invokes it. Historical entries are never bulk-updated to repair or reclassify them.

## Schema boundary

The SQL design adds nullable basis and integrity fields plus private reviewed/conversion bindings. Existing rows receive no backfill. On reload, `integrity_contract_v1 IS NULL` means **historical confidence UNKNOWN**, even though saved totals remain visible. New `ESTIMATE` and `CONFIRMED` are persisted and read as stored only after DB enforcement verifies their authority.

The current diary `weight` is NOT NULL and means grams. Therefore an additive migration cannot honestly save a per-100-ml or per-portion result **without known gram mass** into this table. The product's declared basis can be saved; diary entry creation must wait for a separately approved native-amount API/schema evolution (for example, nullable normalized mass and updated consumers). Writing `0 g` or putting ml in `weight` is prohibited.

Current `Progress` aggregates stored diary totals without a confidence field. Future Premium FACT and adaptive feedback must require `CONFIRMED`; `ESTIMATE` may be shown as an explicitly labelled diary estimate but is not confirmed FACT. PLAN remains separate from FACT. The current Premium PLAN/FACT history is a local simulation with saving disabled; this contract does not activate it.

## Safe deployment sequence (future approvals required)

1. Read-only live schema/grants/writer preflight. Reconcile `foods`, `food_diary_entries`, RLS, triggers, admin recompute and relevant Draft PR boundaries. Approve the exact SQL and the trusted reviewed-evidence authority path.
2. Apply nullable schema changes and private binding storage after separate approval. No historical backfill. Test old reads and private-table permissions.
3. Implement DB write gate and one server-resolved write API. Route every application writer through it; reject unsafe old-client writes rather than falling back. Test direct PostgREST attempts and idempotency.
4. Update product forms, portion UI and read models. Keep legacy gram estimates usable, explain unknown conversions, and preserve input on rejection. Enable client traffic only after server gate and rollback plan are verified.
5. Exclude estimates/unknowns from confirmed Premium FACT and adaptation. Review any proposed native-amount extension separately. Leave historical diary values untouched.

## Acceptance tests for the implementation phase

- Unit matrix: g, ml, l, tablespoon, teaspoon, piece, portion; direct matching basis, density/measure evidence, absent or conflicting evidence, cross-food evidence, precision and overflow.
- Trust matrix: active reviewed, reviewed+unreviewed conversion, user declaration, curated legacy claim, ambiguous Food Core ID, invalidated revision. Neither estimate nor unknown is upgraded by client fields or reread.
- Writer matrix: modal, search, favorites, basket, scan, edit, copy, recipe/photo, local fallback, `saveMealsForDate`, direct PostgREST insert/update, old client and admin recompute. Assert one gate and no partial/optimistic success.
- Persistence: reload `CONFIRMED` and `ESTIMATE` distinctly; pre-V1 rows read as `UNKNOWN` with unchanged stored totals; `UNKNOWN` creates no numeric row. PLAN never becomes FACT implicitly.

## Owner decisions before application

- Approve the curated source-level legacy 100 g mapping and treatment of existing private foods with no basis.
- Approve whether private user-declared conversions are allowed as estimates, and how the serving definition is captured.
- Approve the future native-amount schema/API for per-100-ml and per-portion diary entries without known mass.
- Approve direct-write gate rollout for older clients, admin recompute behavior, and the exact Premium/Progress display and eligibility treatment of estimates.

Supabase security design references: [RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [function privileges and invoker/definer](https://supabase.com/docs/guides/database/functions). These are design inputs, not evidence of the live POTOK schema.
