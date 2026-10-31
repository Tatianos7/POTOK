import {GenerationEdgeErrorV2,type GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import type {GenerationDecisionTracePortV1} from './generationPlanProposalV1';
import {createAdmittedGenerationProducerPortsV1} from './generationProducerSourcesV1';
import {createSqlPreparedGenerationWorkerV1} from './generationSqlPreparedWorkerV1';

/** Inactive backend assembly, with admitted SQL context/metadata/warnings/final authority.
 * The actual decision producer remains explicit. No connection, publisher, role switch or route is created. */
export function createStoredProducerGenerationWorkerV1(dependencies:{
  readonly sourcesSql:GenerationValidationSourceSqlClientV1;readonly decisions:GenerationDecisionTracePortV1;
  readonly gateway:GenerationRpcClientV2;readonly enabled?:()=>boolean;readonly limitsRaw?:string;
}){
  const {sourcesSql,decisions,gateway,limitsRaw}=dependencies,enabled=dependencies.enabled??(()=>false);
  const guarded:GenerationValidationSourceSqlClientV1={async query(statement,parameters){
    if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);
    const result=await sourcesSql.query(statement,parameters);
    if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);
    return result;
  }};
  const ports=createAdmittedGenerationProducerPortsV1(guarded);
  return createSqlPreparedGenerationWorkerV1({preparationSql:guarded,authoritySql:guarded,metadata:ports.metadata,
    warnings:ports.warnings,decisions,gateway,limitsRaw,enabled});
}
