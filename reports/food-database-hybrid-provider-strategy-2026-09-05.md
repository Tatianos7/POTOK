# Food Database Hybrid Provider Strategy

- Date: 2026-09-05
- Branch: `master`
- HEAD: `f782fc1 missing food from calorizer flow plan`
- Source missing-food plan: `reports/missing-food-from-calorizer-flow-plan-2026-09-05.md`
- Source hybrid review: `reports/today-premium-owner-ideas-hybrid-architecture-review-2026-09-02.md`
- Source readiness map: `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- Target package: `FOOD_DATABASE_HYBRID_PROVIDER_STRATEGY`
- Verdict: **FOOD_DATABASE_HYBRID_PROVIDER_STRATEGY_READY**

## Scope

Prepare a strategy report for POTOK's hybrid food database: POTOK-owned catalog, external provider sources, user-created foods, and caching/import flow.

This is report-only strategy work. No runtime code was changed, no UI was changed, no config/dependency files were changed, no API clients were added, no external provider was connected, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no real table reads or network calls were made, no secrets/API keys/JWTs were collected, no service-role keys were used, no RLS policies were changed, no Premium writes were touched, no diary runtime writes were executed, and no PR was created.

No web research was performed in this report. Provider/legal items are marked `VERIFY_REQUIRED`.

## Sources Reviewed

- `reports/missing-food-from-calorizer-flow-plan-2026-09-05.md`
- `reports/today-premium-owner-ideas-hybrid-architecture-review-2026-09-02.md`
- `reports/today-premium-product-readiness-map-with-owner-ideas-2026-09-02.md`
- current Food Core / `foods` / canonical / diary snapshot architecture references in source reports and services
- `src/services/foodService.ts`
- `src/services/diaryCreateService.ts`
- `src/services/mealService.ts`
- `src/utils/foodNormalizer.ts`
- `src/types/index.ts`

## 1. Product Goal

Product goal:

- POTOK should gradually build its own high-quality food database.
- External provider databases should be used as search, enrichment, and replenishment sources.
- Runtime should not permanently depend on live paid APIs for common food lookup.
- User-created foods should live alongside the catalog as private user data, but must not pollute the shared catalog.
- Premium Today / `Мой Поток` should use owner-approved, verified content rather than raw external provider responses.

Owner question:

- Can products found in third-party databases but missing from POTOK be automatically or semi-automatically stored in POTOK so future runtime depends less on paid provider APIs?

Strategy answer:

- Yes, but not by direct auto-save into the verified public catalog.
- The safe hybrid path is: provider result -> normalized cache/import candidate -> validation/dedupe -> review -> promotion to POTOK verified catalog.
- For immediate user value, a user-selected external result can become a private user food or a provider-backed candidate, depending on licensing and product decision.

## 2. Recommended Search Flow

Recommended future search order:

1. Search POTOK verified catalog first.
2. Search current user's private foods.
3. If no good match appears, offer external provider search later.
4. Show external/provider results clearly as external results.
5. If the user selects an external result, create a normalized candidate rather than trusting raw provider payload.
6. Validate KBJU and required fields.
7. Dedupe against POTOK verified catalog and the user's private foods.
8. Save according to the allowed storage model:
   - temporary cache if license allows only limited storage;
   - import candidate if review is needed;
   - private user food if user explicitly chooses to save for themselves;
   - verified catalog only after review/promotion.
9. Allow diary add only through the existing canonical/snapshot-safe path.

Runtime rule:

- Live provider lookup can be a fallback, but the main happy path should become POTOK-owned search over reviewed internal data.

User-facing rule:

- The user should understand whether a result is from POTOK, their own products, or an external source.

## 3. Storage Layers

### A. POTOK Verified Catalog

Purpose:

- The trusted internal catalog for search, diary adds, recipes, and Premium content.

Source values:

- Owner-reviewed imports, manually curated Food Core rows, approved brand/core foods, promoted provider candidates.

Visibility:

- Shared to users according to product/search rules.

Lifetime / TTL:

- Long-lived.
- Updated through reviewed corrections, not temporary provider refreshes.

Who can use it:

- All users for regular search and diary add.
- Premium content authors for reviewed plans/recipes.

Can appear in Premium:

- Yes, if owner-approved and content-ready.

Can be used in diary:

- Yes, through canonical food and diary snapshot creation.

Review requirements:

- Required before insertion/promotion.
- Requires dedupe, normalized identity, KBJU sanity, canonical root, and source attribution decision.

### B. Provider Import Candidates / Review Queue

Purpose:

- Store normalized candidates from external providers for later review and possible catalog promotion.

Source values:

- Provider result mapped into POTOK fields, with provenance metadata and payload hash.

Visibility:

- Internal/admin/review visibility by default.
- Not shown as trusted catalog rows until reviewed.

Lifetime / TTL:

- Medium-lived review queue.
- Retention depends on provider license and privacy/legal rules.

Who can use it:

- Admin/reviewer tools.
- Potentially search fallback UI as clearly external/needs-review result, only if license allows.

Can appear in Premium:

- No, not until promoted and owner-approved.

Can be used in diary:

- Not directly as a verified catalog row.
- If user selects it, create a permitted private user food or provider-backed add candidate first, then use canonical/snapshot-safe diary path.

Review requirements:

- Required for global catalog promotion.
- Fuzzy matches should become suggestions, not automatic merges.

### C. Provider Cache

Purpose:

- Reduce repeated live provider calls and improve responsiveness.

Source values:

- Provider response or normalized subset of provider response, only as license permits.

Visibility:

- Runtime/internal cache.
- User-facing display must clearly label external source if shown.

Lifetime / TTL:

- Short to medium TTL.
- TTL must follow provider terms.

Who can use it:

- Search fallback and enrichment logic.

Can appear in Premium:

- No. Raw/temporary cache must not feed Premium plans directly.

Can be used in diary:

- Only through an allowed transformation into private user food or reviewed catalog entry.

Review requirements:

- Not necessarily reviewed for cache existence, but required before public catalog promotion.

### D. User-Created Private Foods

Purpose:

- Let users track foods missing from the catalog immediately.

Source values:

- Explicit user-entered fields or an explicitly accepted provider result, if license permits user-private storage.

Visibility:

- Private to the creating user.

Lifetime / TTL:

- Long-lived user data until user edits/deletes it, subject to app privacy/data-retention rules.

Who can use it:

- The creating user only.

Can appear in Premium:

- Not in shared Premium plans.
- Later, user foods may be considered for personal replacements only after Premium writes/RLS are ready.

Can be used in diary:

- Yes, for the owning user through owned `source='user'` visibility and diary snapshot creation.

Review requirements:

- No global review required for private use.
- Review required before any shared catalog promotion.

## 4. External Product Save Strategy

### Option A: Never Auto-Save External Products To Verified Catalog

Shape:

- External results are cached temporarily if allowed.
- When selected, the user can create a private user food.
- Verified catalog only changes through separate reviewed import.

Pros:

- Strongest legal and data-quality boundary.
- Keeps public catalog clean.
- Fits current user-food ownership model.
- Avoids accidental Premium contamination.

Cons:

- POTOK catalog grows more slowly.
- Duplicate private foods may accumulate.
- Provider search may still be needed for uncommon products.

Risks:

- Less automatic database growth.
- More manual/admin work later.

Recommendation:

- Good fallback rule when licensing/storage terms are unclear.

### Option B: Auto-Save As Provider Cache / Import Candidate With `needs_review=true`

Shape:

- External provider results can be saved into a cache/import-candidate layer.
- They are not visible as verified catalog rows.
- Admin review can promote a candidate later.

Pros:

- Builds an internal pipeline without polluting the verified catalog.
- Reduces repeat provider calls if license allows.
- Creates a review backlog for catalog growth.
- Supports semi-automatic enrichment.

Cons:

- Requires future data model and review tooling.
- Needs provider-specific licensing rules.
- Requires dedupe and moderation workflow.

Risks:

- Storage may violate provider terms if not verified.
- Review queue can grow faster than moderation capacity.

Recommendation:

- Recommended strategic direction after legal/provider verification.

### Option C: Auto-Save Directly To Verified Catalog

Shape:

- External provider result becomes a shared verified POTOK catalog row automatically.

Pros:

- Fastest catalog growth.
- Reduces live provider dependency quickly.
- Users benefit immediately from newly found foods.

Cons:

- High legal risk.
- High data-quality risk.
- High duplicate/canonical identity risk.
- Can contaminate Premium and diary source of truth.

Risks:

- Provider license/cache violations.
- Bad KBJU in public catalog.
- Duplicate rows and broken canonical identity.
- Incorrect shared data used by many users.

Recommendation:

- Not recommended before licensing, quality checks, dedupe, review workflow, and production approval.

## 5. Recommended MVP

Recommended MVP:

- Do not auto-save external products directly to the verified public catalog.
- External result can create an import candidate/cache record only if licensing allows.
- User-selected external food can become a private user food or provider-backed candidate.
- Global catalog promotion requires moderation/review.
- If licensing is unclear, do not store raw provider data long-term.
- If provider storage is not allowed, store only a minimal user-entered private food created through explicit user action.
- Keep diary adds on the existing canonical/snapshot-safe path.
- Keep Premium catalog separate and owner-approved.

Practical MVP sequence:

- Ship manual missing-food private product flow first.
- Verify provider licensing/cache rights.
- Add provider cache/import candidate model only after verification.
- Add provider search fallback behind a feature flag.
- Promote to verified catalog only through review.

## 6. Data Model Implications

No SQL is created in this report. The following are future strategy fields/tables only.

Possible future fields:

- `external_provider`
- `external_id`
- `external_source_url`
- `provider_payload_hash`
- `storable_allowed`
- `cache_expires_at`
- `needs_review`
- `review_status`
- `imported_from_provider`
- `promoted_to_canonical_food_id`
- `duplicate_of_food_id`
- `created_by_user_id`
- `source`

Possible source values:

- `user`
- `provider`
- `core`
- `brand`

Possible future tables/layers:

- provider cache table for short-lived provider lookup results;
- provider import candidate/review queue;
- verified `foods` catalog rows after promotion;
- private user foods in existing user-owned food path.

Important constraints:

- Do not create SQL now.
- Do not change schema now.
- Do not assume provider raw payloads are storable.
- Do not mix provider cache with verified catalog semantics.

## 7. Dedupe / Canonical Rules

Dedupe inputs:

- `normalized_name`
- `normalized_brand`
- `barcode`
- `aliases`
- `stable_food_id`
- `canonical_food_id`
- provider-specific `external_provider` + `external_id`

Rules:

- Exact normalized name + brand match can become a strong duplicate candidate.
- Barcode match can become a stronger duplicate candidate when available and trustworthy.
- Alias match can suggest an existing canonical food.
- Stable food id should remain deterministic and reviewed.
- Canonical food id must point to the chosen canonical root.
- Fuzzy match can produce review suggestions only.
- Fuzzy match must not auto-merge external provider data into a verified catalog row.
- User-created foods remain scoped to `created_by_user_id`.
- Provider candidates are not canonical roots until promoted.
- Historical diary entries keep snapshots and are not recomputed after catalog corrections or promotions.

Diary rule:

- Diary entries continue to store snapshots from canonical food values and `weight_g`.
- Client/provider preview values must not be trusted as stored diary source of truth.

## 8. Licensing And Provider Rules

VERIFY_REQUIRED before integration:

- FatSecret Terms of Service.
- Open Food Facts license and attribution rules.
- Edarix terms if used for recipes/products.
- Commercial usage rights.
- Cache/storable data rules.
- Raw payload storage rights.
- Attribution requirements.
- Deletion/refresh requirements.
- Rate limits and pricing.
- Whether normalized derivative data can be stored.
- Whether provider result can become user-private food.
- Whether provider result can become POTOK reviewed catalog food.

No web research was performed for this report.

No provider was connected, no provider API was called, and no API keys were read.

## 9. Relation To Missing-Food Flow

Missing-food private product MVP remains useful:

- If POTOK catalog has no match and no provider integration exists, user can add a private food manually.
- If external provider search finds nothing, user can still add a private food manually.
- If provider search finds a result, user can use a clearly labeled provider-backed result only under allowed licensing/storage rules.
- Empty state can eventually offer:
  - `Искать во внешней базе`;
  - `Добавить вручную`.

Implementation order:

- Manual private missing-food fallback can ship before provider integration.
- Provider integration should wait for licensing/cache strategy.
- Provider-backed import/candidate storage should wait for a data model draft and review workflow.

## 10. Relation To Premium

Premium rules:

- Premium Today should use only verified, owner-approved catalog content.
- Raw external provider products should not directly enter Premium plans.
- Provider ingestion can help populate the Premium-ready catalog after review.
- User-created foods should not alter shared Premium plans.
- User-created foods may later be used for personal Premium replacements only after RLS/write paths are ready.
- Provider cache should not be used as a hidden Premium runtime dependency.

Premium blocker alignment:

- Premium writes remain blocked until behavioral RLS tests and payment/entitlement readiness.
- Provider ingestion does not unblock Premium writes.
- Provider review/promotion is content readiness work, not entitlement or RLS readiness.

## 11. Risks

Legal/licensing:

- Provider terms may forbid long-term storage, redistribution, or commercial reuse.
- Attribution or deletion requirements may affect UI and data model.

Data quality:

- External KBJU can be incomplete, inconsistent, or wrong.
- User-entered data can be inaccurate.

Duplicate/canonical identity:

- Same food may arrive from several providers, user entries, and POTOK catalog rows.
- Bad auto-merge can damage search and diary consistency.

Cost/API limits:

- Live provider search can become expensive or rate-limited.
- Cache can reduce calls only if provider terms allow it.

Privacy/user-created data:

- Private foods must not leak into public search or another user's diary.
- User-created provider-backed foods must remain scoped.

Moderation workload:

- Import candidates can accumulate faster than review capacity.
- Review tooling and owner/admin workflows need their own plan.

UX confusion:

- Users may not understand whether a food is verified, external, or private.
- Copy and badges need to be clear without exposing technical implementation terms.

Technical complexity:

- Multiple provider schemas, dedupe rules, TTLs, payload hashes, and promotion states increase system complexity.

## 12. Recommended Implementation Roadmap

Phase 1: strategy/report.

- Finalize this hybrid provider strategy.

Phase 2: provider/legal verification.

- Verify FatSecret, Open Food Facts, Edarix, and any other candidate provider terms.
- Document cache, storage, attribution, commercial use, and deletion rules.

Phase 3: data model draft for cache/import candidates.

- Draft provider cache/import candidate schema.
- Include dedupe, review, TTL, and provenance fields.
- Do not apply SQL until approved.

Phase 4: provider search adapter behind feature flag.

- Design adapter boundary.
- Keep it disabled by default.
- Do not make provider search a required runtime dependency.

Phase 5: import candidate/review flow.

- Store only allowed data.
- Build review workflow before global promotion.

Phase 6: user-facing external search fallback.

- Offer external search only after provider strategy and licensing are ready.
- Label external results clearly.

Phase 7: manual missing-food fallback.

- Keep `Добавить вручную` as a robust fallback.
- Save private user foods only.

Phase 8: catalog promotion workflow.

- Promote reviewed candidates to POTOK verified catalog.
- Preserve snapshots and canonical identity.

## 13. Decision Points For Owner

Owner decisions needed:

- Which external providers should be investigated first?
- Should POTOK evaluate FatSecret first, Open Food Facts first, or both in parallel?
- Is private user food fallback allowed before provider integration?
- Is admin/owner review required before any global catalog promotion?
- Should provider source be shown to users in search results?
- Should provider-backed selected food become a private user food by default, or only an import candidate?
- How much moderation workload is acceptable for the first catalog-growth phase?
- What is the minimum attribution UX acceptable if a provider requires attribution?

## 14. Final Recommendation

Recommended direction:

- Proceed with the hybrid model.
- Do not auto-save provider products directly into the shared verified catalog.
- Use provider cache/import candidates with `needs_review` after licensing verification.
- Use private user-created foods as the immediate fallback for missing products.
- Keep global catalog promotion behind moderation/review.
- Verify licensing/cache/storable rules before any provider connection.
- Draft the data model after legal/provider verification.
- Keep Premium Today on verified owner-approved catalog only.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no external provider connection;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table reads;
- no network calls;
- no secrets/API keys/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no Premium writes;
- no diary runtime writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**FOOD_DATABASE_HYBRID_PROVIDER_STRATEGY_READY**
