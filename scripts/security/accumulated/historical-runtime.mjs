// Reproduce public inputs of the already accepted immutable browser image, never a new product build.
import assert from 'node:assert/strict';
import {readFile,lstat,mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function materializeHistoricalRuntime(root,parent){
 root=await realpath(root);parent=await realpath(parent);
 const manifest=await readFile(path.join(root,'scripts/security/accumulated/private-browser-runtime-inputs.json'));assert.equal(hash(manifest),'42905c3493a09729229f51aa89e1eccca47c0ca15c993af4462f882256d4de9e');
 const history=new Map(['programDeliveryService','uiRuntimeAdapter'].map(name=>['src/services/'+name+'.ts',new URL('./runtime-history/'+name+'.ts.source',import.meta.url)]));
 const directory=await mkdtemp(path.join(parent,'potok-historical-runtime-'));let changed=0;
 try{for(const e of JSON.parse(manifest)){assert(!e.path.includes('..')&&!e.path.startsWith('/'));const source=path.join(root,e.path),stat=await lstat(source);assert(stat.isFile()&&!stat.isSymbolicLink());let bytes=await readFile(source);
  if(hash(bytes)!==e.sha256){assert(history.has(e.path),'Unexpected source drift outside the reviewed two-file overlay');bytes=await readFile(history.get(e.path));assert.equal(hash(bytes),e.sha256);changed++;}
  const target=path.join(directory,e.path);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,bytes,{mode:0o600});
 }await writeFile(path.join(directory,'scripts/security/accumulated/private-browser-runtime-inputs.json'),manifest,{mode:0o600});return {directory,changed};
 }catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
