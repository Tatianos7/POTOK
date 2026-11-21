import batch from '../stagingRecipe27ReviewBatch.json';
import { exactNutritionInputDigestV2, decodeExactNutritionInputRawV2 } from '../utils/exactNutritionValuesV2';
import { captureFoodNutritionSourceBindingRawV2, retainedFoodSourceSnapshotDigestRawV2 } from '../utils/foodNutritionSourceBindingV2';

export const stagingRecipe27ReviewBatch = batch;

export async function prepareStagingRecipe27Nutrition(
  item: typeof batch[number],
  canonical: { canonicalFoodId: string; digest: string },
) {
  if (canonical.canonicalFoodId !== item.request.proposal.canonicalFoodId) throw Error('RECIPE_27_PRODUCT_MISMATCH');
  const sourceRaw = JSON.stringify(item.nutritionSource);
  const numericRaw = JSON.stringify(item.numericInput);
  const pins = {
    canonicalRevisionDigest: canonical.digest,
    numericInputDigest: await exactNutritionInputDigestV2(decodeExactNutritionInputRawV2(numericRaw)),
    retainedSnapshotDigest: await retainedFoodSourceSnapshotDigestRawV2(sourceRaw),
  };
  const proposal = await captureFoodNutritionSourceBindingRawV2(
    JSON.stringify(canonical), sourceRaw, numericRaw, JSON.stringify(pins),
  );
  return { proposal, pins };
}
