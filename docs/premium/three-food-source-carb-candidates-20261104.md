# Three primary sources and carbohydrate candidates — 2026-11-04

Continues Draft #317 at `0191cbd99fb14925885236cca2cea774e50120a8`.
Four bounded tasks: recheck the three named primary records, establish their
carbohydrate semantics under the existing POTOK policy, form coherent complete
source-vector candidates, and test the source/publication boundary. #314 remains
a separate process PR. No apply or source admission was authorized.

## Acceptance and paths

| Task | Acceptance | Affected paths |
| --- | --- | --- |
| Primary records | Official archive SHA, food/nutrient file hashes and all retained lines rechecked; independent exact FDC IDs for two originally named records | `retained-sources/three-food-primary-recheck-20261104/` |
| Carbohydrate semantics | Direct guide checked; existing policy reused; explicit same identity/state/basis/units, numeric fiber and nonnegative exact result required | Retained factual summary, offline builder |
| Complete candidates | Three five-field candidate vectors with separate source total/fiber; source calories preserved; unknown before semantics not invented | Offline builder and private report |
| Tests/security | Corruption, substituted nutrient/unit/identity, unknown semantics and approval attempts rejected; no runtime acceptance | New test, PR CI workflow |

## Direct primary recheck

Downloaded the official [SR28 base ASCII archive](https://www.ars.usda.gov/ARSUserFiles/80400535/DATA/SR/SR28/dnload/sr28asc.zip)
again. SHA256 is unchanged:
`8308fd1d224ef1e5331093748007180da01a7ac713cbac6a1f5bc2a03e1ee70a`.
FOOD_DES, NUT_DATA and NUTR_DEF file hashes match #315. All three retained food
lines and their five nutrient lines match the freshly downloaded archive exactly.
No May 2016 patch, SR Legacy replacement or current Foundation substitution was applied.

Separately retrieved official FoodData Central API records **170187** (walnuts,
NDB12155) and **171711** (raw blueberries, NDB09050), the exact IDs named in the
original private notes. Retained full public response bytes preserve identity,
publication date, nutrient units, IDs, source/derivation metadata and precision.
They identify themselves as SR Legacy with publication date 4/1/2019. The five
selected nutrient values match the historical SR28 values. This is record-specific
corroboration, not a crosswalk or equality claim for whole datasets/other nutrients.
No FDC ID or FDC confirmation is invented for the frozen-strawberry record.

The retained `source-recheck-v1.json` binds the parent capture, observed archive/file
hashes, each captured record, both full API responses, guide summary and parent
mapping policy. API keys/credentials are absent from retained URLs and bytes.
The runtime app acquires no FDC client, network call or new service dependency.

## Source semantics and complete vectors

The directly downloaded [USDA SR28 guide, slightly revised May 2016](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
defines carbohydrate by difference as including dietary fiber and describes an
optional calculation excluding fiber (PDF p20, printed p13). Retained factual
summary, complete document hash and extracted-page hash identify this check.
The revised guide hash differs from the guide inside the historical archive;
both hashes stay distinct. The guide recheck does not imply applying a data patch.

Reuse existing policy `potok-source-total-including-fiber-to-available-v1` from
the pinned P5-03 parent package: same-source total minus dietary fiber, exactly,
only with explicit inclusion semantics and matching identity/state/basis/units.
This is a source-candidate calculation, not a new policy approval or food-specific
mapping approval. Unknown semantics/fiber reject; no missing-fiber zero and no
4/9/4 reconstruction of energy.

| Historical SR28 record, per 100 g edible | kcal | Protein g | Fat g | Source total carb g | Fiber g | Candidate POTOK carb g |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 09318 frozen unsweetened strawberries | 35 | 0.43 | 0.11 | 9.13 | 2.1 | 7.030 |
| 12155 English walnuts | 654 | 15.23 | 65.21 | 13.71 | 6.7 | 7.010 |
| 09050 raw blueberries | 57 | 0.74 | 0.33 | 14.49 | 2.4 | 12.090 |

Each complete mapped vector uses its own source's calorie/protein/fat/fiber and
the derived available-carbohydrate value. It never mixes candidate protein/fat
with old unreviewed authoring carbohydrate. Original before references remain
manual unverified transcriptions. Their available carbohydrate stays null, so
**no before/after available-carbohydrate delta is calculated**. #317's conditional
literal calorie/protein/fat/fiber comparisons remain explicitly separate; recipe,
day/week totals and cooked nutrition are not recomputed.

## Offline implementation and validation

`scripts/contracts/three-food-source-candidates-v1.ts` rebuilds the parent review
from original-row-bound private input and validates the fixed source bundle.
Only one row for each of the three cases is accepted. The validator checks record
digests, observed file hashes, five values, API identities/units/uniqueness, guide
summary, policy and admission flags. An API response changed and rehashed still
must match pinned SR28 identity/units/values. Hashes identify bytes, not authority.
The exported seams are for trusted offline tests/composition, not approval inputs.

```sh
node --import tsx scripts/contracts/three-food-source-candidates-v1.ts PRIVATE_INPUT.json > private-three-source-candidates.json
```

There is no apply operation, database or network access in this CLI. Its output
contract is `potok-three-food-complete-source-candidates-v1`. `sourceApproved`,
`foodSpecificMappingApproved`, `canApply`, `runtimePublishable` and `mayActivate`
stay false; `selectedOption` and `ownerDecision` stay null.

The actual private replay inspects the same 42 rows and returns exactly three
complete source candidates; zero selected/applied changes or source approvals.
Original catalog SHA256 remains
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
No private original rows, recipe bodies or notes are committed to public Git.

Local PASS: 30 tests (eight new plus prior source/proposal/draft/pilot tests),
strict standalone TypeScript, ESLint, private replay and diff checks. See the
Draft PR for exact PASS counts, remote head and CI results. Tests exercise exact
decimal subtraction, missing/unknown/negative data, mismatched units/state/basis,
corrupted or rehashed API identity/nutrients, stale bindings, original-row mutation,
privacy, preserved energy and rejection of ordinary/forged-approval exports by
the real reviewed runtime publication decoder.

## Remaining gates

Primary byte corroboration and coherent vector arithmetic are complete for this
scope. Recipe-specific source applicability, original-reference transcription,
food-specific mapping review and owner choice remain open. Frozen unsweetened
identity and all thaw juice retained remain requirements; raw 09316 is not a
replacement. Generic-tvorog NO-GO, milk/discrete mass blockers, other 39 rows and
the buckwheat/potato owner decisions are unaffected. No brand is universally forced.

Physical cooking/yield/portion tests remain deferred to owner prelaunch app tests,
not a prerequisite for development or clearly labelled offline previews. No
canonical identity/receipt, runtime admission, history/PLAN/FACT, Supabase or
Production state, grant/RLS/migration, publication, deployment, activation or merge
changes. Next is food-specific review of these three coherent source candidates;
any apply/publication or hosted change remains a separate owner gate.
