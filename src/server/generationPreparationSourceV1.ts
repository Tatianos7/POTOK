import {decodeGenerationPreparationContextRawV1} from './generationValidationAuthorityLoaderV1';
import {generationMenuCandidateSourceContractV1,type GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {assertRawJsonWithoutDuplicateKeysV1} from '../utils/adaptiveNutritionWireV1';

export const generationPreparationReadSqlV1='SELECT potok_nutrition.read_admitted_generation_preparation_source_v1($1::uuid) AS source_raw';
export const generationPreparationMetadataContractV1='potok-generation-preparation-metadata-v1';
/** Producer-owned output revision allocation and goal-profile metadata, not recipe/reviewer authority.
 * Absence blocks preparation. No IDs, profile, warnings or approval are invented by this loader. */
export interface GenerationPreparationMetadataPortV1 {
  loadMetadataRaw(requestOperationId:string,generationInputDigest:string):Promise<string|null>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))throw new Error('INVALID_PREPARATION_METADATA');
  return value as Record<string,unknown>;
}
export function createAdmittedGenerationPreparationSourceV1(sql:GenerationValidationSourceSqlClientV1,
  metadata:GenerationPreparationMetadataPortV1):GenerationMenuCandidateSourcePortV1 {
  return Object.freeze({async loadPreparationRaw(requestOperationId:string):Promise<string|null>{
    const request=requestOperationId;
    if(typeof request!=='string'||!uuid.test(request))throw new Error('INVALID_PREPARATION_REQUEST');
    const result=await sql.query(generationPreparationReadSqlV1,[request]);
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1||!result.rows[0]
      ||Object.keys(result.rows[0]).length!==1||!Object.prototype.hasOwnProperty.call(result.rows[0],'source_raw')
      ||(result.rows[0].source_raw!==null&&typeof result.rows[0].source_raw!=='string'))throw new Error('INVALID_PREPARATION_SQL_RESULT');
    const raw=result.rows[0].source_raw;if(raw===null)return null;
    if(raw.length>8_000_000)throw new Error('PREPARATION_SOURCE_TOO_LARGE');
    const context=await decodeGenerationPreparationContextRawV1(raw,request);if(context===null)return null;
    const metadataRaw=await metadata.loadMetadataRaw(request,context.generationInputDigest);if(metadataRaw===null)return null;
    if(typeof metadataRaw!=='string'||metadataRaw.length>8_000_000)throw new Error('INVALID_PREPARATION_METADATA');
    assertRawJsonWithoutDuplicateKeysV1(metadataRaw);
    const row=record(JSON.parse(metadataRaw),['contract','requestOperationId','generationInputDigest','goalProfile','slotRevisions']);
    if(row.contract!==generationPreparationMetadataContractV1||row.requestOperationId!==request
      ||row.generationInputDigest!==context.generationInputDigest)throw new Error('PREPARATION_METADATA_BINDING_MISMATCH');
    if(!['WEIGHT_LOSS','CUT','MAINTENANCE','MASS_GAIN'].includes(row.goalProfile as string)||!Array.isArray(row.slotRevisions))throw new Error('INVALID_PREPARATION_METADATA');
    const seen=new Set<string>();
    const slots=row.slotRevisions.map(value=>{
      const slot=record(value,['slotId','mealSnapshotRevision']);
      if(typeof slot.slotId!=='string'||!uuid.test(slot.slotId)||typeof slot.mealSnapshotRevision!=='string'
        ||!uuid.test(slot.mealSnapshotRevision)||seen.has(slot.slotId))throw new Error('INVALID_PREPARATION_SLOT_REVISIONS');
      seen.add(slot.slotId);return {slotId:slot.slotId,mealSnapshotRevision:slot.mealSnapshotRevision};
    });
    if(slots.length!==context.requiredSlotIds.length||context.requiredSlotIds.some(slot=>!seen.has(slot)))throw new Error('PREPARATION_SLOT_COVERAGE_MISMATCH');
    return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,
      contextRaw:context.trustedContextRaw,policiesRaw:context.policiesRaw,goalProfile:row.goalProfile,slotRevisions:slots});
  }});
}
