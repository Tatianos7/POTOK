# POTOK — generation integration checkpoint, 30 October 2026

Status: SOURCE AUDIT COMPLETE / IMPLEMENTATION AND LIVE READINESS NOT PROVEN.
Base: `security/client-release-candidate-20261029` at `1976b330111a802942af7e29161050e316990f99`.
Scope: generation after the owner-reported completed security deployment and application smoke.
This document does not reopen that completed security stage. No live Supabase calls, SQL, generation, flags, merge or deployment were performed.

## Product contract

Premium = Today = «Мой Поток». First release uses deterministic generation without AI.
Generate a personalized seven-day PLAN from reviewed data; PLAN never creates FACT.
Keep the main execution UX simple: «Поел», «Заменить», «Пропустить».
Adaptation is a proposal requiring confirmation, never silent restriction or forced calorie compensation.
Generation delivery is P5-04. Consumption, substitutions and shopping execution are later P5-05; real purchase verification remains separate (#198).
The owner-approved 7-day rolling product intent must be reconciled explicitly with existing local-Monday/week_anchor contracts before implementation. Do not silently switch dates or rewrite Graph v1.

## Verified source baseline and existing work

| Source | Exact source / status | Reuse and limit |
| --- | --- | --- |
| Published-client source | 1976b330111a802942af7e29161050e316990f99 | Work from this branch; master alone misses the security client chain. The deployment and smoke completion are owner-reported; this audit does not independently re-verify the hosted deployment. |
| P5-01 and P5-02 transfers | #179 and #180 merged; original #161/#162 remain separate | Do not reimplement pending-state decoding or UNKNOWN classification merely because original PRs are Draft. Recheck wire/schema installation separately when integrating. |
| P5-03 and P5-03B source transfer | #181 merged; source branch 346e90d5bab87c17ca5219bf4e7ef0889d55dd91 | Retained apple/oat/water source candidates are not issued runtime evidence. |
| P5-03C transfer | #182 ff666f79af1583040bdc5adb9385ccbf55530de2, Draft | Inactive Food/Nonfood issuer packages; absent from published base's src/server. No automatic cherry-pick or deployment. |
| Real issuer/closure candidate | #183 507ec2498bb855e720c7d74ee98c341b858b92bd, Draft | Test-first checkpoint explicitly says NOT IMPLEMENTED; prototype concurrency does not prove real issuer integration. |
| Earlier P5-04 audit | #178 dd016c11db3daf3fa2248f1d460c11709f9294ea, Draft | Reuse its dependency analysis; its pre-transfer P5-01/P5-02 statuses are historical. |
| Demo Home navigation | #243 f7a5a0b38d54a95810dedd0c2e645e85fe279941, Draft against release branch | Separate UI change; not generation readiness or an instruction to merge. |

GitHub PR metadata, changed-file inventories and exact pinned source files were read.
No CI was rerun; no existing PR's green status is promoted into acceptance of this new checkpoint.

## Concrete implementation gaps

### G1 — orchestration is deliberately unbound

`supabase/functions/adaptive-nutrition-generate-v2/index.ts` has generator=null and validator=null.
It creates only the user-scoped request/status handler. The pure `continueGenerationV2` function in contracts.ts is not a running worker.
The legacy `programGenerationService` is quarantined; do not restore table-by-table generation or route around the protected Graph channel.

### G2 — validator transport cannot supply the existing trusted API

Current `LoadedGenerationRequestV2` carries input and manifest canonical hex plus an attempt identity.
Current `TrustedGenerationValidatorV2.validate` receives only input hex, manifest hex and proposed plan hex.
The existing independent validator instead requires four primitive JSON strings:
`validateGeneratedWeekPlanTrustedV1(generatedPlanRaw, pinnedPoliciesRaw, trustedContextRaw, pinnedWarningEvidenceRaw)`.

Its trustedContext includes input, manifest, preference, safety and validation evidence.
Policies and plan-bound warning evidence also require independent provenance.
Therefore a thin call adapter is insufficient: the trusted runtime must independently load/pin these sources for the durable request and the exact proposed plan.
Do not take policy/context/warning authority from generator output or manufacture false warning booleans.
Preserve raw duplicate-key rejection, canonical domains and immutable revision bindings.
Missing/malformed/stale authority must prevent record and activation.

Implementation boundary to review:
- a server-owned request-bound authority loader, with exact raw/canonical representation and explicit revision/digest checks;
- a validator adapter over the existing pure validator, with no new calculation engine;
- an explicit accepted result bound to the same proposal bytes/request; blocked/rejected outcomes never reach record;
- fresh entitlement/currentness/CAS checks at the DB write boundaries.
This is a design requirement, not a deployed new RPC or a claim of DB enforcement.

### G3 — real content is not yet established by this source audit

The retained oatmeal decision explicitly leaves water approval and real cooking/yield/servings unresolved.
Source candidates, workbook membership and READY_FOR_REVIEW are not PUBLISHED/plan-eligible.
Do not mint canonical UUIDs, publication receipts, evidence revisions, portions or measured cooking yield in an adapter.
The recipe publication evidence bridge binds reviewed sources; it does not issue/review them.

Live account-linked evidence issuance has its own blockers in #182/#183: real transaction-time closure fencing and retention decisions.
Full account deletion implementation is a separate program; it does not block writing inactive generation code.
It does block claiming the unfinished issuer is safe for live evidence publication.
Verify any newer real content receipts before repeating work: current live issuance was not queried here.

### G4 — one pilot recipe is not a weekly catalog

Existing Balance policy fixes exactRecipePerWeek=2, exactRecipePerDay=1,
repeatFamilyPerWeek=3, dominantIngredientFamilyPerWeek=4,
specialtyMealsPerWeek=1 and expensiveMealsPerWeek=2.
One real recipe can prove a content slice, not a valid varied seven-day meal plan.
For R required recipe occurrences, ceil(R/2) distinct recipes is only a necessary lower bound under the current exact-repeat cap, not sufficient:
meal types, companion roles, family limits, nutrition, allergies and per-day rules may require more.
R must come from the admitted slot/composition policy, not an invented fixed meal count.
Never weaken limits or duplicate a recipe under new IDs to make a pilot pass.
A content feasibility assessment must identify uncovered slots and constraints and return insufficient coverage honestly.

### G5 — hosted state still requires generation-specific evidence

Security completion does not prove deployed generation gateways, policy heads,
Goal-target snapshots, real manifests or reviewed runtime sources.
Historical staging rollback acceptance and pure TypeScript validators are separate evidence.
When external verification is needed, start with an exact read-only inventory; propose only the necessary additive changes.
No direct Graph-writer grants to clients, broad permission repair, service secret in browser or direct postgres credential in Edge.

## Ordered implementation packages and exit evidence

| Package | Concrete work | Required evidence |
| --- | --- | --- |
| A — trusted validation integration | Define exact request-bound authority loading/representation; implement an inactive adapter to the existing validator | Real strict validator fixtures: valid proposal, missing/substituted policy/context, stale revisions, account mismatch, duplicate JSON, plan-bound warnings, rejected proposal -> zero writes. Fixtures prove code behavior, not content publication. |
| B — content feasibility | Audit supplied reviewed recipe exports against existing publication/eligibility/portion contracts and admitted required slots | Traceable missing-evidence/coverage report; measured yield/servings for real recipes; no unreviewed substitutions or invented IDs. A single recipe remains a slice only. |
| C — deterministic proposal provider | Implement bounded deterministic selection/portion search using pinned inputs and existing composition/nutrition calculations | Identical input/policies produce identical output; all hard constraints hold; infeasible vs budget-exhausted results are distinguished; no unsafe fallback or fabricated plan. |
| D — protected delivery/recovery | Bind authority loader, provider and validator to request -> record -> activate -> exact read | Actual disposable DB/API tests, same-key replay, concurrent workers, stale authority/entitlement, crash after record/activation, unknown commit; exactly one effect and no FACT writes. |
| E — staging and owner smoke | Prepare exact SQL/deployment/flags and candidate manifest; request approval only for the concrete external actions | Separately authorized staging run, real user request/status/read-back, foreign-account denial, normal failure UX and preserved history/Graph v1. |
| F — controlled product rollout | Review exact client/server/schema/content versions and recovery path, then approved deployment | Production-specific admission, receipts/exact read and owner application smoke; do not infer success from CI. |

A and inactive portions of C/D can proceed while B's real source/cooking prerequisites are being resolved.
Do not finish by repeatedly auditing the same sources: next implementation deliverable is A with actual validator behavior tests in an isolated Draft branch.
Do not deploy A alone as a functioning generator.
Changes to numerical policies, rolling-week semantics, measured servings, retention decisions and live activation must remain explicit review items.

## Acceptance matrix to retain through implementation

- Request actor is verified server-side; account and entitlement continuity rechecked after awaits and before commit.
- Client supplies only protocol/key; generator cannot choose authoritative account, manifest, policy or evidence.
- Missing source data, allergies/constraints conflict or insufficient catalog never generates reassuring fabricated values.
- Different data with the same row count or internally consistent substituted digests are not trusted.
- Same key resumes original request; changed payload conflicts; UNKNOWN does not allocate new keys.
- Record and activation remain durable separate phases; no ready UI before authoritative receipt and exact result read.
- Goal/preference/safety/content/entitlement changes stop stale activation rather than silently rebasing.
- Graph v1 and historical PLAN/FACT snapshots remain compatible and unchanged.
- Synthetic tests and read-only demo cannot be reported as a real published weekly plan.

## Source anchors

All baseline paths below are pinned to 1976b330111a802942af7e29161050e316990f99:
- AGENTS.md
- supabase/functions/adaptive-nutrition-generate-v2/index.ts
- supabase/functions/adaptive-nutrition-generate-v2/contracts.ts
- src/utils/trustedGeneratedWeekValidatorV1.ts
- src/utils/adaptiveNutritionAuthoritiesV1.ts
- src/utils/adaptiveNutritionMealBalanceV1.ts
- docs/premium/trusted-validation-policies-v1.md
- docs/premium/trusted-generated-week-validator-v1.md
- docs/premium/reviewed-runtime-recipe-publication-evidence-v1.md
- docs/premium/p5-03b-oatmeal-apple-owner-decision.md

Additional exact branch sources:
- #178: docs/premium/p5-04-generation-hands-on-readiness-audit-2026-10-20.md
- #182: docs/architecture/p5-03c-p5-04-scope-split-2026-10-20.md
- #183: docs/architecture/p5-03c-real-issuer-closure-integration-gate-2026-10-20.md

Validation: manual source/PR cross-check only. This is a documentation-only delta; no runtime tests or live readiness result are claimed.
