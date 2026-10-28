import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {captureSQL,buildRehearsal} from './rights-rehearsal.mjs';
const inventory=JSON.parse(await readFile(new URL('inventory-20261027.json',import.meta.url)));
const names=inventory.tables.filter(t=>t.schema==='public').map(t=>t.name).sort();
const roles=['anon','authenticated','service_role'],privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
const now=Date.parse('2026-10-28T10:00:00Z');
function fixtures(){
 const local={protocol:'potok-rights-parity-capture-v1',observedAt:'2026-10-28T09:59:00Z',actor:'postgres',actorSuper:false,readOnly:'on',isolation:'repeatable read',version:170006,replicationRole:'origin',candidateNamespaces:0,clientRoles:[['anon',false,false],['authenticated',false,false]],tables:names.map(n=>[n,'postgres',true]),aclSha256:'a'.repeat(64),rights:names.flatMap(table_name=>roles.flatMap(role=>privileges.map(privilege=>({table_name,role,privilege,allowed:!(privilege==='TRUNCATE'&&role!=='service_role'),direct_owner_grant:true}))))};
 const target=structuredClone(local);target.observedAt='2026-10-28T09:59:10Z';target.aclSha256='b'.repeat(64);
 for(const r of target.rights.filter(r=>r.role!=='service_role'&&r.privilege!=='TRUNCATE').slice(0,213))r.allowed=false;
 // Current hosted client TRUNCATE may remain; rehearsal must never enable it locally.
 for(const r of target.rights.filter(r=>r.privilege==='TRUNCATE'))r.allowed=true;
 return {local,target};
}
test('213 precise revokes have preflight, provenance, matrix and rollback checks; no grant/commit',()=>{
 const {local,target}=fixtures(),result=buildRehearsal(local,target,names,{now});
 assert.equal(result.differences,213);assert.equal((result.sql.match(/^REVOKE /gm)||[]).length,213);
 assert(!/^\s*(?:GRANT|COMMIT|INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b/im.test(result.sql));
 assert(result.sql.indexOf('BASELINE_DRIFT_STOP')<result.sql.indexOf('\nREVOKE '));
 assert(result.sql.includes('LOCAL_RIGHTS_PARITY_ROLLBACK_OK'));assert(result.sql.includes('ROLLBACK_ACL_STOP'));assert.equal(result.releaseReady,false);
 assert(!result.sql.match(/^REVOKE TRUNCATE/gm));assert(!result.sql.match(/^REVOKE .* FROM "service_role"/gm));
});
test('stale/reused captures, candidate copy, bypass roles, wrong actor and missing table stop',()=>{
 for(const change of [r=>r.observedAt='2026-10-27T09:59:00Z',r=>r.observedAt='2026-10-28T11:59:00Z',r=>r.actor='supabase_admin',r=>r.actorSuper=true,r=>r.candidateNamespaces=3,r=>r.replicationRole='replica',r=>r.version=180000,r=>r.readOnly='off',r=>r.clientRoles[0][2]=true,r=>r.tables.pop(),r=>r.tables[0][1]='supabase_admin',r=>r.tables[0][2]=false]){
 const {local,target}=fixtures();change(local);assert.throws(()=>buildRehearsal(local,target,names,{now}));}
 const {local,target}=fixtures();target.observedAt=local.observedAt;assert.throws(()=>buildRehearsal(local,target,names,{now}));
});
test('missing rights, service changes, inherited-only extras, changed difference set and malformed matrix stop',()=>{
 for(const change of [(a,b)=>a.rights.find(r=>r.role==='service_role').allowed=false,(a,b)=>b.rights.find(r=>r.role==='service_role').allowed=false,(a,b)=>a.rights[0].direct_owner_grant=false,(a,b)=>b.rights.find(r=>r.role==='anon'&&r.allowed&&r.privilege!=='TRUNCATE').allowed=false,(a,b)=>a.rights.push({...a.rights[0]}),(a,b)=>a.rights[0].privilege='DROP',(a,b)=>a.rights.find(r=>r.role==='anon'&&r.privilege==='TRUNCATE').allowed=true]){
 const {local,target}=fixtures();change(local,target);assert.throws(()=>buildRehearsal(local,target,names,{now}));}
});
test('capture reads catalog only, uses bounded read-only transaction and exposes no role secrets',()=>{
 assert(captureSQL.includes('REPEATABLE READ READ ONLY'));assert(captureSQL.trim().endsWith('ROLLBACK;'));
 assert(!/pg_authid|rolpassword|pg_read_file|FROM public\./i.test(captureSQL));assert(captureSQL.includes('direct_owner_grant'));
});
test('offline preparation validates source hashes and preserves originals; arbitrary execution flags stop',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'potok-rights-prepare-')),files={'roles.sql':'-- role fixture','schema.sql':'-- schema fixture','data.sql':'-- data fixture'};
 const hash=b=>createHash('sha256').update(b).digest('hex');for(const [n,b] of Object.entries(files))await writeFile(path.join(dir,n),b);
 await writeFile(path.join(dir,'SHA256SUMS.txt'),Object.entries(files).map(([n,b])=>hash(b)+'  '+n).join('\n'));
 const args=['scripts/security/backup-readiness/rights-rehearsal.mjs','--prepare-private',dir];
 const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const out=r.stdout.trim().slice('RIGHTS_CAPTURE_PREPARED: '.length);assert.equal((await stat(out)).mode&0o777,0o700);assert.equal((await stat(path.join(out,'capture.sql'))).mode&0o777,0o600);
 for(const [n,b] of Object.entries(files))assert.equal(await readFile(path.join(dir,n),'utf8'),b);
 assert.equal(spawnSync(process.execPath,[args[0],'--apply',dir],{encoding:'utf8'}).status,1);
 await writeFile(path.join(dir,'data.sql'),'private_marker_changed');const bad=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(bad.status,1);assert(!bad.stderr.includes('private_marker_changed'));
});
test('private rollback plan requires the exact saved difference set and never overwrites reports',async()=>{
 const fs=await import('node:fs/promises'),dir=await mkdtemp(path.join(os.tmpdir(),'potok-rights-cli-'));
 const files={'roles.sql':'-- fixture','schema.sql':'-- fixture','data.sql':'-- fixture'};for(const [n,b] of Object.entries(files))await writeFile(path.join(dir,n),b);
 await writeFile(path.join(dir,'SHA256SUMS.txt'),Object.entries(files).map(([n,b])=>createHash('sha256').update(b).digest('hex')+'  '+n).join('\n'));
 const module='scripts/security/backup-readiness/rights-rehearsal.mjs';
 const prep=spawnSync(process.execPath,[module,'--prepare-private',dir],{encoding:'utf8'});assert.equal(prep.status,0,prep.stderr);const evidence=prep.stdout.trim().slice('RIGHTS_CAPTURE_PREPARED: '.length);
 const {local,target}=fixtures();local.observedAt=new Date(Date.now()-2000).toISOString();target.observedAt=new Date(Date.now()-1000).toISOString();
 const aFile=path.join(evidence,'a.json'),bFile=path.join(evidence,'b.json');await writeFile(aFile,JSON.stringify(local));await writeFile(bFile,JSON.stringify([{evidence:target}]));
 const previous=path.join(dir,'table-rights-details.fixture');await fs.mkdir(previous);
 const old=target.rights.filter(r=>!r.allowed).map(r=>({table:r.table_name,role:r.role,privilege:r.privilege,direction:'extra_on_restored'}));assert.equal(old.length,213);
 const oldFile=path.join(previous,'differences.json');await writeFile(oldFile,JSON.stringify(old));
 const args=[module,'--plan-local-rollback',evidence,aFile,bFile];const plan=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(plan.status,0,plan.stderr);assert(plan.stdout.includes('not executed'));
 const sqlFile=plan.stdout.split('\n').find(l=>l.startsWith('Private plan: ')).slice('Private plan: '.length);assert.equal((await stat(sqlFile)).mode&0o777,0o600);
 old[0].table='different';await writeFile(oldFile,JSON.stringify(old));const refused=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(refused.status,1);assert(!refused.stderr.includes(dir));assert.equal(await readFile(path.join(evidence,'capture.sql'),'utf8'),captureSQL);
});
