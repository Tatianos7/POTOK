import {createAdmittedGenerationWorkerV1,type AdmittedGenerationWorkerDependenciesV1} from './generationAdmittedWorkerV1';
import {createAdmittedGenerationPreparationSourceV1,type GenerationPreparationMetadataPortV1} from './generationPreparationSourceV1';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {GenerationEdgeErrorV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';

export interface SqlPreparedGenerationWorkerDependenciesV1 extends Omit<AdmittedGenerationWorkerDependenciesV1,'source'> {
  readonly preparationSql:GenerationValidationSourceSqlClientV1;
  readonly metadata:GenerationPreparationMetadataPortV1;
}
/** Backend-only inactive assembly: request-only SQL preparation, then separate proposal-bound SQL validation.
 * Caller still supplies actual metadata, per-meal warnings and producer decisions; no runtime connection or publisher. */
export function createSqlPreparedGenerationWorkerV1(dependencies:SqlPreparedGenerationWorkerDependenciesV1){
  const {preparationSql,metadata,warnings,decisions,authoritySql,gateway,limitsRaw}=dependencies;
  const enabled=dependencies.enabled??(()=>false);
  const source=createAdmittedGenerationPreparationSourceV1({async query(statement,parameters){
    if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);
    const result=await preparationSql.query(statement,parameters);
    if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);
    return result;
  }},metadata);
  return createAdmittedGenerationWorkerV1({source,warnings,decisions,authoritySql,gateway,limitsRaw,enabled});
}
