import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {reviewSnapshots,verifyStorage} from './review.mjs';
import {compareContent,sha} from './core.mjs';
const binding='a'.repeat(64),now=Date.parse('2026-10-27T12:00:00Z');
const tables=[{schema:'public',name:'fixture',columns:['id'],rows:'1'}];
const table={schema:'public',name:'fixture',kind:'r',partition:false,columns:[{name:'id',type:'uuid',generated:''}]};
const cert=time=>({protocol:'potok-backup-content-observation-v1',binding,observedAt:time,serverVersionNum:170006,readOnly:'on',isolation:'repeatable read',inventory:[structuredClone(table)],tables:[{schema:'public',name:'fixture',rows:'1',hash:'b'.repeat(64)}]});
const pair=()=>[cert('2026-10-27T11:59:00Z'),cert('2026-10-27T11:59:10Z')];
test('JSON object key order is irrelevant while column order and types remain meaningful',()=>{
 const [a,b]=pair();b.inventory[0].columns=[{generated:'',type:'uuid',name:'id'}];
 let r=reviewSnapshots(tables,a,b,binding,{now});assert.equal(r.structureDifferences.length,0);
 b.inventory[0].columns[0].type='text';r=reviewSnapshots(tables,a,b,binding,{now});assert.equal(r.structureDifferences.length,1);
});
test('local named Storage extras are visible diagnostics and never relax strict comparison',()=>{
 const [a,b]=pair();for(const name of ['iceberg_namespaces','iceberg_tables'])a.inventory.push({...structuredClone(table),schema:'storage',name});
 const r=reviewSnapshots(tables,a,b,binding,{now});assert.equal(r.dataDifferences.length,0);assert.equal(r.restoredExtras.length,2);assert(r.restoredExtras.every(t=>t.classification==='KNOWN_STORAGE_NAME_REQUIRES_INDEPENDENT_REVIEW'));
 for(const k of ['extrasEmptinessVerified','strictComparisonPassed','mayApply','releaseReady'])assert.equal(r[k],false);
 assert.throws(()=>compareContent(tables,a,b,binding,{now}));
 a.inventory.push({...structuredClone(table),name:'unreviewed'});assert.equal(reviewSnapshots(tables,a,b,binding,{now}).restoredExtras.at(-1).classification,'UNKNOWN_EXTRA_STOP');
});
test('stale snapshots stay historical; changed data and expected restore counts remain differences',()=>{
 const [a,b]=pair();b.tables[0].hash='c'.repeat(64);a.tables[0].rows='2';
 const r=reviewSnapshots(tables,a,b,binding,{now:now+3600000});assert.equal(r.freshAtReview,false);assert.equal(r.dataDifferences.length,1);assert.equal(r.status,'DIAGNOSTIC_ONLY_NOT_RELEASE_EVIDENCE');
});
test('wrong actors/context, duplicate/missing tables, malformed hashes and target extras stop',()=>{
 for(const change of [r=>r.binding='d'.repeat(64),r=>r.readOnly='off',r=>r.isolation='read committed',r=>r.tables.push({...r.tables[0]}),r=>r.tables[0].hash='invalid',r=>r.inventory.push({...structuredClone(table),name:'extra'}),r=>r.serverVersionNum=180000]){
 const [a,b]=pair();change(b);assert.throws(()=>reviewSnapshots(tables,a,b,binding,{now}));}
});
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'potok-storage-test-')),objects=[],hashes=[];
 for(const [bucket,count] of Object.entries({'measurements-photos':22,'recipe-photos':3,'user-exercise-media':38}))for(let i=0;i<count;i++){
 const name='nested/'+i+'.bin',bytes=Buffer.from('synthetic '+i),file=path.join(dir,'storage-files',bucket,bucket,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);
 objects.push({bucket,name,size:bytes.length});hashes.push({bucket,name,bytes:String(bytes.length),sha256:sha(bytes)});
 }
 await fs.writeFile(path.join(dir,'storage-manifest.json'),JSON.stringify(objects));await fs.writeFile(path.join(dir,'storage-sha256.json'),JSON.stringify(hashes));return {dir,objects,hashes};
}
test('all 63 nested Storage files match names, sizes and hashes without changing originals',async()=>{
 const {dir}=await fixture();const before=await fs.readFile(path.join(dir,'storage-manifest.json'));const r=await verifyStorage(dir);assert.equal(r.filesChecked,63);assert.equal(r.currentRemoteBinariesVerified,false);assert.deepEqual(await fs.readFile(path.join(dir,'storage-manifest.json')),before);
 const cli=spawnSync(process.execPath,['scripts/security/backup-readiness/review.mjs','--verify-local-storage',dir],{encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);assert(cli.stdout.includes('LOCAL_STORAGE_FILES_OK'));
 const out=(await fs.readdir(dir)).find(n=>n.startsWith('storage-verification-'));assert.equal((await fs.stat(path.join(dir,out))).mode&0o777,0o700);assert.equal((await fs.stat(path.join(dir,out,'result.json'))).mode&0o777,0o600);
});
test('same-size tamper, unexpected file, duplicate manifest and missing file stop',async()=>{
 for(const kind of ['tamper','extra','duplicate','missing']){
 const {dir,objects}=await fixture(),o=objects[0],file=path.join(dir,'storage-files',o.bucket,o.bucket,o.name);
 if(kind==='tamper')await fs.writeFile(file,Buffer.alloc(o.size));
 if(kind==='extra')await fs.writeFile(path.join(dir,'storage-files','unexpected'),'private_marker_never_echo');
 if(kind==='duplicate'){objects[1]=objects[0];await fs.writeFile(path.join(dir,'storage-manifest.json'),JSON.stringify(objects));}
 if(kind==='missing')await fs.unlink(file);
 await assert.rejects(()=>verifyStorage(dir));
 const cli=spawnSync(process.execPath,['scripts/security/backup-readiness/review.mjs','--verify-local-storage',dir],{encoding:'utf8'});assert.equal(cli.status,1);assert(!cli.stderr.includes('private_marker_never_echo'));assert(!cli.stderr.includes(dir));
 }
});
test('traversal names and symlinked directories/files are rejected',async()=>{
 for(const kind of ['traversal','directory-link','file-link']){
 const {dir,objects,hashes}=await fixture(),o=objects[0],file=path.join(dir,'storage-files',o.bucket,o.bucket,o.name);
 if(kind==='traversal'){objects[0].name='../outside';hashes[0].name='../outside';await fs.writeFile(path.join(dir,'storage-manifest.json'),JSON.stringify(objects));await fs.writeFile(path.join(dir,'storage-sha256.json'),JSON.stringify(hashes));}
 if(kind==='directory-link'){const folder=path.dirname(file);await fs.rename(folder,folder+'-moved');await fs.symlink(folder+'-moved',folder);}
 if(kind==='file-link'){await fs.rename(file,file+'-moved');await fs.symlink(file+'-moved',file);}
 await assert.rejects(()=>verifyStorage(dir));
 }
});
test('private saved-review CLI revalidates source/query binding, writes private report and rejects query tamper',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'potok-review-cli-'));
 const inv=JSON.parse(await fs.readFile(new URL('inventory-20261027.json',import.meta.url)));
 const skip=new Set(inv.exclusions.map(t=>t.schema+'.'+t.name));
 const selected=inv.tables.filter(t=>!skip.has(t.schema+'.'+t.name));
 const dump=selected.map(t=>'COPY "'+t.schema+'"."'+t.name+'" ('+t.columns.filter(c=>c.generated==='').map(c=>'"'+c.name+'"').join(',')+') FROM stdin;\n\\.\n').join('');
 const inputs={'roles.sql':'-- synthetic','schema.sql':'-- synthetic','data.sql':dump};
 for(const [name,bytes] of Object.entries(inputs))await fs.writeFile(path.join(dir,name),bytes);
 await fs.writeFile(path.join(dir,'SHA256SUMS.txt'),Object.entries(inputs).map(([n,b])=>sha(b)+'  '+n).join('\n'));
 const preparation=spawnSync(process.execPath,['scripts/security/backup-readiness/prepare.mjs','--prepare-private',dir],{encoding:'utf8'});assert.equal(preparation.status,0,preparation.stderr);
 const evidence=preparation.stdout.split('\n').find(l=>l.startsWith('Private evidence folder: ')).slice('Private evidence folder: '.length);
 const scope=JSON.parse(await fs.readFile(path.join(evidence,'scope.json')));
 const receipt=time=>({protocol:'potok-backup-content-observation-v1',binding:scope.binding,observedAt:time,serverVersionNum:170006,readOnly:'on',isolation:'repeatable read',inventory:inv.tables,tables:scope.tables.map(t=>({schema:t.schema,name:t.name,rows:'0',hash:'b'.repeat(64)}))});
 const aFile=path.join(evidence,'a.json'),bFile=path.join(evidence,'b.json');
 await fs.writeFile(aFile,JSON.stringify(receipt('2026-10-27T10:00:00Z')));await fs.writeFile(bFile,JSON.stringify(receipt('2026-10-27T10:01:00Z')));
 const args=['scripts/security/backup-readiness/review.mjs','--review-private',evidence,aFile,bFile];
 const good=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(good.status,0,good.stderr);assert(good.stdout.includes('dataDifferences=0; structureDifferences=0'));
 const reportDir=(await fs.readdir(evidence)).find(n=>n.startsWith('diagnostic-'));const report=path.join(evidence,reportDir,'review.json');assert.equal((await fs.stat(report)).mode&0o777,0o600);assert.equal(JSON.parse(await fs.readFile(report)).strictComparisonPassed,false);
 await fs.appendFile(path.join(evidence,'compare-readonly.sql'),'-- tamper');const bad=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(bad.status,1);assert(!bad.stderr.includes(evidence));
});
