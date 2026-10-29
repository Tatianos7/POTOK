import assert from 'node:assert/strict';
import test from 'node:test';
import {assertReviewedAuthContinuity as verify,stableRaw,triggerOidKey} from './program-auth-continuity.mjs';
const clone=structuredClone;
function fixture(){
 const logicalBaseline=Object.fromEntries(['relations','columns','indexes','constraints','functions','triggers'].map(k=>[k,[[k,1]]]));
 logicalBaseline.triggers=[[10,'O','existing trigger']];
 for(const [id,event,fn] of [[11,'DELETE','restrict_del'],[12,'UPDATE','noaction_upd']])logicalBaseline.triggers.push([id,'O',`CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_a_${id}" AFTER ${event} ON auth.users FROM potok_control.access_attestations NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "RI_FKey_${fn}"()`]);
 const observation={actor:'postgres',actorSuper:false,readOnly:'on',rawHash:'a'.repeat(64),logical:clone(logicalBaseline),raw:{relations:[{oid:1,relpages:0,reltuples:-1,relacl:null,relowner:10,relrowsecurity:true,relfilenode:42,relfrozenxid:'1'}],columns:[{attrelid:1,attnum:1,attacl:null,attnotnull:true}],routines:[{oid:2,prosrc:'code',proacl:null,proconfig:[],prosecdef:false}]}};
 const snapshot={capture:{authorityRows:0,actorSuper:false,candidateNamespaces:3,actor:'postgres',aclSha256:'acl',columnAclSha256:'columns',shapeSha256:'shape',rights:[true],tables:[1],clientRoles:[1],replicationRole:'origin'},protected:{authMetadata:'a'.repeat(64),protected:[{hash:'content',rows:'1'}],userIds:'ids',identitiesPresent:2}};
 const reviewOriginal=clone(observation);reviewOriginal.logical.triggers=reviewOriginal.logical.triggers.slice(0,1);
 return {prior:clone(snapshot),current:clone(snapshot),live:clone(observation),reviewCandidate:clone(observation),reviewOriginal,logicalBaseline};
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

test('only two exact installed authority FK triggers may be absent from the original; existing triggers and live definitions stay exact',()=>{
 const changes=[
 f=>f.reviewOriginal.logical.triggers[0][1]='D',
 f=>f.reviewOriginal.logical.triggers.push([99,'O','unknown']),
 f=>f.reviewOriginal.logical.triggers.push(f.logicalBaseline.triggers[1]),
 f=>f.logicalBaseline.triggers.push([99,'O','unknown']),
 f=>f.logicalBaseline.triggers[1][1]='D',
 f=>f.logicalBaseline.triggers[1][2]=f.logicalBaseline.triggers[1][2].replace('restrict_del','cascade_del'),
 f=>f.logicalBaseline.triggers[1][2]=f.logicalBaseline.triggers[1][2].replace('access_attestations','other_table'),
 f=>f.logicalBaseline.triggers[1][2]=f.logicalBaseline.triggers[1][2]+' WHEN (true)',
 f=>f.logicalBaseline.triggers[2][2]=f.logicalBaseline.triggers[1][2],
 f=>f.reviewOriginal.logical.triggers.push(f.reviewOriginal.logical.triggers[0])
 ];
 for(const change of changes){const f=fixture();change(f);f.live.logical=clone(f.logicalBaseline);f.reviewCandidate.logical=clone(f.logicalBaseline);assert.throws(()=>verify(f));}
 for(const side of ['live','reviewCandidate']){const f=fixture();f[side].logical.triggers=f.reviewOriginal.logical.triggers;assert.throws(()=>verify(f));}
});

test('failed admission exposes a bounded checkpoint rather than private assertion values',()=>{const f=fixture(),stages=[];f.reviewOriginal.logical.triggers[0][1]='D';assert.throws(()=>verify({...f,onStage:s=>stages.push(s)}));assert.equal(stages.at(-1),'original-trigger-rows');assert(stages.every(s=>/^[a-z-]+$/.test(s)));});

test('actual PostgreSQL oid JSON decimal strings are accepted without weakening trigger definitions',()=>{
 const f=fixture();for(const v of [f.logicalBaseline,f.live.logical,f.reviewCandidate.logical,f.reviewOriginal.logical])for(const t of v.triggers)t[0]=String(t[0]);verify(f);
 f.reviewOriginal.logical.triggers[0][1]='D';assert.throws(()=>verify(f));
});
test('OID key parsing rejects noncanonical/out-of-range identifiers and detects mixed-token duplicate identities',()=>{
 for(const v of [1,4294967295,'1','4294967295'])assert.equal(triggerOidKey(v),String(v));
 for(const v of [0,-1,1.5,NaN,Infinity,4294967296,'','0','-1','01','1.0','1e3',' 1','4294967296',null,true,{},[]])assert.throws(()=>triggerOidKey(v));
 const f=fixture();f.reviewOriginal.logical.triggers.push(['10',...f.reviewOriginal.logical.triggers[0].slice(1)]);assert.throws(()=>verify(f));
});
