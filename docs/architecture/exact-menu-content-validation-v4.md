# Exact menu content validation V4 (unmounted)

This server-only adapter continues exact numeric V3 validation with independently loaded publication/classification/portion metadata. It is not a publication issuer or a writable Graph. The client supplies only the operation ID and exact snapshot text. One source read binds operation and actual proposal SHA; numeric preparation rechecks all Food/Nonfood evidence and current Goal/policy input. There is no database implementation or runtime route.

## Independent source package

The V4 source envelope contains the existing numeric authority packet, preference/safety snapshots, composition policy snapshot, ordered publication bindings and ordered meal source modes. All metadata must come from a trusted server store with independently established origin/currentness. Merely constructing valid JSON or hashes cannot establish that authority. This stage supplies no real issuer, store loader, real publication approvals or source classifications.

Each separately versioned publication binding references the admitted manifest revision/digest and exact recipe request/snapshot digests. Existing reviewed component metadata and composition eligibility representations are reused; an old three-decimal publication cannot be relabelled as approval of exact nutrition. Current publication revision, review states, canonical/nutrition/allergen/dietary/portion revisions, ingredient identity, units and exact base amounts must agree. Food identity uses canonical UUIDs; water/salt use the approved Nonfood definition identity. Duplicate/missing placements, identity substitutions and inconsistent classification of the same recipe/revision fail closed.

## Rules

- Reuse existing hard preference, allergen, intolerance and dietary exclusions, scoped to the admitted account and exact preference/safety revisions.
- Reuse meal-type, accessibility, composition pattern, pairing and anchor rules, protein/produce requirements and existing repeat/cost limits. Specialty and expensive are independent booleans counted once per meal.
- Compare reviewed serving ranges and increments with rational arithmetic. Check discrete ingredient increments without decimal projection or rounding. Missing declared servings remains blocked; no serving count, gram conversion or cooked yield is invented.
- Counts use canonical recipe revision for exact recipe/day/week limits and existing family identities for variety. No new medical, nutrition or portion limits are introduced.

The receipt always has authority NONE, accepted=false, canRecord=false and canActivate=false. A pass means CONTENT_RULES_PASSED_PENDING_GRAPH. Exact Graph admission, ordinary fallback/warning/optimization behavior, Auth/Premium, source issuance/currentness and final transactional storage/readback remain required. No PLAN-to-FACT or diary write occurs.

## Source freeze maintenance

PR347 changed a source file pinned by the original offline pilot freeze, causing the PR checks integrity assertion to fail. The original pilot-input-freeze-v1.json is retained byte for byte. The appended pilot-input-freeze-content-v4-20261106.json retains every candidate byte hash, complete input-model hash, all 19 recipe/model hashes, 88 rows and all false promotion flags; only server source hashes are refreshed for the reviewed helper changes. A regression pins the original file SHA and compares all non-source fields. The default offline inventory uses the new source-bound revision. Neither freeze authorizes any real source or recipe.

## Verification scope

Synthetic fixtures cover positive conditional checks, each content rejection class, exact fraction/step boundaries, missing portions, publication/source substitution, stale or foreign account context, revoked source authority and write-denial receipts. Existing validators and the authoring reference CI block (strict TypeScript plus contract tests) are exercised separately. Synthetic reviewed metadata proves control flow only; it is not evidence that the real 19 recipes are published or classified. The separate Edge compatibility blocker remains unresolved; no TLS, authority or test gate is relaxed.

Local validation: 742 regression tests passed, including 20 content V4 cases and unchanged V1 restriction/composition validators; targeted strict TypeScript, ESLint and production build passed. The authoring reference CI command block is also run locally. Build emits the existing large-chunk advisory. Hosted workflow results must be checked on the published commit; local checks do not establish Edge compatibility.
