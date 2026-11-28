import {continueGenerationV2,GenerationEdgeErrorV2,type GenerationRpcClientV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createOptimizedGenerationWorkerBindingsV1,createConvenienceBoundedGenerationWorkerBindingsV1} from './generationWorkerBindingsV1';
import {createAdmittedSqlGenerationValidationSourceStoreV1,type GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {createGenerationValidationAuthorityLoaderV1} from './generationValidationAuthorityLoaderV1';
import {createWeekDecisionProjectionPortV1} from './generationWeekDecisionProjectionV1';
import type {GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import type {GenerationPreparationWarningPortV1} from './generationDayOptionsV1';
import type {GenerationWeekOptimizationConfigV1} from './generationWeekOptimizationV1';

export interface WeightedAdmittedGenerationWorkerDependenciesV1 {
  readonly source:GenerationMenuCandidateSourcePortV1;
  readonly warnings:GenerationPreparationWarningPortV1;
  readonly optimization:GenerationWeekOptimizationConfigV1;
  readonly comparison:'STRICT'|'ROBUST_CONVENIENCE_BOUNDS';
  readonly authoritySql:GenerationValidationSourceSqlClientV1;
  readonly gateway:GenerationRpcClientV2;
  readonly enabled?:()=>boolean;
  readonly limitsRaw?:string;
}
/** Explicit backend assembly of weighted selection, real decision projection and the
 * existing validated record/activation protocol. Disabled by default. No connection,
 * role changes, source admission, route or publication is created by this factory.
 */
export function createWeightedAdmittedGenerationWorkerV1(dependencies:WeightedAdmittedGenerationWorkerDependenciesV1){
  const {source,warnings,authoritySql,gateway,comparison,limitsRaw}=dependencies;
  if(comparison!=='STRICT'&&comparison!=='ROBUST_CONVENIENCE_BOUNDS')throw Error('INVALID_GENERATION_COMPARISON');
  if(!dependencies.optimization||typeof dependencies.optimization.policyRaw!=='string'
    ||typeof dependencies.optimization.metrics?.assessWeekRaw!=='function')throw Error('INVALID_WEEK_OPTIMIZATION_CONFIG');
  // Own policy/configuration before any asynchronous operation; never switch modes on failure.
  const {policyRaw,metrics}=dependencies.optimization;
  const enabled=dependencies.enabled??(()=>false);
  const assertEnabled=()=>{if(enabled()!==true)throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED',503);};
  async function guarded<T>(run:()=>Promise<T>):Promise<T>{assertEnabled();const result=await run();assertEnabled();return result;}
  const authority=createGenerationValidationAuthorityLoaderV1(createAdmittedSqlGenerationValidationSourceStoreV1({
    query:(statement,parameters)=>guarded(()=>authoritySql.query(statement,parameters)),
  }));
  const guardedSource:GenerationMenuCandidateSourcePortV1={loadPreparationRaw:request=>guarded(()=>source.loadPreparationRaw(request))};
  const guardedWarnings:GenerationPreparationWarningPortV1={loadMealWarningRaw:(...args)=>guarded(()=>warnings.loadMealWarningRaw(...args))};
  const optimization:GenerationWeekOptimizationConfigV1={policyRaw,metrics:{assessWeekRaw:(request,weekRaw,inputDigest,rawPolicy)=>
    guarded(()=>metrics.assessWeekRaw(request,weekRaw,inputDigest,rawPolicy))}};
  const bind=comparison==='STRICT'?createOptimizedGenerationWorkerBindingsV1:createConvenienceBoundedGenerationWorkerBindingsV1;
  const bindings=bind(guardedSource,guardedWarnings,optimization,createWeekDecisionProjectionPortV1(),authority,limitsRaw);
  const guardedGateway:GenerationRpcClientV2={async rpc<T>(name:string,args:Record<string,unknown>){
    assertEnabled();
    if(!['load_generation_request_v2','record_generated_week_gateway_v2','activate_generated_week_gateway_v2'].includes(name))
      throw new GenerationEdgeErrorV2('INVALID_GENERATION_GATEWAY_OPERATION',502);
    return guarded(()=>gateway.rpc<T>(name,args));
  }};
  return Object.freeze({async continue(requestOperationId:string){
    assertEnabled();return continueGenerationV2({requestOperationId,gatewayClient:guardedGateway,...bindings});
  }});
}
