import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidateCaptureSQL,buildCandidatePlans} from './candidate-rights.mjs';
const inventory=JSON.parse(await readFile(new URL('inventory-20261027.json',import.meta.url)));
const skipped=new Set(inventory.exclusions.map(t=>JSON.stringify([t.schema,t.name])));
const tables=inventory.tables.filter(t=>!skipped.has(JSON.stringify([t.schema,t.name]))).map(({schema,name})=>({schema,name}));
const names=tables.filter(t=>t.schema==='public').map(t=>t.name).sort();
const roles=['anon','authenticated','service_role'],privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
const now=Date.parse('2026-10-28T10:00:00Z');
const key=r=>JSON.stringify([r.table_name??r.table,r.role,r.privilege]);
function fixture(){
 const snapshot={protocol:'potok-candidate-acl-capture-v1',observedAt:'2026-10-28T09:59:00Z',actor:'postgres',actorSuper:false,readOnly:'on',isolation:'repeatable read',replicationRole:'origin',candidateNamespaces:3,authorityRows:0,version:170006,clientRoles:[['anon',false,false],['authenticated',false,false]],tables:names.map(n=>[n,'postgres',true]),aclSha256:'a'.repeat(64),columnAclSha256:'b'.repeat(64),shapeSha256:'c'.repeat(64),columnAcls:[{table:'user_profiles',column:'first_name',role:'authenticated',privilege:'UPDATE'}],content:tables.map(t=>({...t,rows:'0',hash:'d'.repeat(64)})),rights:names.flatMap(table_name=>roles.flatMap(role=>privileges.map(privilege=>({table_name,role,privilege,allowed:!(privilege==='TRUNCATE'&&role!=='service_role'),direct_owner_grant:true}))))};
 const already=snapshot.rights.filter(r=>r.table_name==='user_profiles'&&r.role==='anon'&&['INSERT','UPDATE'].includes(r.privilege));assert.equal(already.length,2);for(const r of already)r.allowed=false;
 const remaining=snapshot.rights.filter(r=>r.role==='anon'&&r.privilege!=='TRUNCATE'&&r.allowed).slice(0,211).map(r=>({table:r.table_name,role:r.role,privilege:r.privilege,direction:'extra_on_restored',directOwnerGrant:true}));
 const original=[...remaining,...already.map(r=>({table:r.table_name,role:r.role,privilege:r.privilege,direction:'extra_on_restored'}))];
 return {snapshot,remaining,original};
}
const build=f=>buildCandidatePlans(f.snapshot,f.original,f.remaining,{names,tables,now});
test('211 exact revokes have separate rollback/commit/independent-readonly verification; no grant or data repair',()=>{
 const p=build(fixture());for(const mode of ['rollback','commit']){assert.equal((p[mode].match(/^REVOKE /gm)||[]).length,211);assert(!/^\s*(?:GRANT|INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/im.test(p[mode]));assert(p[mode].includes('CANDIDATE_CONTENT_STOP'));assert(p[mode].includes('CANDIDATE_METADATA_STOP'));}
 assert(!/^COMMIT;/m.test(p.rollback));assert.equal((p.commit.match(/^COMMIT;$/gm)||[]).length,1);assert(p.verify.includes('BEGIN READ ONLY;'));assert(!/^REVOKE /m.test(p.verify));assert(p.verify.includes('CANDIDATE_ACL_COMMITTED_VERIFIED_OK'));assert.equal(p.hostedApplyAllowed,false);assert(p.reconcile.includes('desiredMatrixMatches'));assert(!/^REVOKE /m.test(p.reconcile));
});
test('overlapping column privileges or required photo grants stop before any plan',()=>{
 const a=fixture();a.snapshot.columnAcls.push({...a.remaining[0],column:'id'});assert.throws(()=>build(a));
 const b=fixture(),replaced=b.remaining[0];const photo={table:'measurement_photo_assets',role:'authenticated',privilege:'INSERT',direction:'extra_on_restored',directOwnerGrant:true};
 b.original=b.original.filter(r=>key(r)!==key(replaced));b.remaining[0]=photo;b.original.push(photo);assert.throws(()=>build(b));
});
test('stale snapshots, wrong copy/actor, role bypass, authority, scope drift and changed exact differences stop',()=>{
 for(const change of [f=>f.snapshot.observedAt='2026-10-27T09:00:00Z',f=>f.snapshot.candidateNamespaces=0,f=>f.snapshot.authorityRows=1,f=>f.snapshot.actorSuper=true,f=>f.snapshot.actor='supabase_admin',f=>f.snapshot.clientRoles[0][2]=true,f=>f.snapshot.rights.pop(),f=>f.snapshot.tables[0][1]='other_owner',f=>f.remaining.pop(),f=>f.original[0].table='different',f=>f.snapshot.rights.find(r=>key(r)===key(f.remaining[0])).direct_owner_grant=false]){const f=fixture();change(f);assert.throws(()=>build(f));}
});
test('full current content includes new execution_reason; malformed fingerprints and duplicate content stop',()=>{
 const f=fixture(),p=build(f);assert(p.rollback.includes('to_jsonb(t)::text'));assert(!p.rollback.includes("to_jsonb(t)-'execution_reason'"));
 f.snapshot.content[0].hash='invalid';assert.throws(()=>build(f));
 const g=fixture();g.snapshot.content[1]=g.snapshot.content[0];assert.throws(()=>build(g));
});
test('capture is read-only with matching UTC/float formatting, no source rows returned',()=>{
 const sql=candidateCaptureSQL(tables);assert(sql.includes('REPEATABLE READ READ ONLY'));assert(sql.includes("timezone='UTC'"));assert(sql.includes('extra_float_digits=3'));assert(sql.trim().endsWith('ROLLBACK;'));assert(!/pg_authid|rolpassword|pg_read_file|\bCOPY\b/i.test(sql));assert(sql.includes('columnAcls'));assert(sql.includes('shapeSha256'));
});
test('private offline generation preserves files, writes owner-only plans and rejects apply flags/tamper',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'potok-candidate-acl-')),files={'roles.sql':'-- fixture','schema.sql':'-- fixture','data.sql':'-- fixture'};
 const sha=b=>createHash('sha256').update(b).digest('hex');for(const [n,b] of Object.entries(files))await writeFile(path.join(dir,n),b);await writeFile(path.join(dir,'SHA256SUMS.txt'),Object.entries(files).map(([n,b])=>sha(b)+'  '+n).join('\n'));
 const module='scripts/security/backup-readiness/candidate-rights.mjs';const prep=spawnSync(process.execPath,[module,'--prepare-private',dir],{encoding:'utf8'});assert.equal(prep.status,0,prep.stderr);const evidence=prep.stdout.trim().slice('CANDIDATE_CAPTURE_PREPARED: '.length);
 const f=fixture();f.snapshot.observedAt=new Date(Date.now()-1000).toISOString();const input=path.join(evidence,'candidate.json');await writeFile(input,JSON.stringify(f.snapshot));
 const sourceDir=path.join(dir,'table-rights-details.fixture'),candidateDir=path.join(dir,'candidate-rights-audit.fixture');await mkdir(sourceDir);await mkdir(candidateDir);await writeFile(path.join(sourceDir,'differences.json'),JSON.stringify(f.original));await writeFile(path.join(candidateDir,'remaining-original-extras.json'),JSON.stringify(f.remaining));
 const args=[module,'--plan-candidate-local',evidence,input],r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const out=r.stdout.split('\n').find(l=>l.startsWith('Private plans: ')).slice('Private plans: '.length);
 for(const file of ['rollback.sql','commit.sql','verify.sql','reconcile.sql','manifest.json'])assert.equal((await stat(path.join(out,file))).mode&0o777,0o600);assert.equal((await stat(out)).mode&0o777,0o700);
 for(const [n,b] of Object.entries(files))assert.equal(await readFile(path.join(dir,n),'utf8'),b);
 await writeFile(path.join(evidence,'capture.sql'),'private_marker_modified');const bad=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(bad.status,1);assert(!bad.stderr.includes('private_marker_modified'));
 assert.equal(spawnSync(process.execPath,[module,'--apply',evidence],{encoding:'utf8'}).status,1);
});
