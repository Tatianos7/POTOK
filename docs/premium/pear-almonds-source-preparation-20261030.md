# Pear and almonds — real source preparation, not publication

This parallel preparation uses the existing `pear_almonds` workbook candidate. It does not replace the owner-selected oatmeal pilot or reopen dairy NO-GO work. The source workbook and database were not changed.

Direct official USDA SR28 PDF tables were inspected for NDB09252 (raw pear, page 707) and NDB12061 (almonds, page 18). Their five nutrient values were transcribed into short retained factual captures with actual byte hashes. Source version/record/page are explicit; no unverified FDC API identity binding or upstream PDF-byte hash is claimed. The generic almond row does not itself prove applicability to a specific raw unsalted retail product, so that review stays open.

The source's carbohydrate-by-difference includes fiber, as confirmed by the SR28 guide, printed page 13/PDF page 20. The package references the existing POTOK total-minus-fiber policy and its retained parent bindings; it does not issue a new policy approval or automatically approve this food-specific mapping. Source calories remain unchanged.

For the source-recorded 180 g edible pear and 20 g edible almond kernels, independent fixed-point input arithmetic gives:

| Field | Source input calculation |
| --- | ---: |
| kcal | 218.400 |
| Protein g | 4.878 |
| Fat g | 10.238 |
| Total carbohydrate including fiber g | 31.724 |
| Fiber g | 8.080 |
| Candidate POTOK available carbohydrate g | 23.644 |

The workbook reference `ref_carbs_g=31.7` matches rounded source total carbohydrate, while the candidate POTOK available-carbohydrate value rounds to 23.6 g. This is an explicit reference-semantics finding, not a silent correction of authoring rows or a reviewed recipe nutrition claim. No actual retail-product variability is quantified here.

Recipe grams must be edible portions. Do not apply the pear's source refuse percentage again to already cored fruit, or the almond shell percentage to already shelled kernels. Do not replace ingredient grams by a nut count. The 200 g input mass sum is not a measured assembled yield. Finished weight, served weight and confirmed serving count remain null.

Prepared for review: source captures and hashes, exact record/page locators, mapped candidate vectors, transparent arithmetic, the reference discrepancy, an assembly record checklist, and explicit missing approval/identity fields. Still required: actual product/state applicability, independent canonical/nutrition evidence issuance, observed assembly/portion measurements, allergen/dietary review, portion policy, recipe publication and manifest review. All readiness/activation gates remain false; no identities or receipts were minted.

Regression checks verify retained bytes/locators, all five decimal fields, single fiber subtraction, source energy preservation, edible-weight arithmetic and retention of missing measurements/approvals. No runtime, Edge, UI, SQL write, deployment or generator activation is included.
