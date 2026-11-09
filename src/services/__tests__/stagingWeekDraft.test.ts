import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStagingWeekDraft, saveStagingWeekDraft, removeStagingWeekDraft} from '../stagingWeekDraft';
import {referenceWeekFixture} from './stagingWeekDraft.fixture';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const raw=()=>JSON.stringify(referenceWeekFixture());
const now=new Date('2026-11-09T11:00:00Z');
function store() {
  const data=new Map<string,string>();let writes=0;
  return {data,get writes(){return writes;},getItem(k:string){return data.get(k)??null;},setItem(k:string,v:string){writes++;data.set(k,v);},removeItem(k:string){data.delete(k);}};
}
test('save/readback preserves every day, recipe detail, source snapshot and unknown mass; replay has one slot',()=>{
  const s=store(), saved=saveStagingWeekDraft(s,a,raw(),'Europe/Moscow',now);
  const replay=saveStagingWeekDraft(s,a,raw(),'Europe/Moscow',new Date(now.getTime()+1000));
  assert.deepEqual(replay,saved);assert.equal(s.writes,1);assert.equal(s.data.size,1);
  const loaded=loadStagingWeekDraft(s,a)!;assert.deepEqual(loaded,saved);assert.equal(loaded.view.report.days.length,7);
  assert.equal(loaded.view.catalog.recipes.size,28);assert.equal(loaded.view.report.days[0].meals[0].measuredGrams,null);
  assert.equal(loaded.view.catalog.recipes.get('synthetic-0')!.ingredients[0].weightG,null);
  assert.equal(loaded.view.snapshot,raw());assert.equal(loaded.target,1600);assert.equal(loaded.timeZone,'Europe/Moscow');
});
test('account separation and envelope ownership; deletion is limited to own draft',()=>{
  const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);assert.equal(loadStagingWeekDraft(s,b),null);
  const [key,value]=[...s.data][0];s.data.set(key.replace(a,b),value);assert.throws(()=>loadStagingWeekDraft(s,b));
  removeStagingWeekDraft(s,a);assert.equal(loadStagingWeekDraft(s,a),null);assert.equal(s.data.size,1);
  assert.throws(()=>loadStagingWeekDraft(s,''));
});
type Envelope={contract:string;scope:string;timeZone:string;target:number;weekStart:string;savedAt:string;payload:string};
test('tampered flags, corridor, totals, recipe linkage, version and metadata fail closed',()=>{
  for(const mutate of [
    (e:Envelope)=>{e.contract='graph-v2';}, (e:Envelope)=>{e.scope='ACTIVE';}, (e:Envelope)=>{e.timeZone='invalid/timezone';},
    (e:Envelope)=>{e.target=1800;},(e:Envelope)=>{e.weekStart='2026-11-10';},(e:Envelope)=>{e.savedAt='broken';},
    (e:Envelope)=>{e.payload=JSON.stringify({...JSON.parse(e.payload),mayActivate:true});},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.report.calorieCorridor.maximumKcal=1700;e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.report.days[0].referenceNutrition.calories='1601.000';e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.catalog.recipes[0].referenceNutrition.values.calories=999;e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.catalog.source.sha256='b'.repeat(64);e.payload=JSON.stringify(p);},
  ]) {
    const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);const [k,v]=[...s.data][0],envelope=JSON.parse(v);
    mutate(envelope);s.data.set(k,JSON.stringify(envelope));assert.throws(()=>loadStagingWeekDraft(s,a));
  }
});
test('invalid/incomplete/oversized input never overwrites a saved week; quota and unavailable storage fail visibly',()=>{
  const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);const before=[...s.data];
  const p=referenceWeekFixture();p.report.days=[];
  for(const payload of [JSON.stringify(p),'not json',' '.repeat(2_000_001)])assert.throws(()=>saveStagingWeekDraft(s,a,payload,'UTC',now));
  assert.deepEqual([...s.data],before);
  const next=JSON.stringify(referenceWeekFixture(1800));
  assert.throws(()=>saveStagingWeekDraft({...s,setItem(){throw Error('quota');}},a,next,'UTC',now),/quota/);
  assert.deepEqual([...s.data],before);
  assert.throws(()=>loadStagingWeekDraft({...s,getItem(){throw Error('unavailable');}},a),/unavailable/);
});
