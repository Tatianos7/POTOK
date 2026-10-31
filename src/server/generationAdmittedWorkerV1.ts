import {continueGenerationV2,GenerationEdgeErrorV2,type GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createGenerationWorkerBindingsV1} from './generationWorkerBindingsV1';
import {createAdmittedSqlGenerationValidationSourceStoreV1,type GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {createGenerationValidationAuthorityLoaderV1} from './generationValidationAuthorityLoaderV1';
import type {GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import type {GenerationPreparationWarningPortV1} from './generationDayOptionsV1';
import type {GenerationDecisionTracePortV1} from './generationPlanProposalV1';

export interface AdmittedGenerationWorkerDependenciesV1 {
  readonly source:GenerationMenuCandidateSourcePortV1;
  readonly warnings:GenerationPreparationWarningPortV1;
  readonly decisions:GenerationDecisionTracePortV1;
  readonly authoritySql:GenerationValidationSourceSqlClientV1;
  readonly gateway:GenerationRpcClientV2;
  readonly enabled?:()=>boolean;
  readonly limitsRaw?:string;
}
/** Inactive backend assembly only. Caller must supply an already admitted SQL session;
 * this module opens no connection, changes no role and has no owner-context fallback.
 * Preparation/warning/decision producer ports remain explicit; this factory mints no authority.
 */
export function createAdmittedGenerationWorkerV1(dependencies:AdmittedGenerationWorkerDependenciesV1) {
  const {source,warnings,decisions,authoritySql,gateway,limitsRaw}=dependencies;
  const enabled=dependencies.enabled??(()=>false);
  const assertEnabled=():void=>{if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);};
  const authority=createGenerationValidationAuthorityLoaderV1(createAdmittedSqlGenerationValidationSourceStoreV1({
    async query(statement,parameters){assertEnabled();const result=await authoritySql.query(statement,parameters);assertEnabled();return result;}
  }));
  const bindings=createGenerationWorkerBindingsV1(source,warnings,decisions,authority,limitsRaw);
  const guarded:GenerationRpcClientV2={async rpc<T>(name:string,args:Record<string,unknown>){
    assertEnabled();
    if(!['load_generation_request_v2','record_generated_week_gateway_v2','activate_generated_week_gateway_v2'].includes(name))
      throw new GenerationEdgeErrorV2('INVALID_GENERATION_GATEWAY_OPERATION',502);
    const result=await gateway.rpc<T>(name,args);assertEnabled();return result;
  }};
  return Object.freeze({async continue(requestOperationId:string){
    assertEnabled();
    return continueGenerationV2({requestOperationId,gatewayClient:guarded,...bindings});
  }});
}
