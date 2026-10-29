import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
try {
assert.equal(process.argv.length,4);assert.equal(process.argv[2],"--verify-downloaded");
const base=fs.realpathSync(process.argv[3]);
const read=n=>{const f=path.join(base,n);const s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink());return JSON.parse(fs.readFileSync(f,"utf8"));};
const before=read("storage-inventory.json"),raw=read("storage-inventory-after-raw.json");
assert(Array.isArray(raw)&&raw.length===1);
const after=typeof raw[0].storage_inventory==="string"?JSON.parse(raw[0].storage_inventory):raw[0].storage_inventory;
assert.equal(before.readOnly,"on");assert.equal(after.readOnly,"on");
assert(isDeepStrictEqual(before.buckets,after.buckets));assert(isDeepStrictEqual(before.objects,after.objects));
assert.deepEqual(before.buckets,["measurements-photos","recipe-photos","user-exercise-media"]);
assert(Array.isArray(before.objects)&&before.objects.length===63);
const root=path.join(base,"storage-files"),rootStat=fs.lstatSync(root);
assert(rootStat.isDirectory()&&!rootStat.isSymbolicLink());
const expected=new Set(),identities=new Set(),hashes=[],counts={};
for(const o of before.objects){
assert(before.buckets.includes(o.bucket));assert(typeof o.name==="string"&&o.name.length>0&&!o.name.includes("\u0000"));
assert(!o.name.startsWith("/")&&o.name.split("/").every(s=>s&&s!=="."&&s!==".."));assert(/^\d+$/.test(o.size));
assert(typeof o.id==="string"&&!identities.has(o.id));identities.add(o.id);
const parts=[o.bucket,o.bucket,...o.name.split("/")];let file=root;
for(const part of parts){file=path.join(file,part);assert(!fs.lstatSync(file).isSymbolicLink());}
assert(!expected.has(file));expected.add(file);
const stat=fs.statSync(file,{bigint:true});assert(stat.isFile());assert.equal(stat.size,BigInt(o.size));
const h=createHash("sha256");for await(const b of fs.createReadStream(file))h.update(b);
const latest=fs.statSync(file,{bigint:true});assert.equal(latest.size,stat.size);assert.equal(latest.mtimeNs,stat.mtimeNs);assert.equal(latest.ctimeNs,stat.ctimeNs);
hashes.push({bucket:o.bucket,name:o.name,bytes:stat.size.toString(),sha256:h.digest("hex")});counts[o.bucket]=(counts[o.bucket]||0)+1;
}
const found=new Set();
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else{assert(e.isFile()&&expected.has(file));found.add(file);}}}
walk(root);assert.equal(found.size,expected.size);
for(const [name,value] of [["storage-manifest.json",before.objects],["storage-sha256.json",hashes]])fs.writeFileSync(path.join(base,name),JSON.stringify(value,null,2),{mode:0o600,flag:"wx"});
console.log(JSON.stringify({status:"FRESH_STORAGE_FILES_VERIFIED",files:hashes.length,buckets:counts,sizesMatch:true,exactFileSet:true,inventoryStable:true,sha256Saved:true,restoreVerified:false},null,2));
} catch {console.error("FRESH_STORAGE_VERIFICATION_STOPPED: private files retained; do not replay downloads automatically");process.exitCode=1;}
