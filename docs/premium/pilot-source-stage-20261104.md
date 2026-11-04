# Pilot source review stage, 2026-11-04

Outcome: all four owner-approved documentation/test tasks are complete as a
source review with explicit blockers. This is **not** completed source admission,
canonical resolution, nutritional approval, recipe publication or generation.

The stage continues #313 at `e7994255d5be15dee9c4b6672d80839a395c7682`.
Process rules were read from #314 at
`708329c1d8feaf4141676598f6dc09cbb52787b9`; that separate PR is not merged,
retargeted or copied over the stronger generation-branch domain decisions.
The original working directory and its owner files are preserved; work uses an
isolated worktree and `codex/pilot-source-stage-20261104`.

## Approved tasks and acceptance results

| Task | Result and evidence |
| --- | --- |
| Review the other 27 outstanding rows | 21 case groups assign every row exactly once to checked primary comparisons or a specific remaining source/class blocker. The workstream includes butter; it is not a claim that all 27 are non-dairy. |
| Review 15 milk/yogurt/tvorog rows and four ML inputs | Four class cases cover 4 milk, 3 natural yogurt, 2 Greek yogurt and 6 tvorog rows. Four volume cases distinguish copied mass reference from measurement and reviewed conversion. |
| Consolidate all 120 ingredient rows | A sorted, pinned inventory covers exactly 24 recipes and 120 unique ingredient IDs: 78 prior preparation rows plus 42 reviewed here. No row receives a canonical ID or approved runtime status. |
| Integrity, negative tests and Draft PR | Source fields/provenance, coverage, missing data, volume/mass and the real runtime publication boundary are tested. See PR for final local/CI results. |

## Primary acquisition and scope

Downloaded the public official [SR28 ASCII archive](https://www.ars.usda.gov/ARSUserFiles/80400535/DATA/SR/sr28/dnload/sr28asc.zip),
linked by the official [USDA historical releases page](https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/sr11-sr28/).
Archive SHA-256:
`8308fd1d224ef1e5331093748007180da01a7ac713cbac6a1f5bc2a03e1ee70a`.
No owner recipe data was transmitted to USDA. The bulk archive remains a local
analysis input; only selected public factual record captures are retained in Git.

The capture pins 27 descriptions and their original selected NUT_DATA rows,
record line numbers, file hashes, nutrient-definition rows and original
sample/source/derivation columns. NDB identifiers retain leading zeroes.
Nutrients 203/204/205/208/291 are protein/fat/carbohydrate by difference/energy/
fiber. The documentation's Table 8 identifies NUT_DATA value as per 100 g edible
portion; nutrient definitions retain g versus kcal. Source codes are not recast
as laboratory measurement. Missing nutrient rows stay null, not zero.

This is the exact historical archive inspected, not current FoodData Central,
Foundation or a verified FDC-to-NDB crosswalk. Source file timestamps in the ZIP
are 2015; no separate patch or other dataset was applied. A different recorded
Foundation/FDC value may be legitimate; a mismatch requires version/provenance
review rather than an automatic correction or an accusation that it is wrong.

## Consequential findings

- The frozen-strawberry authoring reference has the inspected raw-strawberry
  vector (32/0.67/0.30/7.68/2.0). The historical frozen-unsweetened record differs
  (35/0.43/0.11/9.13/2.1). This reference collision needs the exact original
  frozen source and state review. Neither vector is selected automatically.
- The raw blackcurrant record has no nutrient 291 entry. It does not establish
  the authoring fiber 4.3 or the frozen class. No raw-to-frozen transfer or fiber
  borrowing is performed; retaining declared thaw juice remains a separate check.
- Whole-bird and retail-parts turkey breast records share 114 kcal but differ
  in protein/fat. Beef has a specific select/trim/cut description, rabbit is a
  composite of cuts, and tuna has separate without-salt/drained variants. Equal
  macros or a broad ingredient label do not resolve those identities.
- Cocoa processing, butter salt class, commercial bread composition/source
  version and breadcrumb class remain explicit checks. Pollock and oats have
  newer/proxy source claims not verified by matching an older SR28 record.
- Exact drained/rinsed cannellini, the whole-grain rye crispbread proxy and the
  unresolved hummus formulation remain specifically blocked. They are not
  replaced by generic canned white beans, rye crackers or a guessed formulation.
- Rounded walnut, blueberry and cinnamon references are retained separately
  from the captured exact source values. No recipe nutrient totals are rewritten.

## Dairy and volume findings

Historical milk and yogurt comparisons are not approval of generic Russian
retail classes. The natural and Greek yogurt reference vectors differ from the
captured low-fat records. Two distinct recorded milk profiles also remain
version/class questions despite equal calories. A complete independently
reviewed class can be appropriate; a brand is not imposed universally.

The six tvorog rows retain the earlier generic-any-brand decision and NO-GO.
The provisional authoring vector is not runtime nutrition. USMZ is a separate
branded example with unknown fiber; US cottage cheese is not a replacement for
generic tvorog. The stopped generic-curd source search was not reopened and no
source row or zero fiber was invented to make admission pass.

The four milk inputs are 100, 150, 300 and 400 ML. The first two have numerical
gram references; the other two lack grams. All four lack an admitted conversion
or measured mass in this review. The data preserves both reference and volume;
it neither labels the reference as measurement nor fills missing grams. Future
preparation can use a reviewed per-volume nutrition source or a reviewed
class/product conversion. No universal 1 ml = 1 g, inferred cup density, or
household measure shortcut is introduced.

Physical cooking, measured yield and practical portions remain deferred to
owner prelaunch application testing. This does not waive source admission, but
does not impose cooking all recipes as a prerequisite for coding or previews.
The owner's recipe-specific buckwheat/potato rule remains unchanged; old state
ambiguities and source-mapping decisions are not silently cleared.

## Retained results and limitations

- [Primary factual capture](retained-sources/pilot-source-stage-20261104/sr28-ascii-capture-v1.json).
- [All 42 row decisions, grouped into 25 cases](retained-sources/pilot-source-stage-20261104/remaining-42-review-v1.json).
- [Four milk-volume cases](retained-sources/pilot-source-stage-20261104/milk-volume-review-v1.json).
- [Consolidated 120-row inventory](retained-sources/pilot-source-stage-20261104/120-row-review-v1.json).

The private catalog bytes were unchanged at SHA-256
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
The exact original 24-recipe private packet was reproduced at its already
published checksum
`e7ad3b7161156a444f7e2c24226226aff58fee9659dba55d1ec09546e4eae723`.
Only row identifiers, row hashes, findings and public-source captures are added
here; no private recipe body, preparation steps or private packet is published.
Authoring-row digests use UTF-8 JSON of the original row with sorted object keys,
compact comma/colon separators and unescaped Unicode. They are offline inventory
checks, not runtime canonical serialization or evidence issuance.

This stage reviews all formerly outstanding 42 rows; it does **not** raise an
approval percentage to 120/120. The prior 78-row number measured preparation
reach, including label-only candidates and reused locators. The new inventory
preserves those weaker bases and earlier findings instead of relabelling them
as verified bindings. Runtime admitted recipes and approved canonical bindings
remain zero. Every unresolved case identifies the next required evidence.

No Production/Supabase read or write, migration, role/RLS/grant change, runtime
configuration, worker activation, merge or deployment was performed. PLAN != FACT,
history and account isolation are unaffected. Passing these tests cannot issue
source authority or a review receipt. The real publication decoder rejects all
four stage packet shapes, including variants with forged approval flags.

Local validation: 19 targeted stage/prior-source/pilot-packet tests passed;
targeted ESLint and TypeScript passed. The initial local typecheck lacked
`@peculiar/x509` in the older shared dependency set. Exact project version 3.1.0
was installed into a separate temporary prefix and overlaid only in this
worktree; no owner dependency directory, package manifest or lockfile changed.
CI installs the complete locked dependency set independently. A separate local
comparison recomputed every retained row hash against the reproduced private
packet: 120/120 matched. No private recipe-body fields occur in the new packets.

## Stage measurement and next gate

One owner approval covered the four tasks. No extra implementation approvals or
parallel autonomous workers were used. Local and CI results, plus observed PR
creation-to-check-completion time, are reported in the Draft PR. Whole-stage
elapsed time was not instrumented; no retrospective duration is fabricated.

The next recommended stage is a bounded resolution/export package for the
specific source/class/version decisions above, with independent evidence and
review authority established before canonical resolution or publication.
Authoring remains usable for explicitly marked offline development meanwhile.
An owner decision can choose intended ingredient variants; it cannot supply
unseen analytical data. Source approval, any Staging apply, recipe publication,
worker enabling and PR merges remain separate explicit gates. This PR requests
none of those actions.
