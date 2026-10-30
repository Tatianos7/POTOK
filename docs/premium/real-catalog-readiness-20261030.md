# Real recipe source readiness — 2026-10-30

Read-only source check for the next generation step. No original workbook, live database, review status, canonical mapping, publication, deployment or activation was changed.

The latest saved master found by filename search was `POTOK_recipe_master_v1_007(3).xlsx`, 393790 bytes, SHA-256 `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`. Later local-only edits, if any, are not covered. Source content was inspected locally; recipe bodies and personal database recipe rows are not included in this PR.

Recomputed from nonblank real recipe IDs, excluding two explicit demonstration IDs:

| Observation | Count |
| --- | ---: |
| Real recipes | 132 |
| READY_FOR_REVIEW / DRAFT / APPROVED | 120 / 12 / 0 |
| Ingredient rows | 730 |
| UNRESOLVED / AMBIGUOUS | 729 / 1 |
| Ingredient rows with stable food IDs | 0 |
| Ingredient rows lacking positive numeric grams | 93 |
| Recipes lacking positive numeric servings | 2 |
| Recipes lacking recorded positive finished yield | 129 |
| Recipes lacking reference fiber | 10 |
| Preparation steps | 618 |

Recorded yield is not proof of measured yield; some source notes explicitly describe estimates. Null yield is not a universal runtime prohibition when independently reviewed portions exist, but raw ingredient mass must not be promoted to measured cooked yield. Reference nutrition, READY_FOR_REVIEW and workbook membership cannot supply reviewed runtime publication evidence.

Live database observations were taken in explicit `BEGIN READ ONLY` transactions and rolled back. Production: 15 legacy recipe rows, all lacking servings/yield; all have an ingredient graph and non-null aggregate nutrients. These are aggregate counts, not an approval or public-catalog classification. Staging: zero candidate manifests, entries and current manifest heads. No private recipe names or owner data were retrieved.

Exact ingredient-name discovery used the existing `buildNormalizedName` and `normalized_name` equality only, restricted to ownerless shared core/brand foods. Among 216 unique normalized source names, 34 had one exact name candidate and 182 had none; none had multiple exact candidates. All 34 lacked a complete five-nutrient vector. Name equality does not establish ingredient state, brand, evidence provenance or canonical eligibility. No fuzzy match, RESOLVED assignment or source issuance occurred.

The offline `recipe-master-readiness-v1.ts` scanner makes future source checks repeatable. It checks required sheets/headers, excludes explicit examples from observations, rejects duplicate recipe IDs, retains source statuses and notes, reports missing quantities and unresolved mappings, and hashes the actual source bytes. Its `runtimePublishable: false` describes the absence of an independent runtime evidence export in this worksheet format; it is not a new publication validator or a replacement for the existing authoring/publication contracts. It has no write or network operation.

The private detailed report contains all 132 recipe observations, 216 exact-search outcomes and five concrete first-review preparation cards. The current owner-selected oatmeal pilot remains separate from similarly named workbook recipes. Existing dairy/source NO-GO decisions remain in force. First-review cards are data preparation candidates, not approved recipes or a nutritionally complete week.

Next actual prerequisites: reviewed food/nonfood source bindings including fiber and carbohydrate policy, exact quantities/state/conversions, required physical cooking/assembly evidence, explicit portion rules/allergen/dietary/composition review, independent publication evidence export, and then owner-authorized catalog publication. Do not create a PUBLISHED manifest from these draft rows or bypass the existing repeat caps to force a weekly plan.
