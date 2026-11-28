-- Pass an array of authoring cards as the psql variable cards (JSON).
-- Read-only. A card passes when every pinned ingredient and every total matches.
WITH cards AS (
  SELECT value AS card FROM jsonb_array_elements(:'cards'::jsonb)
), sources AS (
  SELECT h.revision_id, h.digest, h.canonical_food_id AS identity,
         h.food_state, r.snapshot #>> '{sourceProposal,numericInput,reference,basis}' AS basis,
         r.snapshot #> '{sourceProposal,numericInput,mappedDecimalText}' AS nutrients
  FROM potok_food_evidence.exact_heads_v2 h
  JOIN potok_food_evidence.exact_revisions_v2 r USING (revision_id)
  UNION ALL
  SELECT h.revision_id, h.digest, d.revision_id, n.snapshot #>> '{proposal,applicability,foodState}',
         n.snapshot #>> '{proposal,basis}', n.snapshot #> '{proposal,nutrition}'
  FROM potok_nonfood.heads_v1 h
  JOIN potok_nonfood.nutrition_v1 n USING (revision_id)
  JOIN potok_nonfood.heads_v1 d ON d.definition_id=n.definition_id AND d.revision_id=n.definition_revision
), scaled AS (
  SELECT card->>'authoringRecipeId' AS recipe, nutrient,
         (card #>> '{baseYield,servings}')::numeric AS servings,
         (card->'nutrition'->>nutrient)::numeric AS claimed_total,
         (item->'nutrition'->>nutrient)::numeric AS claimed_amount,
         (src.nutrients->>nutrient)::numeric * (item->>'weightG')::numeric / 100 AS amount
  FROM cards
  CROSS JOIN jsonb_array_elements(card->'ingredients') AS item
  CROSS JOIN unnest(ARRAY['calories','protein','fat','carbs','fiber']) AS nutrient
  LEFT JOIN sources src ON src.revision_id::text=item #>> '{nutrition,evidenceRef}'
    AND src.digest=item #>> '{nutrition,evidenceDigest}'
    AND src.food_state=item->>'state' AND src.basis='PER_100_G_EDIBLE'
    AND src.identity::text=coalesce(item #>> '{canonical,canonicalFoodId}',item->>'approvedNonFoodEvidenceRef')
)
SELECT recipe, nutrient, count(*) AS ingredients, sum(amount) AS total,
       sum(amount)/nullif(servings,0) AS per_serving,
       bool_and(coalesce(amount=claimed_amount,false))
         AND coalesce(sum(amount)=claimed_total AND servings>0,false) AS verified
FROM scaled GROUP BY recipe,nutrient,servings,claimed_total ORDER BY recipe,nutrient;
