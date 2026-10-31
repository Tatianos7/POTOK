# POTOK current state

## Validated proposal to existing record/recovery worker — 2026-10-31

- Added inactive backend provider/validator bindings from the actual catalog/day/week/projection pipeline to the existing V2 worker. Pin loaded request/input/manifest canonical bytes before awaits; compare preparation and independent-authority snapshots to that loaded request. Reject malformed UTF8/hex, duplicate keys and noncanonical JSON before source access.
- Serialize the proposal canonically before independent validation; preserve those exact accepted bytes through final validation and the existing record/activation worker. Final validation reloads independent authority rather than trusting cached generator acceptance. Revoked authority or changed snapshots prevent recording.
- Fixed meal-component ingredient comparison to tolerate canonical object-key ordering while preserving array order, exact quantities and rejection of extra properties. This is required to decode the same validated plan after canonical storage serialization.
- Added synthetic integration tests through the real proposal/validator/worker, including null measured yields/grams, same-request recovery after lost record/activation replies, terminal-state reuse and record-time conflict. Persistence RPCs are simulated: this is not live database or deployment evidence.
- Actual source/decision-trace/authority storage adapters and privileged gateway runtime mounting remain outstanding. Exact Graph V2 readback and client opening remain separate work; ACTIVE status alone must not stand in for confirmed menu readback. No live DB mutation, deployment, activation or FACT write; cooking remains deferred.

## Selected week to independently validated proposal — 2026-10-31

- Added an inactive mechanical projection from the existing V2 weekly selection to Graph V2 and GeneratedWeekPlan V1. Uses actual child meal/day/week validator receipts, unchanged selected meal snapshots and independently decoded component evidence; reuses existing graph seal/bind functions. No invented IDs, portions, yields or new nutrition engine.
- Connected actual catalog/day/week preparation, proposal projection and the existing request-bound independent validation adapter. Preparation failures, missing decision trace, missing authority and independent rejection expose no accepted proposal; there is no writer/activation port. A validated proposal is not a durable receipt or ACTIVE state.
- Existing producer decision metadata must be separately supplied and bound to the exact request/week bytes; absent optimization/decision digests are never replaced with placeholders. This port is not a new policy/reviewer authority. Its real producer/storage runtime binding remains outstanding alongside live independent authority, provider/gateway wiring and activation.
- Added actual synthetic pipeline tests, including known source servings with null cooked yield/null assigned grams passing through the real independent validator. Cooking remains deferred per owner steering. Test fixture construction now supports unknown yield without fabricating assigned grams.
- No live database operation, catalog publication, Edge deployment, runtime activation, Graph V1 change or FACT write.

## Continue generation without mandatory home cooking — owner steering, 2026-10-31

- Owner explicitly deferred broad cooking/culinary testing and mutable recipe refinement to a month-long application test. Cooking is not a global prerequisite for continued server/client implementation. Earlier batch protocols below are historical preparation, not an instruction to stop development.
- Retain unknown measured yield/serving grams; use only grounded composition/serving definitions and label calculated nutrition at the appropriate future presentation boundary. This steering does not approve missing canonical evidence, raw/cooked substitutions, invented portions, public catalog publication or generator activation.
- Implemented request continuity in the existing inactive worker/status path: validate and pin the request/dependencies before awaits; bind load/record/activation/status replies to that request; require exact proposal bytes through validator and record; do not activate again when record already returns ACTIVE. GENERATED/ACTIVATING recovery still skips generation/record.
- Transport failures still require same-request status recovery; no blind record retry or FACT effect. These checks complement independent validation and DB authority checks; they do not themselves authenticate a validator or establish a durable commit.
- Production/Staging deployment, Edge/generator binding and activation remain unchanged. Proposal projection and inactive provider/validator bindings are now implemented above; real runtime storage/gateway mounting and exact readback/client opening remain outstanding before a real menu can be delivered. Purchase verification remains after generation (#198).

## First bounded real recipe review batch — 2026-10-31

- Selected the existing owner pilot oatmeal_with_apple and previously prepared pear_almonds for the first source/measurement batch, reusing exact parent package hashes. No replacement of the pilot by the different workbook oatmeal_apple_cinnamon identity. This two-recipe batch is not weekly catalog coverage.
- Recorded remaining physical measurements and review gates. Input mass sums (370 g oats/water/apple and 200 g pear/almonds) remain distinct from measured cooked/assembled yield; declared one-serving source values are not confirmed servings. No new nutrition engine, authority path or publication claim.
- Held two boiled-egg snack candidates: their authoring egg vectors match official SR28 raw whole egg NDB01123 (143 kcal/100 g), while instructions require boiled eggs. Official NDB01129 hard-boiled vector differs (155 kcal/100 g). Retained official page-402/page-384 facts and PDF hash. Two whole eggs and reference 100 g cannot establish measured cooked edible mass; no automatic vector replacement or fractional egg rule.
- Existing private report contains exact batch observations. Source workbooks, live DB, portion evidence and runtime remain unchanged; generator inactive.

## Salt and water authoring review — 2026-10-31

- Inspected the same byte-pinned real master. Salt: 71 rows/70 recipes, 45 numeric gram quantities, 26 missing (14 optional and 12 required). Optional/to-taste flags are not permission to omit ingredients or set unknown mass to zero.
- Water: 64 rows/62 recipes, all volume units ML; 51 recorded gram values equal those volumes and 13 gram values are absent. Preserved recorded values without issuing density approval/converting missing grams. Drained/evaporated process input cannot be assigned as finished recipe yield.
- Prepared official SR28 NDB02047 page-22 salt facts with actual PDF/capture hashes; reused existing NDB14411 water capture and pinned its existing source package. Explicit source zeros do not prove all-zero ingredient mass, a retail match or source issuance. Water retains the previously selected typed nonfood review path; no new authority mechanism.
- All salt/water bindings remain unresolved with no stable IDs or receipts. Recipe publication, portions, output weights, database contents and generator activation unchanged. Existing private readiness report carries the detailed observations; public source package contains aggregates only.

## Real master execution and first ingredient group — 2026-10-31

- Materialized the latest saved master, 393790 bytes; SHA256 matches `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`. Extracted original values read-only and ran the actual review-queue implementation: 132 real recipes, 730 ingredient rows, 216 literal-name groups; all 730 require review. Workbook unchanged.
- First group: olive oil, 71 rows/recipes. All grams are positive and equal recorded amounts; 5/10/15/20 g distributions are 23/45/2/1. All bindings remain unresolved. No conversion or brand/state inference.
- Checked official SR28 NDB04053 PDF page 302 and retained its five nutrient facts/source PDF hash. Prepared input contributions only, preserving 884 kcal/100 g source energy. FDC171413 workbook claim is not independently verified. Oil retention in cooked food remains unmeasured; no recipe nutrition/portion/yield approval.
- Staging read-only exact shared-name observation: one candidate, zero complete five-nutrient vectors. No binding or DB mutation. Existing private readiness report updated; recipe details/rows are not committed to public GitHub. Source preparation is not issued evidence/publication, and generator stays inactive.

## Real ingredient review queue — 2026-10-31

- Owner's Android Staging check showed server-confirmed existing-account login, Admin=false, Premium=false, all seven closed RPC probes denied, and local test-session completion. This confirms existing-login transport, not new signup, recipe readiness or generator activation.
- Offline master inspection now includes a row-addressable ingredient review queue ranked by distinct affected recipes, then source-row count. Literal authoring labels group review work only; spelling variants are separate and no food identity/state/brand is inferred.
- Each repair target retains its recipe/ingredient row IDs, filtered-input index, recorded grams/status/stable ID and explicit missing-data reasons. Quantities are never summed across recipes; source rows are not rewritten or approved. Blank names, invalid grams and inconsistent RESOLVED rows remain visible; repeated/missing row IDs fail closed.
- The queue is preparation for independent ingredient review. Empty queue and workbook APPROVED text cannot establish publication. Actual source export execution and live recipe publication are not claimed by synthetic tests. Cooking/assembly, portions, allergens, nutrition evidence and varied weekly coverage remain required.
- No database write, runtime binding, merge, deployment or generator activation. Purchase verification remains after generation (#198).

## Generation recovery checkpoint — 2026-10-30

This branch records source preparation only; it does not update the deployed application.
The 2026-10-03 checkpoint below is historical, not the current generator status.

- Verified GitHub generation stack: Draft PRs #244–#252 remain open and unmerged.
- Latest inspected base: #252, `46eccc401f2bd99acde478396d6f51932400cfa2`. Both exact-head CI workflows succeeded.
- Day/meal/week selection is implemented in the candidate stack and tested on synthetic inputs; final accepted-plan projection, full runtime orchestration and real end-to-end delivery remain incomplete.
- Real source readiness: 132 recipes, 0 APPROVED, 730 unresolved/ambiguous ingredient rows. This is the prior source audit, not a new live DB check.
- Recovered the previously uncommitted pear/almond source preparation in an isolated branch; original working files were preserved. Official SR28 record pages and carbohydrate semantics were independently checked.
- Pear/almond available-carbohydrate reference discrepancy is explicit; no workbook rewrite, recipe approval, canonical identity, evidence receipt or measured yield was invented.
- Oatmeal pilot remains selected; water evidence issuance and physical cooking are outstanding. Dairy NO-GO remains in force.
- Next: close existing Food/Nonfood issuer integration gaps, obtain independent source/portion/allergen/publication review for a small real batch, then test real weeks and final server record/read flow. No new parallel authority mechanism.
- Supabase/STAGING/production writes, merge, deployment and generator activation: not performed in this recovery.
- Purchase verification stays after generation, tracked in issue #198.

See [source preparation](docs/premium/pear-almonds-source-preparation-20261030.md), [catalog audit](docs/premium/real-catalog-readiness-20261030.md) and [integration gaps](docs/premium/generation-integration-checkpoint-20261030.md).

## Historical checkpoint

Checkpoint date: 2026-10-03

- GitHub `master` at this checkpoint: `25166665fee11465af867d1731e6818549c2bca0`.
- Cloud environment `POTOK`: **published and operational**.
- Cloud workflow branch → PR → review → owner approval → merge: **verified end-to-end**.
- `WORKFLOW.md` is in `master`; PR **#142 merged**.
- The protected execution binding is accepted on STAGING.
- Rollback-only behavioral acceptance: **PASS**.
- Final SELECT-only postcheck: **15/15 PASS**.
- Acceptance fixture residue: **zero**.
- Auth-contract and schema-USAGE repairs are applied on STAGING.
- GitHub Pages build and deploy for the checkpoint: **PASS** (run `37141713000`).
- Edge Function: **NOT DEPLOYED**.
- Trusted generator: **NOT ACTIVATED**.
- Production database: **untouched**.
- Existing local future work: **72 paths remain uncommitted**; owner baseline paths remain separate and preserved.
- Next technical phase: protected execution runtime / Edge orchestration integration, without generator activation or production rollout.
