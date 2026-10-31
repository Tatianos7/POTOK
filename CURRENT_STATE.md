# POTOK current state

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
