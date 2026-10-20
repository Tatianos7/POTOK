# P5-03B — recorded pilot/source decision

Owner selected existing `oatmeal_with_apple` / «Овсяная каша с яблоком» on
2026-10-13 (owner task). `cottage_cheese_with_apple` is unchanged; its NO-GO search
is stopped. Reason: reuse accepted apple and prepare one main new food, dry oats.
This is pilot selection, not culinary review, source issuance or publication.

Apple is reused only through parent HEAD `dc3ed6e8bb4f0cfb0534b5d632dee0018856040c`,
parent source-package SHA and retained-source/policy bindings. No independent apple
revision is created. Parent carbs policy remains unchanged; source calories are kept.

USDA SR28 NDB08120 is a generic reference for regular/quick plain rolled oats,
not fortified, dry. Direct official PDF page 764 and screenshot confirm the exact
row and numeric fiber. Other QUAKER/flavored/cooked rows are not used. Applicability
requires plain dry oats without added milk, sugar, flavor or filler; it does not
claim that every commercial oat product matches or is gluten-free. Oat source is
prepared for issuance INPUT, with no canonical UUID/revision/event/receipt minted.

Preferred water path is existing approved_non_food representation. USDA SR28
NDB14411 provides an explicit five-field zero source candidate; no server water
definition/evidence issuer or approved binding is available. Water component
is NOT_READY; whole source-input package remains NO-GO. The input food subtotal
is reference arithmetic, not reviewed recipe nutrition or a complete water-inclusive
recipe calculation. PHYSICAL_COOKING_REQUIRED=true.

Next action: separate server-contract task for nonfood definition/evidence issuance,
review/receipt/currentness/retention, preserving existing consumer representation. Do not
infer approval from zeros or mint identifiers. The actual approval/issuance is separate.

[Audit and future cooking protocol](p5-03b-oatmeal-apple-evidence-audit.md).
[Machine-readable package](retained-sources/p5-03b/source-package-v1.json).
PLAN != FACT.
