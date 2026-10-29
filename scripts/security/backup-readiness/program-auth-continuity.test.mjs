import assert from 'node:assert/strict';
import test from 'node:test';
import {assertReviewedAuthContinuity as verify,stableRaw} from './program-auth-continuity.mjs';
const clone=structuredClone;
function fixture(){
 const logicalBaseline=Object.fromEntries(['relations','columns','indexes','constraints','functions','triggers'].map(k=>[k,[[k,1]]]));
 const observation={actor:'postgres',actorSuper:false,readOnly:'on',rawHash:'a'.repeat(64),logical:clone(logicalBaseline),raw:{relations:[{oid:1,relpages:0,reltuples:-1,relacl:null,relowner:10,relrowsecurity:true,relfilenode:42,relfrozenxid:'1'}],columns:[{attrelid:1,attnum:1,attacl:null,attnotnull:true}],routines:[{oid:2,prosrc:'code',proacl:null,proconfig:[],prosecdef:false}]}};
 const snapshot={capture:{authorityRows:0,actorSuper:false,candidateNamespaces:3,actor:'postgres',aclSha256:'acl',columnAclSha256:'columns',shapeSha256:'shape',rights:[true],tables:[1],clientRoles:[1],replicationRole:'origin'},protected:{authMetadata:'a'.repeat(64),protected:[{hash:'content',rows:'1'}],userIds:'ids',identitiesPresent:2}};
 return {prior:clone(snapshot),current:clone(snapshot),live:clone(observation),reviewCandidate:clone(observation),reviewOriginal:clone(observation),logicalBaseline};
}
test('explicit reviewed admission permits only the two observed planner estimate changes and retains historical evidence',()=>{
 const f=fixture();f.prior.protected.authMetadata='b'.repeat(64);f.reviewOriginal.raw.relations[0].relpages=8;f.live.raw.relations[0].reltuples=20;const before=clone(f);verify(f);assert.deepEqual(f,before);
});
test('new, dropped and altered Auth relations, all other pg_class fields and maintenance fields fail closed',()=>{
 for(const [field,value] of [['relacl',['client']],['relowner',11],['relrowsecurity',false],['relfilenode',43],['relfrozenxid','2'],['unknownNewField',true]]){const f=fixture();f.live.raw.relations[0][field]=value;assert.throws(()=>verify(f));}
 for(const change of [f=>f.live.raw.relations.push({...f.live.raw.relations[0],oid:3}),f=>f.live.raw.relations.pop()]){const f=fixture();change(f);assert.throws(()=>verify(f));}
});
test('column grants/definitions and function body/grants/search path/definer changes are rejected',()=>{
 for(const [category,field,value] of [['columns','attacl',['client']],['columns','attnotnull',false],['routines','prosrc','changed'],['routines','proacl',['client']],['routines','proconfig',['search_path=public']],['routines','prosecdef',true]]){const f=fixture();f.live.raw[category][0][field]=value;assert.throws(()=>verify(f));}
});
test('every logical baseline category must match independently for live, reviewed and original evidence',()=>{
 for(const side of ['live','reviewCandidate','reviewOriginal'])for(const category of Object.keys(fixture().logicalBaseline)){const f=fixture();f[side].logical[category]=[];assert.throws(()=>verify(f));}
 const f=fixture();delete f.logicalBaseline.indexes;assert.throws(()=>verify(f));
});
test('old protected contents, identities and every security capture condition remain mandatory',()=>{
 for(const change of [f=>f.current.protected.protected[0].hash='changed',f=>f.current.protected.userIds='other',f=>f.current.protected.identitiesPresent=1,...Object.keys(fixture().current.capture).map(k=>f=>f.current.capture[k]='changed')]){const f=fixture();change(f);assert.throws(()=>verify(f));}
});
test('write-mode/superuser/wrong actor, mismatched raw snapshot and nonfinite estimates are refused',()=>{
 for(const side of ['live','reviewCandidate','reviewOriginal'])for(const [key,value] of [['actor','supabase_admin'],['actorSuper',true],['readOnly','off']]){const f=fixture();f[side][key]=value;assert.throws(()=>verify(f));}
 const f=fixture();f.live.rawHash='c'.repeat(64);assert.throws(()=>verify(f));assert.throws(()=>stableRaw({...f.live.raw,relations:[{oid:1,relpages:NaN,reltuples:0}]}));
});
