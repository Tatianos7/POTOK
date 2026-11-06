/** Exact input-ingredient arithmetic only; never recipe approval or cooked-yield evidence. */
import { canonicalJsonV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';
import { parseFoodNutritionSourceBindingJsonRawV2 as parse } from './foodNutritionSourceBindingV2';
import {
  decodeExactScalarV2, decodeExactNutritionInputV2, exactNutritionInputDigestV2,
  createExactNutritionValuesV2, scaleExactNutritionValuesV2, sumExactNutritionValuesV2, addExactScalarsV2,
  type ExactScalarV2, type ExactNutritionInputV2, type ExactNutritionValuesV2,
} from './exactNutritionValuesV2';
export const exactRecipeNutritionRequestContractV2 = 'potok-exact-recipe-nutrition-request-v2' as const;
export const exactRecipeNutritionSnapshotContractV2 = 'potok-exact-recipe-input-nutrition-snapshot-v2' as const;
export const exactRecipeNutritionEncodingV2 = 'potok-exact-recipe-input-nutrition-json-v2' as const;
export interface ExactRecipeFoodRowV2 {
  readonly rowId: string; readonly inputKind: 'FOOD'; readonly foodId: string;
  readonly foodState: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
  readonly basis: 'PER_100_G_FOOD' | 'PER_100_G_EDIBLE'; readonly weightG: ExactScalarV2;
  readonly nutritionRevisionId: string; readonly nutritionDigest: string;
  readonly sourceProposalDigest: string; readonly numericInputDigest: string;
}
export interface ExactRecipeNonfoodRowV2 {
  readonly rowId: string; readonly inputKind: 'POTABLE_WATER' | 'SALT';
  readonly amount: ExactScalarV2; readonly unit: 'g' | 'ml';
}
export interface ExactRecipeNutritionRequestV2 {
  readonly contract: typeof exactRecipeNutritionRequestContractV2; readonly encoding: typeof exactRecipeNutritionEncodingV2;
  readonly authoringRecipeId: string; readonly authoringRevision: string;
  readonly declaredServings: ExactScalarV2 | null;
  readonly components: readonly (ExactRecipeFoodRowV2 | ExactRecipeNonfoodRowV2)[];
}
export interface ExactRecipeNutritionSnapshotV2 {
  readonly contract: typeof exactRecipeNutritionSnapshotContractV2; readonly encoding: typeof exactRecipeNutritionEncodingV2;
  readonly authority: 'NONE'; readonly calculationBasis: 'INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM';
  readonly request: ExactRecipeNutritionRequestV2; readonly requestDigest: string;
  readonly components: readonly { readonly rowId: string; readonly input: ExactNutritionInputV2; readonly contribution: ExactNutritionValuesV2 }[];
  readonly inputMassGrams: ExactScalarV2; readonly cookedYieldGrams: null;
  readonly whole: ExactNutritionValuesV2; readonly perDeclaredServing: ExactNutritionValuesV2 | null;
  readonly digest: string;
}
function fail(reason: string): never { throw Error(`EXACT_RECIPE_NUTRITION_V2_${reason}`); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k))) fail('FIELDS');
  return value as Record<string, unknown>;
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) fail('TOKEN'); return value;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) fail('UUID'); return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('DIGEST'); return value;
}
function positive(value: unknown): ExactScalarV2 {
  const result = decodeExactScalarV2(value); if (result.numerator === '0') fail('POSITIVE_QUANTITY'); return result;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > 128) fail('COMPONENT_BUDGET'); return value;
}
async function digest(domain: string, payload: unknown): Promise<string> {
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain, payload })));
}
function request(value: unknown): ExactRecipeNutritionRequestV2 {
  const r = fields(value, ['contract', 'encoding', 'authoringRecipeId', 'authoringRevision', 'declaredServings', 'components']);
  if (r.contract !== exactRecipeNutritionRequestContractV2 || r.encoding !== exactRecipeNutritionEncodingV2) fail('REQUEST_CONTRACT');
  const rows = list(r.components).map((value): ExactRecipeFoodRowV2 | ExactRecipeNonfoodRowV2 => {
    const kind = (value as Record<string, unknown> | null)?.inputKind;
    if (kind === 'POTABLE_WATER' || kind === 'SALT') {
      const row = fields(value, ['rowId', 'inputKind', 'amount', 'unit']);
      if ((kind === 'SALT' && row.unit !== 'g') || (row.unit !== 'g' && row.unit !== 'ml')) fail('NONFOOD_UNIT');
      return Object.freeze({ rowId: token(row.rowId), inputKind: kind, amount: positive(row.amount), unit: row.unit });
    }
    const row = fields(value, ['rowId', 'inputKind', 'foodId', 'foodState', 'basis', 'weightG', 'nutritionRevisionId', 'nutritionDigest', 'sourceProposalDigest', 'numericInputDigest']);
    if (kind !== 'FOOD') fail('COMPONENT_KIND');
    if (typeof row.foodState !== 'string' || !['raw', 'dry', 'frozen', 'cooked', 'as-sold'].includes(row.foodState)) fail('FOOD_STATE');
    if (row.basis !== 'PER_100_G_FOOD' && row.basis !== 'PER_100_G_EDIBLE') fail('BASIS');
    return Object.freeze({ rowId: token(row.rowId), inputKind: 'FOOD', foodId: uuid(row.foodId), foodState: row.foodState as ExactRecipeFoodRowV2['foodState'],
      basis: row.basis, weightG: positive(row.weightG), nutritionRevisionId: uuid(row.nutritionRevisionId), nutritionDigest: hash(row.nutritionDigest),
      sourceProposalDigest: hash(row.sourceProposalDigest), numericInputDigest: hash(row.numericInputDigest) });
  });
  if (new Set(rows.map(r => r.rowId)).size !== rows.length) fail('DUPLICATE_ROW');
  return Object.freeze({ contract: exactRecipeNutritionRequestContractV2, encoding: exactRecipeNutritionEncodingV2,
    authoringRecipeId: token(r.authoringRecipeId), authoringRevision: token(r.authoringRevision),
    declaredServings: r.declaredServings === null ? null : positive(r.declaredServings), components: Object.freeze(rows) });
}
export const decodeExactRecipeNutritionRequestRawV2 = (raw: string) => request(parse(raw));
export async function exactRecipeNutritionRequestDigestRawV2(raw: string): Promise<string> {
  return digest('potok-exact-recipe-nutrition-request-sha256-v2', decodeExactRecipeNutritionRequestRawV2(raw));
}
/** The independent request digest binds every row, food/state/basis, amount and declared servings.
 * Numeric inputs alone are not authenticated evidence; use the server boundary before preparation. */
export async function calculateExactRecipeNutritionRawV2(requestRaw: string, inputsRaw: string, expectedRequestDigest: string): Promise<ExactRecipeNutritionSnapshotV2> {
  const r = decodeExactRecipeNutritionRequestRawV2(requestRaw), requestDigest = await digest('potok-exact-recipe-nutrition-request-sha256-v2', r);
  if (requestDigest !== hash(expectedRequestDigest)) fail('REQUEST_PIN_MISMATCH');
  if (r.components.some(row => row.inputKind !== 'FOOD')) fail('NONFOOD_EVIDENCE_NOT_INTEGRATED');
  const inputRows = list(parse(inputsRaw)).map(value => {
    const row = fields(value, ['rowId', 'input']); return { rowId: token(row.rowId), input: decodeExactNutritionInputV2(row.input) };
  });
  if (inputRows.length !== r.components.length || new Set(inputRows.map(row => row.rowId)).size !== inputRows.length) fail('INPUT_COVERAGE');
  const components = [];
  let inputMassGrams: ExactScalarV2 = { numerator: '0', denominator: '1' };
  for (const row of r.components) {
    if (row.inputKind !== 'FOOD') fail('NONFOOD_EVIDENCE_NOT_INTEGRATED');
    const input = inputRows.find(input => input.rowId === row.rowId)?.input;
    if (!input || await exactNutritionInputDigestV2(input) !== row.numericInputDigest) fail('INPUT_BINDING');
    if (input.reference.basis !== row.basis) fail('BASIS_MISMATCH');
    const contribution = scaleExactNutritionValuesV2(createExactNutritionValuesV2(input.values), row.weightG, { numerator: '100', denominator: '1' });
    inputMassGrams = addExactScalarsV2(inputMassGrams, row.weightG);
    components.push(Object.freeze({ rowId: row.rowId, input, contribution }));
  }
  const whole = sumExactNutritionValuesV2(components.map(c => c.contribution));
  const perDeclaredServing = r.declaredServings === null ? null : scaleExactNutritionValuesV2(whole, { numerator: '1', denominator: '1' }, r.declaredServings);
  const payload = { contract: exactRecipeNutritionSnapshotContractV2, encoding: exactRecipeNutritionEncodingV2, authority: 'NONE' as const,
    calculationBasis: 'INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM' as const, request: r, requestDigest,
    components: Object.freeze(components), inputMassGrams, cookedYieldGrams: null, whole, perDeclaredServing };
  return Object.freeze({ ...payload, digest: await digest('potok-exact-recipe-input-nutrition-snapshot-sha256-v2', payload) });
}
/** Recompute every contribution/total and verify the independent request pin, not just a self hash. */
export async function decodeExactRecipeNutritionSnapshotRawV2(raw: string, expectedRequestDigest: string): Promise<ExactRecipeNutritionSnapshotV2> {
  const row = fields(parse(raw), ['contract', 'encoding', 'authority', 'calculationBasis', 'request', 'requestDigest', 'components', 'inputMassGrams', 'cookedYieldGrams', 'whole', 'perDeclaredServing', 'digest']);
  const inputs = list(row.components).map(value => { const r = fields(value, ['rowId', 'input', 'contribution']); return { rowId: r.rowId, input: r.input }; });
  const result = await calculateExactRecipeNutritionRawV2(JSON.stringify(row.request), JSON.stringify(inputs), expectedRequestDigest);
  if (canonicalJsonV1(row) !== canonicalJsonV1(result)) fail('SNAPSHOT_RECOMPUTATION_MISMATCH');
  return result;
}
