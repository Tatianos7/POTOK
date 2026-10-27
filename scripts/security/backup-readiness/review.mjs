// Offline diagnostics only: never changes strict compareContent or grants release approval.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessScope,contentSQL,sha} from './core.mjs';
const key=t=>JSON.stringify([t.schema,t.name]);
const knownExtras=new Set(['storage.iceberg_namespaces','storage.iceberg_tables']);
const exclusions=[['auth','schema_migrations'],['storage','migrations'],['storage','buckets_vectors'],['storage','vector_indexes']].map(([schema,name])=>({schema,name}));
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());}
async function digest(file){await regular(file);const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
async function json(file){await regular(file);return JSON.parse(await fs.readFile(file,'utf8'));}
export function reviewSnapshots(tables,restored,target,binding,{now=Date.now()}={}){
 assert(tables.length>0&&new Set(tables.map(key)).size===tables.length);
 assert.notEqual(restored.observedAt,target.observedAt);
 const expected=new Set(tables.map(key));
 for(const r of [restored,target]){
  assert.equal(r.protocol,'potok-backup-content-observation-v1');assert.equal(r.binding,binding);
  assert.equal(r.readOnly,'on');assert.equal(r.isolation,'repeatable read');
  assert(Number.isInteger(r.serverVersionNum)&&r.serverVersionNum>=170000&&r.serverVersionNum<180000);
  assert(Number.isFinite(Date.parse(r.observedAt)));
  assert.equal(new Set(r.inventory.map(key)).size,r.inventory.length);
  assert.equal(new Set(r.tables.map(key)).size,r.tables.length);
  assert.deepEqual(r.tables.map(key).sort(),tables.map(key).sort());
  for(const t of r.tables){assert.match(t.rows,/^\d+$/);assert.match(t.hash,/^[a-f0-9]{64}$/);}
 }
 // Target scope remains strict. Local additions are recorded, never silently authorized/excluded.
 assessScope(tables,{protocol:'potok-backup-scope-inventory-v1',tables:target.inventory,exclusions});
 const restoredSelected=restored.inventory.filter(t=>expected.has(key(t)));
 assessScope(tables,{protocol:'potok-backup-scope-inventory-v1',tables:restoredSelected,exclusions:[]});
 const excluded=new Set(exclusions.map(key));
 const extras=restored.inventory.filter(t=>!expected.has(key(t))&&!excluded.has(key(t)));
 const shape=t=>JSON.stringify([t.kind,t.partition,t.columns.map(c=>[c.name,c.type,c.generated])]);
 const dataDifferences=[],structureDifferences=[];
 for(const t of tables){
  const a=restored.tables.find(v=>key(v)===key(t)),b=target.tables.find(v=>key(v)===key(t));
  assert.match(t.rows,/^\d+$/);
  if(a.rows!==t.rows||a.rows!==b.rows||a.hash!==b.hash)dataDifferences.push({schema:t.schema,name:t.name});
  if(shape(restoredSelected.find(v=>key(v)===key(t)))!==shape(target.inventory.find(v=>key(v)===key(t))))structureDifferences.push({schema:t.schema,name:t.name});
 }
 return {protocol:'potok-saved-backup-review-v1',status:'DIAGNOSTIC_ONLY_NOT_RELEASE_EVIDENCE',tablesChecked:tables.length,
  dataDifferences,structureDifferences,restoredExtras:extras.map(t=>({schema:t.schema,name:t.name,classification:knownExtras.has(t.schema+'.'+t.name)?'KNOWN_STORAGE_NAME_REQUIRES_INDEPENDENT_REVIEW':'UNKNOWN_EXTRA_STOP'})),
  freshAtReview:[restored,target].every(r=>{const age=now-Date.parse(r.observedAt);return age>=-60000&&age<=900000;}),
  extrasEmptinessVerified:false,strictComparisonPassed:false,releaseReady:false,mayApply:false,
  note:'Saved selected scope only. Freshness is informational; extras are not removed or accepted. Full SQL/ACL/config/sequences/Storage and capture provenance remain separate.'};
}
async function review(directory,aFile,bFile){
 const dir=await fs.realpath(directory),scope=await json(path.join(dir,'scope.json'));
 assert.equal(scope.protocol,'potok-private-backup-scope-v1');
 const inventoryBytes=await fs.readFile(new URL('inventory-20261027.json',import.meta.url),'utf8');
 assert.equal(sha(inventoryBytes),scope.inventorySha256);assessScope(scope.tables,JSON.parse(inventoryBytes));
 assert.equal(sha(JSON.stringify({files:scope.files,tables:scope.tables,inventorySha256:scope.inventorySha256})),scope.binding);
 const sql=path.join(dir,'compare-readonly.sql');await regular(sql);
 assert.equal(await digest(sql),scope.querySha256);assert.equal(sha(contentSQL(scope.tables,scope.binding)),scope.querySha256);
 assert.deepEqual(Object.keys(scope.files).sort(),['data.sql','roles.sql','schema.sql']);
 for(const [file,hash] of Object.entries(scope.files)){assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(await digest(path.join(path.dirname(dir),file)),hash);}
 assert.notEqual(await fs.realpath(aFile),await fs.realpath(bFile));
 const result=reviewSnapshots(scope.tables,await json(aFile),await json(bFile),scope.binding);
 const out=await fs.mkdtemp(path.join(dir,'diagnostic-'));await fs.chmod(out,0o700);
 await fs.writeFile(path.join(out,'review.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('SAVED_BACKUP_REVIEW: tables='+result.tablesChecked+'; dataDifferences='+result.dataDifferences.length+'; structureDifferences='+result.structureDifferences.length+'; localExtras='+result.restoredExtras.length+'; diagnosticOnly=true; releaseReady=false.');
}
const expectedBuckets={'measurements-photos':22,'recipe-photos':3,'user-exercise-media':38};
export async function verifyStorage(directory){
 const dir=await fs.realpath(directory),root=path.join(dir,'storage-files');
 const rootStat=await fs.lstat(root);assert(rootStat.isDirectory()&&!rootStat.isSymbolicLink());
 const manifestFile=path.join(dir,'storage-manifest.json'),hashFile=path.join(dir,'storage-sha256.json');
 const initial=[await digest(manifestFile),await digest(hashFile)];
 const objects=await json(manifestFile),hashes=await json(hashFile);
 assert(Array.isArray(objects)&&objects.length===63&&Array.isArray(hashes)&&hashes.length===63);
 const objectKey=o=>JSON.stringify([o.bucket,o.name]);
 const byHash=new Map(hashes.map(o=>[objectKey(o),o]));assert.equal(byHash.size,63);
 const seen=new Set(),expectedFiles=new Set(),counts={};
 for(const o of objects){
  assert(Object.hasOwn(expectedBuckets,o.bucket));assert(typeof o.name==='string'&&o.name.length>0&&!o.name.includes('\u0000'));
  assert(!o.name.startsWith('/')&&o.name.split('/').every(s=>s&&s!=='.'&&s!=='..'));
  assert(!seen.has(objectKey(o)));seen.add(objectKey(o));
  const h=byHash.get(objectKey(o));assert(h);assert.match(h.sha256,/^[a-f0-9]{64}$/);assert.match(String(o.size),/^\d+$/);assert.match(h.bytes,/^\d+$/);
  // Documented CLI layout is bucket/bucket/object; do not silently flatten or search elsewhere.
  const file=path.join(root,o.bucket,o.bucket,...o.name.split('/'));
  const relative=path.relative(root,file);assert(!relative.startsWith('..')&&!path.isAbsolute(relative));
  let current=root;
  for(const part of relative.split(path.sep)){current=path.join(current,part);const s=await fs.lstat(current);assert(!s.isSymbolicLink());}
  const stat=await fs.stat(file,{bigint:true});assert(stat.isFile());assert.equal(stat.size,BigInt(o.size));assert.equal(stat.size,BigInt(h.bytes));
  assert.equal(await digest(file),h.sha256);expectedFiles.add(file);counts[o.bucket]=(counts[o.bucket]??0)+1;
 }
 assert.deepEqual(counts,expectedBuckets);
 async function walk(folder){for(const e of await fs.readdir(folder,{withFileTypes:true})){const f=path.join(folder,e.name);assert(!e.isSymbolicLink());if(e.isDirectory())await walk(f);else {assert(e.isFile()&&expectedFiles.has(f));expectedFiles.delete(f);}}}
 await walk(root);assert.equal(expectedFiles.size,0);
 assert.deepEqual([await digest(manifestFile),await digest(hashFile)],initial);
 return {protocol:'potok-local-storage-verification-v1',filesChecked:63,buckets:counts,source:'LOCAL_MANIFESTS_ONLY',currentRemoteBinariesVerified:false,releaseReady:false,mayApply:false};
}
export async function main(args){
 if(args.length===4&&args[0]==='--review-private')return review(...args.slice(1));
 if(args.length===2&&args[0]==='--verify-local-storage'){
  const result=await verifyStorage(args[1]);const dir=await fs.mkdtemp(path.join(await fs.realpath(args[1]),'storage-verification-'));await fs.chmod(dir,0o700);
  await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('LOCAL_STORAGE_FILES_OK: files=63; buckets=3; sizes/SHA256/exact file set verified; remoteBinariesVerified=false; releaseReady=false.');return;
 }
 throw Error('Offline review or local Storage verification only');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('PRIVATE_REVIEW_STOPPED: private file/scope/integrity check failed; no database contacted.');process.exitCode=1;});
