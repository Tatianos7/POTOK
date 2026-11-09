import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,cp,writeFile,readdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {materializeHistoricalRuntime} from './historical-runtime.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const relative='scripts/security/accumulated';
const manifestBytes=await readFile(path.join(root,relative,'private-browser-runtime-inputs.json'));
const manifest=JSON.parse(manifestBytes);
test('historical recovery preserves every original manifest hash and current source bytes',async()=>{
 const appBefore=hash(await readFile(path.join(root,'src/App.tsx')));
 const before=hash(await readFile(path.join(root,'package.json'))),parent=await mkdtemp(path.join(os.tmpdir(),'potok-history-verify-'));
 try{
  const r=await materializeHistoricalRuntime(root,parent);assert(r.changed>=2);
  assert.equal(hash(await readFile(path.join(r.directory,relative,'private-browser-runtime-inputs.json'))),'42905c3493a09729229f51aa89e1eccca47c0ca15c993af4462f882256d4de9e');
  for(const e of manifest)assert.equal(hash(await readFile(path.join(r.directory,e.path))),e.sha256,e.path);
  assert.equal(hash(await readFile(path.join(root,'package.json'))),before);
  assert.equal(hash(await readFile(path.join(root,'src/App.tsx'))),appBefore);
 }finally{await rm(parent,{recursive:true,force:true});}
});
async function fixture(){
 const parent=await mkdtemp(path.join(os.tmpdir(),'potok-history-negative-')),copy=path.join(parent,'source'),out=path.join(parent,'out');
 await mkdir(out,{recursive:true});
 for(const e of manifest){const target=path.join(copy,e.path);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,e.path),target);}
 for(const file of ['historical-runtime.mjs','private-browser-runtime-inputs.json']){const target=path.join(copy,relative,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,relative,file),target);}
 await cp(path.join(root,relative,'runtime-history'),path.join(copy,relative,'runtime-history'),{recursive:true});
 const module=await import(pathToFileURL(path.join(copy,relative,'historical-runtime.mjs')).href);
 return {parent,copy,out,materialize:()=>module.materializeHistoricalRuntime(copy,out)};
}
test('tampered retained historical bytes reject and remove the incomplete output',async()=>{
 const f=await fixture();try{
  const retained=path.join(f.copy,relative,'runtime-history/input-snapshots/package.json.source');await writeFile(retained,(await readFile(retained,'utf8'))+'\n');
  await assert.rejects(f.materialize());assert.deepEqual(await readdir(f.out),[]);
 }finally{await rm(f.parent,{recursive:true,force:true});}
});
test('new unreviewed source drift rejects rather than expanding the historical allowlist',async()=>{
 const f=await fixture();try{
  const entry=manifest.find(e=>e.path==='src/index.css');assert(entry);
  const target=path.join(f.copy,entry.path);await writeFile(target,(await readFile(target,'utf8'))+'\n');
  await assert.rejects(f.materialize(),/Unexpected source drift/);assert.deepEqual(await readdir(f.out),[]);
 }finally{await rm(f.parent,{recursive:true,force:true});}
});

test('newly retained App input stays pinned to the unchanged original manifest',async()=>{
 const f=await fixture();try{
  const retained=path.join(f.copy,relative,'runtime-history/input-snapshots/src/App.tsx.source');
  await writeFile(retained,(await readFile(retained,'utf8'))+'\n');
  await assert.rejects(f.materialize());assert.deepEqual(await readdir(f.out),[]);
 }finally{await rm(f.parent,{recursive:true,force:true});}
});
