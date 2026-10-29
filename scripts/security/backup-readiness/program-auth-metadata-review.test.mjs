import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {compareRows,logicalAuthSQL,observationSQL} from './program-auth-metadata-review.mjs';
import {authMetadataSQL} from '../accumulated/private-auth.mjs';
test('logical Auth query remains the exact original install-time definition query',()=>{assert.equal(logicalAuthSQL,authMetadataSQL);assert.match(observationSQL,/^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/);assert.match(observationSQL,/ROLLBACK;$/);assert.doesNotMatch(observationSQL,/\b(?:INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|TRUNCATE|CREATE|DROP)\s/i);});
test('metadata comparison reports maintenance and security fields alike, without leaking values',()=>{
 const b=[{oid:1,relpages:0,reltuples:-1,relrowsecurity:true,relacl:['private-original']}];
 const a=[{...b[0],relpages:1,reltuples:11,relacl:['private-changed']}];
 const r=compareRows(b,a,x=>x.oid);assert.deepEqual(r,{changedFields:['relacl','relpages','reltuples'],addedObjects:0,removedObjects:0});assert(!JSON.stringify(r).includes('private'));
 const c=compareRows([{attrelid:1,attnum:1,attacl:null,attnotnull:true}],[{attrelid:1,attnum:1,attacl:['private'],attnotnull:false}],x=>x.attrelid+':'+x.attnum);assert.deepEqual(c.changedFields,['attacl','attnotnull']);
 const f=compareRows([{oid:2,prosrc:'private-original',proacl:null,proconfig:[]}],[{oid:2,prosrc:'private-new',proacl:['private'],proconfig:['search_path=public']}],x=>x.oid);assert.deepEqual(f.changedFields,['proacl','proconfig','prosrc']);
});
test('row identity ordering is irrelevant; missing, added and duplicate catalog objects cannot disappear',()=>{const b=[{oid:1,value:0},{oid:2,value:0}];assert.deepEqual(compareRows(b,[...b].reverse(),x=>x.oid),{changedFields:[],addedObjects:0,removedObjects:0});assert.deepEqual(compareRows(b,[b[0],{oid:3,value:0}],x=>x.oid),{changedFields:[],addedObjects:1,removedObjects:1});assert.throws(()=>compareRows(b,[b[0],b[0]],x=>x.oid));});
test('unsupported invocation is refused before any Docker dependency',()=>{const r=spawnSync(process.execPath,['scripts/security/backup-readiness/program-auth-metadata-review.mjs','--invalid'],{encoding:'utf8',env:{...process.env,PATH:'/no-docker'}});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr.trim(),'AUTH_METADATA_REVIEW_STOPPED: inputs');});
