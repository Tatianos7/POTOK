// Synthetic SQL/Auth/source data only; shared by tests and the offline profiler.
import assert from 'node:assert/strict';
import {createSqlWeightedGenerationWorkerV1,type SqlWeightedGenerationWorkerDependenciesV1} from '../generationSqlWeightedWorkerV1';
import {generationGoalPreparationReadSqlV1,generationGoalPreparationSourceContractV1} from '../generationGoalPreparationSourceV1';
import {generationPreparationReadSqlV1} from '../generationPreparationSourceV1';
import {generationMealWarningSourceReadSqlV1,generationProducerSourceContractV1} from '../generationProducerSourcesV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {generationWeekMetricPolicyContractV1,generationWeekConvenienceContractV1} from '../generationWeekMetricProducerV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
import {generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,resignEntry,resignSet,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
export async function generationSqlWeightedWorkerFixtureV1(known=false,slotsPerDay=1){
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;},slotsPerDay);
  const input=f.context.input,request=input.operation.requestId,contextRaw=await generationPreparationContextFixtureV1(f);
  const preparedWarnings=new Map<string,ReturnType<typeof resignEntry>>();
  const queryLog:{statement:string;parameters:readonly string[]}[]=[],rpcLog:string[]=[];
  const state={enabled:true,status:'GENERATING',goal:'Поддержка формы',mode:'',closeAt:'',records:0,activations:0,
    finalReads:0,stored:null as string|null};
  const deps:SqlWeightedGenerationWorkerDependenciesV1={comparison:'ROBUST_CONVENIENCE_BOUNDS',enabled:()=>state.enabled,
    optimizationPolicyRaw:JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:input.optimizationPolicyRevision,
      weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}}),
    metricPolicyRaw:JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),optimizationPolicyRevision:input.optimizationPolicyRevision,
      targetFit:'MEAN_DAILY_CALORIE_FIT_V1',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'}),
    convenience:known?{async loadConvenienceRaw(r,sha,digest,revision){
      if(state.closeAt==='convenience')state.enabled=false;
      return JSON.stringify({contract:generationWeekConvenienceContractV1,requestOperationId:r,weekRawSha256:sha,generationInputDigest:digest,
        metricPolicyRevision:revision,sourceRevision:id(992),score:'0.750'});
    }}:null,
    sourcesSql:{async query(statement,parameters){
      queryLog.push({statement,parameters:[...parameters]});assert.equal(parameters[0],request);
      if(state.mode==='identity')throw Error('GENERATION_READER_IDENTITY_REQUIRED');
      let raw:string|null;
      if(statement===generationGoalPreparationReadSqlV1){
        assert.equal(parameters.length,1);raw=state.mode==='missingGoal'?null:JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw,goalType:state.goal});
        if(state.closeAt==='goal')state.enabled=false;
      }else if(statement===generationMealWarningSourceReadSqlV1){
        assert.equal(parameters.length,5);assert.equal(parameters[3],f.evidence.digest);assert.equal(parameters[4],f.policies.digest);
        const entry=resignEntry({...f.set.entries[0],slotId:parameters[1],mealSnapshotDigest:parameters[2]});
        preparedWarnings.set(parameters[1],entry);const payloadRaw=JSON.stringify(entry);
        raw=state.mode==='missingWarning'?null:JSON.stringify({contract:generationProducerSourceContractV1,requestOperationId:request,sourceKind:'MEAL_WARNING',
          generationInputDigest:f.evidence.generationInputDigest,validationEvidenceDigest:parameters[3],validationPoliciesDigest:parameters[4],
          slotId:parameters[1],mealSnapshotDigest:parameters[2],payloadRaw,storageSha256:state.mode==='corruptWarning'?'a'.repeat(64):fixtureHashV1(payloadRaw),sourceRef:'synthetic-only:warning'});
      }else if(statement===generationPreparationReadSqlV1){
        assert.equal(parameters.length,1);raw=state.mode==='missingMetrics'?null:contextRaw;if(state.closeAt==='metrics')state.enabled=false;
      }else{
        assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);assert.equal(parameters.length,2);state.finalReads++;
        if(state.mode==='revokeFinal'&&state.finalReads>1)raw=null;
        else{
          const stored=JSON.parse(await generationStoredAuthorityFixtureV1(f,parameters[1]));
          // Explicit synthetic upstream final-warning storage for the new output identities.
          // Production still requires independently admitted exact proposal-bound rows.
          if(state.mode!=='staleFinal')stored.warningEvidenceRaw=resignSet({...f.set,
            entries:f.set.entries.map(e=>preparedWarnings.get(e.slotId)!)});
          raw=JSON.stringify(stored);
        }
      }
      return {rows:[{source_raw:raw}]};
    }},
    gateway:{async rpc<T>(name:string,args:Record<string,unknown>){
      rpcLog.push(name);assert.equal(args.p_request_operation_id,request);
      if(name==='record_generated_week_gateway_v2'){
        assert.equal(state.finalReads,2);state.records++;state.stored=(args.p_generated_week_plan_canonical as string).slice(2);state.status='GENERATED';
      }else if(name==='activate_generated_week_gateway_v2'){state.activations++;assert.ok(state.stored);state.status='ACTIVE';}
      else assert.equal(name,'load_generation_request_v2');
      return {data:{contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:state.status,retryable:state.status!=='ACTIVE',reasonCode:null,
        ...(name==='load_generation_request_v2'?{generationInputCanonicalHex:Buffer.from(canonical(input)).toString('hex'),
          candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)).toString('hex'),attemptOperationId:id(88)}:{})} as T,error:null};
    }},
  };
  return {f,input,request,state,queryLog,rpcLog,deps,run:()=>createSqlWeightedGenerationWorkerV1(deps).continue(request)};
}
