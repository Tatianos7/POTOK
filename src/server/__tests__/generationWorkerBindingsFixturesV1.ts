import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {continueGenerationV2,type GenerationRpcClientV2} from '../../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createGenerationWorkerBindingsV1} from '../generationWorkerBindingsV1';
import {createGenerationDayOptionsV1} from '../generationDayOptionsV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationDecisionTraceContractV1,projectGenerationWeekRawV1} from '../generationPlanProposalV1';
import {generationValidationAuthorityContractV1} from '../generationValidationAdapterV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,resignEntry,id,type FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
const encode=(raw:string)=>Buffer.from(raw,'utf8').toString('hex');
const decode=(hex:string)=>Buffer.from(hex,'hex').toString('utf8');
const load='load_generation_request_v2',record='record_generated_week_gateway_v2',activate='activate_generated_week_gateway_v2';
export async function generationWorkerFixtureV1(options:{revokeBeforeRecord?:boolean;driftBeforeRecord?:boolean;sourceMissing?:boolean;recordLostReply?:boolean;activationLostReply?:boolean;recordConflict?:boolean;initialStatus?:string;unknownYield?:boolean}={}){
  const f:FullFixture=await fullFixture(s=>{if(options.unknownYield)for(const entry of s.context.manifest.entries)entry.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const request=f.context.input.operation.requestId;
  const source=JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,contextRaw:f.contextRaw,
    policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});
  const warnings={async loadMealWarningRaw(_request:string,slot:string,digest:string){return JSON.stringify(resignEntry({...f.set.entries[0],slotId:slot,mealSnapshotDigest:digest}));}};
  const seed=await createGenerationDayOptionsV1({async loadPreparationRaw(){return source;}},warnings).generate(request);
  assert.equal(seed.status,'FEASIBLE_PROPOSAL');if(seed.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  const trace=JSON.stringify({contract:generationDecisionTraceContractV1,requestOperationId:request,weekRawSha256:hash(seed.week.weekRaw),
    slots:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,generatorDecisionEvidence:s.generatorDecisionEvidence}))),
    weekOptimizationResultDigest:f.plan.graph.weekOptimizationResultDigest});
  const expected=await projectGenerationWeekRawV1(request,seed.week.weekRaw,f.contextRaw,trace);
  assert.equal(expected.status,'PROJECTED');if(expected.status!=='PROJECTED')throw Error('fixture');
  const input={requestOperationId:request,generationInputCanonicalHex:encode(canonicalJsonV1(f.context.input,'SAFE_INTEGER')),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)).toString('hex')};
  const calls:{name:string;args:Record<string,unknown>}[]=[];
  const counts={source:0,authority:0,records:0,activations:0};let status=options.initialStatus??'GENERATING';let storedHex:string|null=null;
  const bindings=createGenerationWorkerBindingsV1({async loadPreparationRaw(r){counts.source++;assert.equal(r,request);return options.sourceMissing?null:source;}},warnings,
    {async loadDecisionTraceRaw(r,d){assert.equal(r,request);assert.equal(d,hash(seed.week.weekRaw));return trace;}},
    {async loadForProposalRaw(r,digest){
      counts.authority++;assert.equal(r,request);assert.equal(digest,hash(expected.generatedPlanRaw));
      if(options.revokeBeforeRecord&&counts.authority>1)return null;
      let contextRaw=f.contextRaw;
      if(options.driftBeforeRecord&&counts.authority>1){const c=JSON.parse(contextRaw);const v=JSON.parse(c.trustedGenerationInputRaw);v.accountId=id(999);c.trustedGenerationInputRaw=JSON.stringify(v);contextRaw=JSON.stringify(c);}
      return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:r,accountId:f.context.input.accountId,
        generationInputDigest:f.evidence.generationInputDigest,evaluatedPlanRawSha256:digest,trustedContextRaw:contextRaw,pinnedPoliciesRaw:f.policiesRaw,pinnedWarningEvidenceRaw:f.warningRaw});
    }});
  const client:GenerationRpcClientV2={async rpc<T>(name:string,args:Record<string,unknown>){
    calls.push({name,args:structuredClone(args)});assert.equal(args.p_request_operation_id,request);
    if(name===record){
      if(options.recordConflict)status='CONFLICT';else{
        counts.records++;storedHex=(args.p_generated_week_plan_canonical as string).slice(2);status='GENERATED';
        assert.equal(decode(storedHex),expected.generatedPlanRaw);
        if(options.recordLostReply)return {data:null,error:{lost:true}};
      }
    }
    if(name===activate){counts.activations++;status='ACTIVE';if(options.activationLostReply&&counts.activations===1)return {data:null,error:{lost:true}};}
    const response={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status,retryable:status!=='ACTIVE',reasonCode:null};
    return {data:(name===load?{...response,generationInputCanonicalHex:input.generationInputCanonicalHex,
      candidateManifestCanonicalHex:input.candidateManifestCanonicalHex,attemptOperationId:id(88)}:response) as T,error:null};
  }};
  return {f,input,bindings,client,calls,counts,status:()=>status,expected:expected.generatedPlanRaw,stored:()=>storedHex,
    run:()=>continueGenerationV2({requestOperationId:request,gatewayClient:client,...bindings})};
}
