// Explicit program-UI admission after reviewed planner-estimate drift.
// Historical raw hashes remain evidence; neither file nor hash is replaced.
import assert from 'node:assert/strict';
import {assertReadPreservation} from './post-acl-reads.mjs';
export const logicalCategories=['relations','columns','indexes','constraints','functions','triggers'];
// oid is an unsigned 32-bit PostgreSQL identifier. JSON's general type
// conversion may encode it as decimal text; do not require an int JSON token.
export function triggerOidKey(value){
 assert(typeof value==='string'||typeof value==='number');
 if(typeof value==='number')assert(Number.isSafeInteger(value));
 const text=String(value);assert.match(text,/^[1-9][0-9]{0,9}$/);
 assert(BigInt(text)<=4294967295n);return text;
}
export function stableRaw(raw){
 assert.deepEqual(Object.keys(raw).sort(),['columns','relations','routines']);
 for(const key of ['relations','columns','routines'])assert(Array.isArray(raw[key])&&raw[key].length>0);
 const relations=raw.relations.map(row=>{assert(Object.hasOwn(row,'relpages')&&Object.hasOwn(row,'reltuples'));assert(Number.isFinite(row.relpages)&&Number.isFinite(row.reltuples));const {relpages,reltuples,...definition}=row;return definition;});
 return {...raw,relations};
}
export function assertObservation(observation,baseline){
 assert.equal(observation.actor,'postgres');assert.equal(observation.actorSuper,false);assert.equal(observation.readOnly,'on');assert.match(observation.rawHash,/^[a-f0-9]{64}$/);
 assert.deepEqual(Object.keys(baseline).sort(),[...logicalCategories].sort());
 assert.deepEqual(observation.logical,baseline);stableRaw(observation.raw);
}
// Original copy predates the pinned authority FK. Candidate/install/live must
// still match exactly, including both new RI triggers. Only this comparison
// across the pre/post-install boundary accounts for the two expected additions.
export function assertOriginalAuthObservation(original,baseline,onStage=()=>{}){
 onStage('original-logical');
 const {triggers:originalTriggers,...originalDefinitions}=original.logical;
 const {triggers:baselineTriggers,...baselineDefinitions}=baseline;
 assert.deepEqual(originalDefinitions,baselineDefinitions);
 assertObservation({...original,logical:baseline},baseline);
 const map=rows=>{assert(Array.isArray(rows));const m=new Map(rows.map(t=>{assert(Array.isArray(t)&&t.length===3);return [triggerOidKey(t[0]),t];}));assert.equal(m.size,rows.length);return m;};
 onStage('original-trigger-rows');
 const origin=map(originalTriggers),installed=map(baselineTriggers);
 for(const [id,trigger] of origin)assert.deepEqual(installed.get(id),trigger);
 const added=[...installed].filter(([id])=>!origin.has(id)).map(([,t])=>t);
 assert.equal(added.length,2);
 onStage('original-trigger-definitions');
 const expected=new Map([['DELETE','restrict_del'],['UPDATE','noaction_upd']]);
 for(const trigger of added){
  assert.equal(trigger[1],'O');
  const m=trigger[2].match(/^CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_a_[0-9]+" AFTER (DELETE|UPDATE) ON auth\.users FROM potok_control\.access_attestations NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "RI_FKey_(restrict_del|noaction_upd)"\(\)$/);
  assert(m);assert.equal(expected.get(m[1]),m[2]);expected.delete(m[1]);
 }
 assert.equal(expected.size,0);
}
export function assertReviewedAuthContinuity({prior,current,live,reviewCandidate,reviewOriginal,logicalBaseline,onStage=()=>{}}){
 onStage('live-logical');assertObservation(live,logicalBaseline);
 onStage('reviewed-logical');assertObservation(reviewCandidate,logicalBaseline);
 assertOriginalAuthObservation(reviewOriginal,logicalBaseline,onStage);
 // The raw guard and detailed observation must describe the same catalog state.
 onStage('raw-snapshot-binding');assert.equal(current.protected.authMetadata,live.rawHash);
 // Independent original and reviewed candidate agree in EVERY raw property
 // except the two observed PostgreSQL planner estimates. No other exemptions.
 onStage('original-raw');assert.deepEqual(stableRaw(reviewOriginal.raw),stableRaw(reviewCandidate.raw));
 onStage('live-raw');assert.deepEqual(stableRaw(reviewCandidate.raw),stableRaw(live.raw));
 for(const snapshot of [prior,current])assert.match(snapshot.protected.authMetadata,/^[a-f0-9]{64}$/);
 // Keep all other original snapshot fields and original security guard unchanged.
 const withoutRawHash=snapshot=>{const {authMetadata,...protectedFields}=snapshot.protected;return {...snapshot,protected:protectedFields};};
 onStage('protected-data-security');assertReadPreservation(withoutRawHash(prior),withoutRawHash(current));
}
