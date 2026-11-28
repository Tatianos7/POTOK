import {decodeGenerationPreparationContextRawV1} from './generationValidationAuthorityLoaderV1';
import {generationMenuCandidateSourceContractV1,type GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {assertRawJsonWithoutDuplicateKeysV1,adaptiveNutritionSha256HexV1,canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';

export const generationGoalPreparationReadSqlV1='SELECT potok_nutrition.read_admitted_generation_goal_preparation_source_v1($1::uuid) AS source_raw';
export const generationGoalPreparationSourceContractV1='potok-generation-goal-preparation-source-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Exact persisted labels from GoalResult and explicit canonical profiles only.
// Unknown/empty/legacy free text is never interpreted as maintenance.
const profiles=new Map([
  ['Похудение','WEIGHT_LOSS'],['weight-loss','WEIGHT_LOSS'],['WEIGHT_LOSS','WEIGHT_LOSS'],
  ['Поддержка формы','MAINTENANCE'],['maintain','MAINTENANCE'],['MAINTENANCE','MAINTENANCE'],
  ['Набор массы','MASS_GAIN'],['gain','MASS_GAIN'],['MASS_GAIN','MASS_GAIN'],['CUT','CUT'],
]);
/** Deterministic output identity, not reviewer, nutrition or approval evidence.
 * UUIDv8 domain includes exact request/input/slot. No random allocation or DB write;
 * retrying the same immutable request creates the same meal snapshot revisions.
 */
async function snapshotRevision(requestOperationId:string,generationInputDigest:string,slotId:string):Promise<string>{
  const digest=await adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({
    contract:'potok-generation-meal-snapshot-revision-v1',requestOperationId,generationInputDigest,slotId})));
  const hex=digest.slice(0,12)+'8'+digest.slice(13,16)+((parseInt(digest[16],16)&3)|8).toString(16)+digest.slice(17,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
/** Inactive preparation source from a single admitted SQL reader. The SQL function
 * binds current user_goals to the admitted request context under its account gate.
 * No supplied metadata/profile/slot IDs, cached authority or stored warning defaults.
 */
export function createGoalDerivedGenerationPreparationSourceV1(sql:GenerationValidationSourceSqlClientV1):GenerationMenuCandidateSourcePortV1{
  return Object.freeze({async loadPreparationRaw(requestOperationId:string):Promise<string|null>{
    if(typeof requestOperationId!=='string'||!uuid.test(requestOperationId))throw Error('INVALID_GOAL_PREPARATION_REQUEST');
    const result=await sql.query(generationGoalPreparationReadSqlV1,[requestOperationId]);
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1||!result.rows[0]
      ||Object.keys(result.rows[0]).length!==1||!Object.prototype.hasOwnProperty.call(result.rows[0],'source_raw'))
      throw Error('INVALID_GOAL_PREPARATION_SQL_RESULT');
    const raw=result.rows[0].source_raw;if(raw===null)return null;
    if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_GOAL_PREPARATION_RAW');
    assertRawJsonWithoutDuplicateKeysV1(raw);
    const row=JSON.parse(raw) as Record<string,unknown>;
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==3
      ||!['contract','contextRaw','goalType'].every(k=>Object.prototype.hasOwnProperty.call(row,k))
      ||row.contract!==generationGoalPreparationSourceContractV1||typeof row.contextRaw!=='string'
      ||(row.goalType!==null&&typeof row.goalType!=='string'))throw Error('INVALID_GOAL_PREPARATION_FIELDS');
    const context=await decodeGenerationPreparationContextRawV1(row.contextRaw,requestOperationId);
    if(context===null)return null;
    const goalProfile=typeof row.goalType==='string'?profiles.get(row.goalType):undefined;
    if(!goalProfile)return null;
    const slotRevisions=[];
    for(const slotId of context.requiredSlotIds)slotRevisions.push({slotId,
      mealSnapshotRevision:await snapshotRevision(requestOperationId,context.generationInputDigest,slotId)});
    return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId,
      contextRaw:context.trustedContextRaw,policiesRaw:context.policiesRaw,goalProfile,slotRevisions});
  }});
}
