# Nutrition data semantics — owner decisions, 2026-10-15

Status: **APPROVED PRODUCT PRINCIPLES; IMPLEMENTATION PENDING**.

This record is the single source for the owner's 2026-10-15 product decisions across
food data, reviewed evidence, recipe publication and Premium/Today. Approval of a
principle is not approval of a new wire/schema version, evidence issuance, a recipe,
a clinical policy or a runtime rollout. Existing versioned contracts and their
fail-closed checks remain in force until separately reviewed changes are made.

## Approved product principles

1. POTOK's calculated digestible/available carbohydrates are distinct from dietary
   fiber. A source's carbohydrate value must retain its own definition. A source
   total that includes fiber is not already a POTOK available-carbohydrate value.
2. Preserve original nutrient values, definitions, units, food identity and state,
   source version/locator, retained evidence and provenance alongside any derived
   value and the version of its mapping. A digest proves byte integrity, not source
   applicability, reviewer authority or currentness. Unknown carbohydrate inclusion
   semantics do not authorize a conversion.
3. Unknown dietary fiber is `null`, never inferred as numeric zero from a blank,
   dash, omitted label or another food. Where available carbohydrates require
   subtraction of fiber, an unknown fiber value cannot be silently used as zero.
4. Missing fiber alone does not prohibit a product, including generic plain
   unsweetened 5% cottage cheese, when other applicable product requirements are
   met. This principle does **not** relax the current five-field reviewed nutrition
   evidence contract, recipe publication checks or Graph v1's numeric fiber shape.
   It grants no reviewed evidence, recipe eligibility or publication by itself.
5. Generic plain unsweetened 5% cottage cheese remains **NO-GO for P5-03 evidence
   issuance and assembly**: its other identity, source and nutrition evidence gaps
   remain open. Values from a branded example cannot be transferred to the generic
   identity. The absence of fiber is no longer, by itself, the product-level reason
   for exclusion; this does not close the remaining gates.
6. Premium/Today should account for fiber as a diet-quality indicator. Planned
   meals are not proof of consumption (`PLAN != FACT`); quality assessment must
   distinguish planned, recorded and unknown intake. Incomplete fiber coverage must
   not be presented as achievement of a daily norm.
7. **25–30 g/day is PRELIMINARY**: a non-personalized orientation for further
   review, not an approved individual target, clinical threshold, safety policy or
   claim that a user met a norm. No user-facing attainment claim follows from this
   record.
8. Historical food, recipe, diary, plan and evidence records are not recalculated
   automatically. Any future interpretation or mapping needs an explicit versioned,
   forward-looking policy and a separate migration/history decision.
9. Before implementation, inspect existing contracts and every affected calculation
   and consumer. Do not replace Graph v1 silently; Graph v2 is separately versioned.

## Existing boundaries and provenance

- [Food Reviewed Evidence v1](food-reviewed-evidence-contracts-v1.md) currently
  requires all five non-null, exact decimal nutrition fields, including fiber, and
  retained source mappings. Its representation and digests do not issue evidence.
- [Nutrition Data Quality Baseline](../security/nutrition-data-quality-baseline.md)
  recommends fiber for catalog foods; its required catalog macros are calories,
  protein, fat and carbs. Catalog admissibility is distinct from reviewed evidence
  and curated recipe publication.
- [Premium Adaptive Nutrition v1](../premium/adaptive-nutrition-v1.md) preserves
  PLAN/FACT, incomplete actual data and the inactive weekly Today preview.
  [Nutrition safety evidence](../premium/nutrition-safety-evidence-v1.md) has not
  approved individual thresholds or clinical use of 4/9/4 arithmetic.
- Draft [PR #163 owner review](https://github.com/Tatianos7/POTOK/blob/dc3ed6e8bb4f0cfb0534b5d632dee0018856040c/docs/premium/p5-03-cottage-cheese-apple-owner-review.md)
  and [evidence audit](https://github.com/Tatianos7/POTOK/blob/dc3ed6e8bb4f0cfb0534b5d632dee0018856040c/docs/premium/p5-03-cottage-cheese-apple-evidence-audit.md)
  record the separate 2026-10-13 USDA apple source/mapping decision and the
  unresolved generic cottage-cheese evidence. This later product decision does not
  rewrite that dated audit, manufacture a review event or mark either food issued.

## Implementation pending — separate review required

- Design a versioned nullable-fiber representation and coverage semantics through
  food evidence, recipe publication and Graph, preserving Graph v1 compatibility.
  Test that unknown stays `null`, while unrelated identity, provenance, nutrition,
  safety and publication gates still reject invalid inputs.
- Audit source conversions by carbohydrate definition, identity, state, edible
  basis, units, retained bytes and mapping version. Preserve source calories and
  original totals; do not assume that every USDA or label field shares one meaning.
- Inventory 4/9/4 and other calorie/macro calculations, recipe ingredient and
  portion totals, rounding, diary snapshots, Progress, Goal and plan projections.
  Distinguish mathematical consistency checks from source facts and clinical claims.
- Specify Premium/Today coverage, aggregation and UX for partially known fiber:
  planned versus actual, missing meals/days, unknown components and conservative
  attainment language. Review the preliminary range against population, evidence,
  contraindications and an explicit safety-policy version before activation.
- Decide any migration or re-interpretation of historical records separately;
  this document authorizes no automatic backfill, SQL apply or runtime change.
