import {GenerationEdgeErrorV2,type GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {createGoalDerivedGenerationPreparationSourceV1} from './generationGoalPreparationSourceV1';
import {createAdmittedGenerationProducerPortsV1} from './generationProducerSourcesV1';
import {createSqlGenerationWeekMetricProducerV1,type GenerationWeekConveniencePortV1} from './generationWeekMetricProducerV1';
import {createWeightedAdmittedGenerationWorkerV1,type WeightedAdmittedGenerationWorkerDependenciesV1} from './generationWeightedAdmittedWorkerV1';

export interface SqlWeightedGenerationWorkerDependenciesV1 {
  readonly sourcesSql:GenerationValidationSourceSqlClientV1;
  readonly gateway:GenerationRpcClientV2;
  readonly optimizationPolicyRaw:string;
  readonly metricPolicyRaw:string;
  readonly comparison:WeightedAdmittedGenerationWorkerDependenciesV1['comparison'];
  readonly convenience:GenerationWeekConveniencePortV1|null;
  readonly enabled?:()=>boolean;
  readonly limitsRaw?:string;
}
/** Inactive composition of existing admitted SQL readers and actual producers.
 * The caller supplies an already admitted SQL session, gateway and independently
 * pinned policy bodies. This factory opens no connection and grants no authority.
 */
export function createSqlWeightedGenerationWorkerV1(dependencies:SqlWeightedGenerationWorkerDependenciesV1){
  const {sourcesSql,gateway,optimizationPolicyRaw,metricPolicyRaw,comparison,convenience,limitsRaw}=dependencies;
  if(convenience!==null&&(!convenience||typeof convenience.loadConvenienceRaw!=='function'))throw Error('INVALID_WEEK_CONVENIENCE_SOURCE');
  const enabled=dependencies.enabled??(()=>false);
  const assertEnabled=()=>{if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);};
  const sql:GenerationValidationSourceSqlClientV1={async query(statement,parameters){
    assertEnabled();const result=await sourcesSql.query(statement,parameters);assertEnabled();return result;
  }};
  const guardedConvenience:GenerationWeekConveniencePortV1|null=convenience===null?null:{async loadConvenienceRaw(...args){
    assertEnabled();const result=await convenience.loadConvenienceRaw(...args);assertEnabled();return result;
  }};
  const source=createGoalDerivedGenerationPreparationSourceV1(sql);
  const {warnings}=createAdmittedGenerationProducerPortsV1(sql);
  const metrics=createSqlGenerationWeekMetricProducerV1(sql,metricPolicyRaw,guardedConvenience);
  return createWeightedAdmittedGenerationWorkerV1({source,warnings,optimization:{policyRaw:optimizationPolicyRaw,metrics},
    comparison,authoritySql:sql,gateway,enabled,limitsRaw});
}
