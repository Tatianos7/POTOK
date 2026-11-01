import {decodeTrustedValidationPoliciesRawV2} from '../utils/trustedValidationPoliciesV1';
import {decodeMealSnapshotV1} from '../utils/adaptiveNutritionMealCompositionV1';
import {decodePreparedMealWarningEvidenceRawV2,mealWarningEvidenceContractV1,
  mealWarningEvidenceEncodingV1} from '../utils/trustedMealWarningEvidenceV1';
import {assertRawJsonWithoutDuplicateKeysV1,adaptiveNutritionSha256HexV1,canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';
import type {GenerationPreparationWarningPortV1} from './generationDayOptionsV1';

export const generationWarningAssessmentPolicyContractV1='potok-generation-warning-assessment-policy-v1';
export const generationWarningAssessmentFactsContractV1='potok-generation-warning-assessment-facts-v1';
/** Independent server source. Never implement from proposed generator authority payloads. */
export interface GenerationWarningAssessmentSourcePortV1 {
  loadAssessmentInputsRaw(requestOperationId:string,slotId:string,mealSnapshotDigest:string,
    validationEvidenceDigest:string,validationPoliciesDigest:string):Promise<string|null>;
}
const metrics=['targetDeviationBasisPoints','preparationMinutes','distinctShoppingItems',
  'convenienceScoreBasisPoints','maximumRepeatUtilizationBasisPoints'] as const;
const signals=['softTargetFitDeviation','longPreparationBurden','shoppingListBurden',
  'lowerConvenienceScore','repetitionApproachingLimit'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
function parse(raw:string):unknown{
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_WARNING_ASSESSMENT_RAW');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))
    throw Error('INVALID_WARNING_ASSESSMENT_FIELDS');
  return value as Record<string,unknown>;
}
function identifier(value:unknown):string{
  if(typeof value!=='string'||!uuid.test(value))throw Error('INVALID_WARNING_ASSESSMENT_UUID');return value;
}
function digest(value:unknown):string{
  if(typeof value!=='string'||!hash.test(value))throw Error('INVALID_WARNING_ASSESSMENT_DIGEST');return value;
}
function integer(value:unknown,key:string):number{
  // Counts/durations and nonnegative basis points. Convenience is a normalized score.
  if(typeof value!=='number'||!Number.isSafeInteger(value)||Object.is(value,-0)||value<0
    ||(key==='convenienceScoreBasisPoints'&&value>10_000))throw Error('INVALID_WARNING_ASSESSMENT_METRIC');
  return value;
}

/** Inactive deterministic assessment of independently sourced, request/meal-bound metrics.
 * Neither facts nor pinned policy may come from the proposed plan. Hashes do not prove
 * source authority. No defaults, live reader, writer, review admission or activation here.
 * Whole-week metrics must describe the exact candidate context being assessed; this
 * preparation result never replaces the final independently sourced full-plan warning set.
 */
export async function assessGenerationMealWarningsRawV1(factsRaw:string,pinnedAssessmentPolicyRaw:string,
  policiesRaw:string,trustedContextRaw:string,mealSnapshotRaw:string){
  // Own both sources before awaiting validation so external objects cannot change mid-call.
  const policy=record(parse(pinnedAssessmentPolicyRaw),['contract','assessmentPolicyRevision','validationPolicyRevision','thresholds']);
  const facts=record(parse(factsRaw),['contract','requestOperationId','generationInputDigest','validationEvidenceDigest',
    'validationPoliciesDigest','slotId','mealSnapshotDigest','assessmentPolicyRevision','evidenceRevision','metrics']);
  const context=parse(trustedContextRaw) as {trustedGenerationInputRaw?:unknown};
  const metricValues=record(facts.metrics,metrics);
  const thresholds=record(policy.thresholds,metrics);
  if(policy.contract!==generationWarningAssessmentPolicyContractV1||facts.contract!==generationWarningAssessmentFactsContractV1)
    throw Error('INVALID_WARNING_ASSESSMENT_CONTRACT');
  const assessmentPolicyRevision=identifier(policy.assessmentPolicyRevision);
  const validationPolicyRevision=identifier(policy.validationPolicyRevision);
  if(identifier(facts.assessmentPolicyRevision)!==assessmentPolicyRevision)throw Error('WARNING_ASSESSMENT_POLICY_MISMATCH');
  const evidenceRevision=identifier(facts.evidenceRevision);
  const request=identifier(facts.requestOperationId);const slotId=identifier(facts.slotId);
  digest(facts.generationInputDigest);digest(facts.validationEvidenceDigest);digest(facts.validationPoliciesDigest);digest(facts.mealSnapshotDigest);
  const missing:typeof metrics[number][]=[];
  for(const key of metrics){
    integer(thresholds[key],key);
    if(metricValues[key]===null)missing.push(key);else integer(metricValues[key],key);
  }
  const policies=await decodeTrustedValidationPoliciesRawV2(policiesRaw,trustedContextRaw);
  const meal=await decodeMealSnapshotV1(parse(mealSnapshotRaw));
  // The policy decoder above independently validates the complete raw context and input.
  const input=JSON.parse(context.trustedGenerationInputRaw as string) as {operation:{requestId:string}};
  if(request!==input.operation.requestId||facts.generationInputDigest!==policies.generationInputDigest
    ||facts.validationEvidenceDigest!==policies.validationEvidenceDigest||facts.validationPoliciesDigest!==policies.digest
    ||facts.mealSnapshotDigest!==meal.digest||slotId!==meal.mealSlotId
    ||validationPolicyRevision!==policies.balance.policy.policyRevision)throw Error('WARNING_ASSESSMENT_BINDING_MISMATCH');
  // Lower convenience uses a strict lower bound; all burdens/deviations use strict upper bounds.
  const values=Object.fromEntries(signals.map((signal,index)=>[signal,index===3
    ?(metricValues[metrics[index]] as number)<(thresholds[metrics[index]] as number)
    :(metricValues[metrics[index]] as number)>(thresholds[metrics[index]] as number)]));
  const content={contract:mealWarningEvidenceContractV1,slotId,validationPolicyRevision,
    validationEvidenceDigest:policies.validationEvidenceDigest,mealSnapshotDigest:meal.digest,signals:values,evidenceRevision};
  const entry={...content,digest:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({
    contract:mealWarningEvidenceContractV1,encoding:mealWarningEvidenceEncodingV1,evidence:content})))};
  // Check actual slot/goal/composition bindings even when a metric is missing. A blocked
  // result exposes no provisional entry or false flags computed from null values.
  await decodePreparedMealWarningEvidenceRawV2(JSON.stringify(entry),policiesRaw,trustedContextRaw,mealSnapshotRaw);
  if(missing.length)return Object.freeze({status:'BLOCKED_MISSING_ASSESSMENT_FACTS' as const,missing:Object.freeze(missing)});
  return Object.freeze({status:'ASSESSED' as const,warningRaw:canonicalJsonV1(entry),assessmentPolicyRevision,
    factsRawSha256:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(factsRaw)),
    assessmentPolicyRawSha256:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(pinnedAssessmentPolicyRaw))});
}

/** Drop-in computation port for the existing inactive day preparer. Source reads are fresh;
 * missing metrics return unavailable, while malformed or substituted sources abort.
 */
export function createAssessedGenerationWarningPortV1(source:GenerationWarningAssessmentSourcePortV1):GenerationPreparationWarningPortV1{
  return Object.freeze({async loadMealWarningRaw(requestOperationId:string,slotId:string,mealSnapshotDigest:string,
    validationEvidenceDigest:string,validationPoliciesDigest:string){
    identifier(requestOperationId);identifier(slotId);digest(mealSnapshotDigest);digest(validationEvidenceDigest);digest(validationPoliciesDigest);
    const raw=await source.loadAssessmentInputsRaw(requestOperationId,slotId,mealSnapshotDigest,validationEvidenceDigest,validationPoliciesDigest);
    if(raw===null)return null;
    const bundle=record(parse(raw),['factsRaw','assessmentPolicyRaw','policiesRaw','trustedContextRaw','mealSnapshotRaw']);
    if(Object.values(bundle).some(v=>typeof v!=='string'))throw Error('WARNING_ASSESSMENT_RAW_STRINGS_REQUIRED');
    const facts=parse(bundle.factsRaw as string) as Record<string,unknown>;
    if(!facts||facts.requestOperationId!==requestOperationId||facts.slotId!==slotId||facts.mealSnapshotDigest!==mealSnapshotDigest
      ||facts.validationEvidenceDigest!==validationEvidenceDigest||facts.validationPoliciesDigest!==validationPoliciesDigest)
      throw Error('WARNING_ASSESSMENT_LOOKUP_MISMATCH');
    const result=await assessGenerationMealWarningsRawV1(bundle.factsRaw as string,bundle.assessmentPolicyRaw as string,
      bundle.policiesRaw as string,bundle.trustedContextRaw as string,bundle.mealSnapshotRaw as string);
    return result.status==='ASSESSED'?result.warningRaw:null;
  }});
}
