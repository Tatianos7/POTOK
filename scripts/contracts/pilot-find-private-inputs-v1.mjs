/**
 * Operator-only helper: find exactly pinned private pilot JSON inputs on a Mac.
 * Reads only bounded JSON files under explicit operator-selected roots.
 * NEVER sends files to a server, logs JSON contents, or alters any files.
 */
import { createHash } from 'node:crypto';
import { readdir, lstat, readFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
// Pinned to reviewed aggregate 2026-11-06. Standalone: safe to run outside the dirty checkout.
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const expected=new Map([
  ['PRIVATE_CANDIDATE','485da00522a3014c7722a7443b63b45fd3ddfcf05ec8f0186fe7d1ca704d50af'],
  ['PRIVATE_EXACT_SNAPSHOT','8ec234f6c0f1821b8dd100f3dfe4929ab34d13ff3ba38f6df1fb05db4508ef5a'],
  ['PRIVATE_FAMILY_SNAPSHOT','f6c11e8c184f42548f5461250a47b4fa84dce0cd84b30807a831fca1befa74ee']
]);
const blocked=new Set(['.git','node_modules','.next','dist','build','coverage','.cache','.npm','.pnpm-store','.yarn']);
async function inspect(root) {
  const found=new Map(), scenario=[];
  let inspected=0;
  async function walk(folder,depth) {
    if(depth>8||inspected>20000)return;
    let names;
    try { names=await readdir(folder,{withFileTypes:true}); } catch {return;}
    for (const entry of names) {
      if(inspected>20000)break;
      const path=join(folder,entry.name);
      if(entry.isSymbolicLink()||blocked.has(entry.name))continue;
      if(entry.isDirectory()) {if(depth<8)await walk(path,depth+1);continue;}
      if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.json'))continue;
      inspected++;
      try {
        const meta=await lstat(path);
        if(meta.size<=0||meta.size>15_000_000)continue;
        const data=await readFile(path), digest=sha(data);
        for(const [kind,pin] of expected)if(digest===pin) {
          const prev=found.get(kind)||[];
          prev.push(path);found.set(kind,prev);
        }
        if(/scenario|alternative|nonfish|lentil|variant/i.test(basename(path)) && scenario.length<30)scenario.push(path);
      } catch { /* unreadable paths are skipped; no source leakage */ }
    }
  }
  await walk(root,0);
  return {found,scenario,inspected};
}
if(process.argv.length<3||process.argv.length>8)throw Error('Usage: node scripts/contracts/pilot-find-private-inputs-v1.mjs ROOT_FOLDER [SECOND_ROOT ...]');
console.log('POTOK LOCAL ONLY: scanning JSON files by pinned SHA-256 (no uploads or source contents)');
let all=new Map(), candidates=[];
for(const path of process.argv.slice(2)){
  const {found,scenario,inspected}=await inspect(resolve(path));
  console.log('Scanned root:',resolve(path),'JSON files:',inspected);
  for(const [kind,paths] of found)all.set(kind,[...(all.get(kind)||[]),...paths]);
  candidates.push(...scenario);
}
for(const [kind] of expected){
  const paths=[...new Set(all.get(kind)||[])];
  console.log(kind,paths.length===1?'FOUND':paths.length===0?'NOT_FOUND':'MULTIPLE_COPIES');
  for(const path of paths) console.log(' ',path);
}
console.log('Possible scenario JSON filenames (not verified; do not assume source match):');
for(const path of [...new Set(candidates)].slice(0,20))console.log(' ',path);
console.log('Do not send source contents or private JSON to GitHub. File paths and statuses may be shared without secrets.');
