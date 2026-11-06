# Exact week Graph V3 preparation (inactive)

## Contract and scope

`adaptive_nutrition_graph_v3` is a separately versioned exact rational PLAN graph, not a replacement for Graph V1/V2 and not a legacy GeneratedWeekPlanV1. It retains all seven days, ordered slots, typed Food/Nonfood quantities, nullable input mass, exact component/meal/day/week nutrition and complete publication/portion bindings. It includes the immutable admitted input/selection/proposed revision, source/proposal hashes and content-validation receipts. Slot subjects, warning-bearing slots, days and the graph have separate canonical SHA256 domains. Unknown cooked yield/mass is not filled in, and facts is always empty.

One server store read supplies the request/proposal-bound V3 envelope. Its contentSourceRaw is independently checked by the existing V4 adapter, which reruns exact source authorization, nutrition, publication, portions, safety/preferences, composition and repeats. Warning and ordinary-witness packets are separate server dependencies. No trusted store implementation or actual source issuance is provided here. Hashes bind bytes and never establish provenance; real source/policy/classification/warning authority still requires an independent loader/issuer and final currentness checks.

A successful graph remains authority NONE, accepted=false, canRecord=false, canActivate=false and EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION. Exact optimization/generator-decision proof, Auth/Premium, transactional currentness, storage and persistent readback remain required. No writable plan, Graph V1/V2 acceptance, migration, DB call, production update or runtime activation is introduced.

## Ordinary fallback

The source must provide an actual exact ordinary-week witness, bound to the selected proposal SHA, same admitted input digest and manifest. That full week is recomputed and checked through the same V4 validator. Every recipe must be both non-specialty and non-expensive. Preference/safety/composition, current Goal, balance and ordered distribution authority must match the selected attempt. A shared immutable recipe/revision must have identical identity, exact subject, portion and classification definitions across the selected and ordinary weeks; it cannot be relabelled ordinary.

The witness proves feasibility only. Missing/invalid evidence blocks graph preparation. It never means NO_VALID_PLAN, does not prove search exhaustion and does not claim an optimal or exhaustive candidate pool. The existing legacy unavailable-proof representation is not relabelled as exact evidence.

## Warnings

Every slot needs an independently assessed exact subject digest, warning evidence revision and five explicit boolean signals, in actual slot order. Header pins include admitted input, validation revision and content-validation digest. No absent signal defaults to false. The existing scalar-independent warning rules are extracted and reused without changing V1 output. The pinned policy allowlist controls emission. Specialty and expensive warnings can both apply, and publication and warning-assessment provenance remain distinct. Legacy three-place warning evidence is rejected rather than rounded into this contract.

## Readback and replacement

Readback reloads the trusted source and recomputes the entire graph, including source authorization, ordinary witness and warnings; it compares complete canonical contents rather than trusting a supplied digest or cached receipt. Any changed totals, identities, portions, warnings, facts or write flags reject. Unchanged semantic data with different source bytes is conservatively a different receipt.

Replacement requires the expected old graph digest and exact slot/component target. It revalidates the old graph, validates and recomputes the complete new week, and checks that admitted input and all non-target placements, meal modes, publication bindings AND their exact source references are unchanged. Stale pins, no-op requests, multiple changed placements or a hidden source swap reject. The new graph is returned only after all full-week checks; the old graph is immutable. In particular, a locally valid meal can be rejected for exceeding the weekly family cap. This is a conditional preparation operation, not a database CAS, active-plan edit or transaction. It currently requires the old conditional graph's source evidence to remain valid.

## Validation

Synthetic fixtures exercise exact values and digest domains, Graph V1/V2 separation, warnings and slot coverage, ordinary witness feasibility/currentness/classification conflicts, readback revocation, and replacement scope/portion/weekly-repeat failures. These fixtures are not approvals for the real catalog. Legacy validators and warning tests run separately. The authoring CI adds strict TypeScript and this graph test file. The original and appended pilot freezes are unchanged because none of their seven pinned server files changes in this stage.

PR348 at b5e943421c3e7cd7a588c63b60ed89aaab3877ff passed POTOK PR Checks and PostgreSQL admission. Its separate Edge full-worker compatibility workflow still failed; no TLS, channel-binding, source-authority or test gate is relaxed here.

Local validation: 798 legacy/source/content regression tests and 18 exact graph tests passed (816 distinct scenarios). Targeted strict TypeScript and ESLint passed; production build passed with existing browser-data/chunk advisories. CI adds the graph strict-TypeScript/test commands. Hosted results remain separate from these local checks.
