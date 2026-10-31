import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {generationPreparationMetadataContractV1,type GenerationPreparationMetadataPortV1} from './generationPreparationSourceV1';
import type {GenerationPreparationWarningPortV1} from './generationDayOptionsV1';
import {mealWarningEvidenceContractV1} from '../utils/trustedMealWarningEvidenceV1';
import {assertRawJsonWithoutDuplicateKeysV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';

export const generationProducerSourceContractV1='potok-generation-producer-source-v1';
export const generationMetadataSourceReadSqlV1="SELECT potok_nutrition.read_admitted_generation_producer_source_v1($1::uuid,'METADATA',pg_catalog.decode($2::text,'hex'),NULL,NULL,NULL,NULL) AS source_raw";
export const generationMealWarningSourceReadSqlV1="SELECT potok_nutrition.read_admitted_generation_producer_source_v1($1::uuid,'MEAL_WARNING',NULL,$2::uuid,pg_catalog.decode($3::text,'hex'),pg_catalog.decode($4::text,'hex'),pg_catalog.decode($5::text,'hex')) AS source_raw";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha=/^[0-9a-f]{64}$/;
const keys=['contract','requestOperationId','sourceKind','generationInputDigest','validationEvidenceDigest','validationPoliciesDigest','slotId','mealSnapshotDigest','payloadRaw','storageSha256','sourceRef'];
function parse(raw:string):Record<string,unknown>{
  if(typeof raw!=='string'||raw.length>8_000_000)throw new Error('INVALID_GENERATION_PRODUCER_SOURCE');
  assertRawJsonWithoutDuplicateKeysV1(raw);const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new Error('INVALID_GENERATION_PRODUCER_SOURCE');
  return value as Record<string,unknown>;
}
function valid(value:unknown,pattern:RegExp):value is string{return typeof value==='string'&&pattern.test(value);}
/** Read only already admitted storage snapshots. Digests are integrity, never self-issued approval.
 * Full metadata/meal DTO validation remains at the existing preparation consumer boundary. */
export function createAdmittedGenerationProducerPortsV1(sql:GenerationValidationSourceSqlClientV1):Readonly<{
  metadata:GenerationPreparationMetadataPortV1;warnings:GenerationPreparationWarningPortV1;
}>{
  async function read(statement:string,parameters:readonly string[],kind:'METADATA'|'MEAL_WARNING'):Promise<string|null>{
    const result=await sql.query(statement,parameters);
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1||!result.rows[0]||Object.keys(result.rows[0]).length!==1
      ||!Object.prototype.hasOwnProperty.call(result.rows[0],'source_raw')
      ||(result.rows[0].source_raw!==null&&typeof result.rows[0].source_raw!=='string'))throw new Error('INVALID_GENERATION_PRODUCER_SQL_RESULT');
    const raw=result.rows[0].source_raw;if(raw===null)return null;
    const row=parse(raw);
    if(Object.keys(row).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(row,k))
      ||row.contract!==generationProducerSourceContractV1||row.sourceKind!==kind||row.requestOperationId!==parameters[0]
      ||!valid(row.generationInputDigest,sha)||!valid(row.validationEvidenceDigest,sha)||!valid(row.validationPoliciesDigest,sha)
      ||!valid(row.storageSha256,sha)||typeof row.sourceRef!=='string'||!row.sourceRef.trim()
      ||typeof row.payloadRaw!=='string')throw new Error('INVALID_GENERATION_PRODUCER_SOURCE');
    if(kind==='METADATA'){
      if(row.generationInputDigest!==parameters[1]||row.slotId!==null||row.mealSnapshotDigest!==null)throw new Error('GENERATION_PRODUCER_BINDING_MISMATCH');
    }else if(row.slotId!==parameters[1]||row.mealSnapshotDigest!==parameters[2]||row.validationEvidenceDigest!==parameters[3]
      ||row.validationPoliciesDigest!==parameters[4])throw new Error('GENERATION_PRODUCER_BINDING_MISMATCH');
    const payload=row.payloadRaw,bytes=new TextEncoder().encode(payload);
    if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==payload||await adaptiveNutritionSha256HexV1(bytes)!==row.storageSha256)throw new Error('GENERATION_PRODUCER_STORAGE_DIGEST_MISMATCH');
    const value=parse(payload);
    if(kind==='METADATA'){
      if(value.contract!==generationPreparationMetadataContractV1||value.requestOperationId!==parameters[0]
        ||value.generationInputDigest!==parameters[1])throw new Error('GENERATION_PRODUCER_PAYLOAD_MISMATCH');
    }else if(value.contract!==mealWarningEvidenceContractV1||value.slotId!==parameters[1]||value.mealSnapshotDigest!==parameters[2]
      ||value.validationEvidenceDigest!==parameters[3])throw new Error('GENERATION_PRODUCER_PAYLOAD_MISMATCH');
    return payload; // Preserve stored raw bytes and explicit true/false signals; no sealing or default values.
  }
  const metadata:GenerationPreparationMetadataPortV1={async loadMetadataRaw(request,input){
    if(!valid(request,uuid)||!valid(input,sha))throw new Error('INVALID_GENERATION_PRODUCER_LOOKUP');
    return read(generationMetadataSourceReadSqlV1,[request,input],'METADATA');
  }};
  const warnings:GenerationPreparationWarningPortV1={async loadMealWarningRaw(request,slot,meal,evidence,policies){
    if(!valid(request,uuid)||!valid(slot,uuid)||![meal,evidence,policies].every(v=>valid(v,sha)))throw new Error('INVALID_GENERATION_PRODUCER_LOOKUP');
    return read(generationMealWarningSourceReadSqlV1,[request,slot,meal,evidence,policies],'MEAL_WARNING');
  }};
  return Object.freeze({metadata:Object.freeze(metadata),warnings:Object.freeze(warnings)});
}
