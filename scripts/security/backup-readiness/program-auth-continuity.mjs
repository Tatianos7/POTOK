// Explicit program-UI admission after reviewed planner-estimate drift.
// Historical raw hashes remain evidence; neither file nor hash is replaced.
import assert from 'node:assert/strict';
import {assertReadPreservation} from './post-acl-reads.mjs';
export const logicalCategories=['relations','columns','indexes','constraints','functions','triggers'];
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
export function assertReviewedAuthContinuity({prior,current,live,reviewCandidate,reviewOriginal,logicalBaseline}){
 for(const observation of [live,reviewCandidate,reviewOriginal])assertObservation(observation,logicalBaseline);
 // The raw guard and detailed observation must describe the same catalog state.
 assert.equal(current.protected.authMetadata,live.rawHash);
 // Independent original and reviewed candidate agree in EVERY raw property
 // except the two observed PostgreSQL planner estimates. No other exemptions.
 assert.deepEqual(stableRaw(reviewOriginal.raw),stableRaw(reviewCandidate.raw));
 assert.deepEqual(stableRaw(reviewCandidate.raw),stableRaw(live.raw));
 for(const snapshot of [prior,current])assert.match(snapshot.protected.authMetadata,/^[a-f0-9]{64}$/);
 // Keep all other original snapshot fields and original security guard unchanged.
 const withoutRawHash=snapshot=>{const {authMetadata,...protectedFields}=snapshot.protected;return {...snapshot,protected:protectedFields};};
 assertReadPreservation(withoutRawHash(prior),withoutRawHash(current));
}
