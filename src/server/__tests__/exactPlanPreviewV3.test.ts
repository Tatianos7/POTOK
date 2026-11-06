import test from 'node:test';import assert from 'node:assert/strict';
import {admissionFixtureV3,raw,id} from './exactPlanAdmissionFixturesV3';
import {createExactPlanPreviewV3,exactPlanPreviewTitlesContractV3} from '../exactPlanPreviewV3';
async function fixture(){
 const f=await admissionFixtureV3();await f.service.record(f.operation,f.proposalRaw);
 const graph=f.proposal.graph,unique=new Map<string,{recipeId:string;publicationRevision:string;title:string}>();
 for(const day of graph.days)for(const slot of day.slots)for(const b of slot.publicationBindings)unique.set(b.recipeId+':'+b.activePublicationRevision,{recipeId:b.recipeId,publicationRevision:b.activePublicationRevision,title:'Проверенное блюдо'});
 let account:string|null=f.input.accountId,enabled=true,afterTitles=()=>{},calls=0;
 let source={contract:exactPlanPreviewTitlesContractV3,requestOperationId:f.operation,accountId:account,graphDigest:graph.digest,entries:[...unique.values()]};
 const deps={authenticatedAccountId:async()=>account,open:async(op:string)=>{calls++;return f.service.open(op);},loadTitlesRaw:async()=>{afterTitles();return raw(source);}};
 return {...f,deps,service:createExactPlanPreviewV3(deps,()=>enabled),source,setSource:(s:typeof source)=>{source=s;},setAccount:(s:string|null)=>{account=s;},disable:()=>{enabled=false;},afterTitles:(fn:()=>void)=>{afterTitles=fn;},calls:()=>calls};
}
test('retained exact week opens as an immutable preview with catalog titles, exact portions and no activation',async()=>{
 const f=await fixture(),before=f.counts().writes,r=await f.service.open(f.operation);assert.equal(r.status,'PROPOSAL_PREVIEW');
 if(r.status!=='PROPOSAL_PREVIEW')assert.fail();assert.equal(r.days.length,7);assert.equal(r.planActivated,false);assert.equal(r.factsWritten,false);
 const component=r.days[0].meals[0].components[0];assert.equal(component.title,'Проверенное блюдо');
 assert.deepEqual(component.nutrition,f.proposal.graph.days[0].slots[0].exactMeal.components[0].nutrition);
 assert.deepEqual(component.wholeRecipeMultiplier,f.proposal.graph.days[0].slots[0].exactMeal.components[0].wholeRecipeMultiplier);
 assert.deepEqual(r.inputMass,f.proposal.graph.inputMass);assert.ok(Object.isFrozen(component));assert.equal(f.counts().writes,before);assert.equal(f.calls(),2);
 assert.equal('proposalCanonicalRaw'in r,false);assert.equal('ingredients'in component,false);assert.equal('servings'in component,false);
});
test('disabled, unauthenticated and malformed requests never invoke admission',async()=>{
 const f=await fixture();assert.equal((await createExactPlanPreviewV3(f.deps).open(f.operation)).status,'UNAVAILABLE');
 assert.equal((await f.service.open('bad')).status,'UNAVAILABLE');f.setAccount(null);assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');assert.equal(f.calls(),0);
});
test('foreign authenticated account never requests catalog titles',async()=>{
 const f=await fixture();f.setAccount(id(99));f.afterTitles(()=>assert.fail('must not load titles'));assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');
});
test('missing, duplicate, extra, unsafe or wrong publication titles reject the entire preview',async()=>{
 const f=await fixture(),s=f.source,e=s.entries[0];
 for(const entries of [[],[...s.entries,e],[...s.entries,{...e,recipeId:id(99)}],s.entries.map(v=>({...v,publicationRevision:id(99)})),s.entries.map(v=>({...v,title:'<script>'})),s.entries.map(v=>({...v,title:' '}))]){
  f.setSource({...s,entries});assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');
 }
});
test('title source binds operation, owner and actual graph digest',async()=>{
 const f=await fixture();for(const patch of [{requestOperationId:id(99)},{accountId:id(99)},{graphDigest:'0'.repeat(64)},{contract:'wrong' as typeof exactPlanPreviewTitlesContractV3}]){
  f.setSource({...f.source,...patch});assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');
 }
});
test('Premium revoked during catalog I/O prevents previously retained content from opening',async()=>{
 const f=await fixture();f.afterTitles(()=>f.setAdmission({...f.admission,currentAuthority:{...f.recheck,entitlement:'revoked'}}));
 assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');assert.equal(f.calls(),2);assert.equal(f.counts().writes,1);
});
test('account switch or feature closure during catalog I/O cannot return a preview',async()=>{
 for(const mode of ['account','disabled']){const f=await fixture();f.afterTitles(()=>mode==='account'?f.setAccount(id(99)):f.disable());assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');}
});
test('lost response recovery never creates a missing proposal through preview opening',async()=>{
 const f=await fixture();f.rows.clear();const before=f.counts().writes;assert.equal((await f.service.open(f.operation)).status,'UNAVAILABLE');assert.equal(f.counts().writes,before);
});
test('catalog source failure returns no proposal bytes or internal exception',async()=>{
 const f=await fixture();const r=await createExactPlanPreviewV3({...f.deps,loadTitlesRaw:async()=>{throw Error('private source');}},()=>true).open(f.operation);
 assert.equal(r.status,'UNAVAILABLE');assert.equal(JSON.stringify(r).includes('private source'),false);assert.equal('days'in r,false);
});
