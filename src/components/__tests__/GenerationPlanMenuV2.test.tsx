import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {GenerationPlanMenuViewV2} from '../GenerationPlanMenuV2';
import {fullFixture,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {decodeGenerationPlanReadbackV2,generationPlanReadbackContractV2} from '../../services/generationPlanReadbackV2';
test('nonready phases never render recipe content or action controls',()=>{
  for(const phase of ['idle','loading','pending','denied','unavailable'] as const){
    const html=renderToStaticMarkup(<GenerationPlanMenuViewV2 state={{phase,model:null,slots:[]}}/>);
    assert.match(html,/role="status"/);assert.doesNotMatch(html,/<details|<button|<input|ккал/);
  }
});
test('confirmed week renders all seven days, calculated nutrition and unknown-weight labels without FACT actions',async()=>{
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const model=await decodeGenerationPlanReadbackV2({kind:'ready',contract:generationPlanReadbackContractV2,
    account_id:f.context.input.accountId,request_operation_id:f.context.input.operation.requestId,
    selection_id:f.plan.selectionId,plan_revision:f.plan.proposedPlanRevision,generation_operation_id:id(900),activation_operation_id:id(901),
    graph_digest_hex:f.plan.graphDigest,graph:f.plan.graph},f.context.input.accountId,f.context.input.operation.requestId);
  assert.equal(model.kind,'ready');if(model.kind!=='ready')return;
  const html=renderToStaticMarkup(<GenerationPlanMenuViewV2 state={{phase:'ready',model,slots:model.graph.days[0].slots}}/>);
  assert.equal((html.match(/<details/g)||[]).length,7);assert.match(html,/вес порции не указан/);
  assert.match(html,/КБЖУ рассчитаны по составу/);assert.match(html,/пока не записаны в дневник/);
  assert.doesNotMatch(html,/<button|<input|Съедено/);
});
