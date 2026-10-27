// Private local file preparation/comparison only. No DB, Docker, shell or restore execution.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,realpath,mkdtemp,chmod} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {parseCopy,assessScope,contentSQL,compareContent,sha} from './core.mjs';
async function regular(file){const stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink(),'Regular private input required');}
async function hashFile(file){await regular(file);const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
async function verifiedFiles(directory){
 const manifest=path.join(directory,'SHA256SUMS.txt');await regular(manifest);const text=await readFile(manifest,'utf8');const files={};
 for(const line of text.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!files[m[2]],'Unexpected checksum manifest');files[m[2]]=m[1];}
 assert.equal(Object.keys(files).length,3);
 for(const [file,digest] of Object.entries(files))assert.equal(await hashFile(path.join(directory,file)),digest,'Backup bytes changed');
 return files;
}
async function prepare(directory){
 const input=await realpath(directory);const files=await verifiedFiles(input);
 const inventoryBytes=await readFile(new URL('inventory-20261027.json',import.meta.url),'utf8');const inventory=JSON.parse(inventoryBytes);
 const lines=createInterface({input:createReadStream(path.join(input,'data.sql')),crlfDelay:Infinity});
 const tables=await parseCopy(lines),scope=assessScope(tables,inventory);
 const binding=sha(JSON.stringify({files,tables,inventorySha256:sha(inventoryBytes)}));
 const sql=contentSQL(tables,binding);
 assert.deepEqual(await verifiedFiles(input),files,'Input changed during preparation');
 const output=await mkdtemp(path.join(input,'backup-readiness-'));await chmod(output,0o700);
 await writeFile(path.join(output,'scope.json'),JSON.stringify({protocol:'potok-private-backup-scope-v1',files,tables,inventorySha256:sha(inventoryBytes),binding,querySha256:sha(sql),scope},null,2)+'\n',{mode:0o600});
 await writeFile(path.join(output,'compare-readonly.sql'),sql,{mode:0o600});
 console.log('BACKUP_COMPARE_PREPARED: tables='+scope.tables+'; rows='+scope.rows+'; no database contacted.');
 console.log('Private evidence folder: '+output);
}
async function compare(directory,restoredFile,targetFile){
 const scopeFile=path.join(directory,'scope.json'),queryFile=path.join(directory,'compare-readonly.sql');
 for(const file of [scopeFile,queryFile,restoredFile,targetFile])await regular(file);
 const scope=JSON.parse(await readFile(scopeFile,'utf8'));assert.equal(scope.protocol,'potok-private-backup-scope-v1');
 assert.equal(sha(await readFile(queryFile)),scope.querySha256);
 const inventoryBytes=await readFile(new URL('inventory-20261027.json',import.meta.url),'utf8');assert.equal(sha(inventoryBytes),scope.inventorySha256);
 const inventory=JSON.parse(inventoryBytes);assessScope(scope.tables,inventory);
 assert.equal(sha(JSON.stringify({files:scope.files,tables:scope.tables,inventorySha256:scope.inventorySha256})),scope.binding);
 assert.deepEqual(await verifiedFiles(path.dirname(await realpath(directory))),scope.files,'Original backup bytes changed');
 assert.notEqual(await realpath(restoredFile),await realpath(targetFile),'Independent capture files required');
 const restored=JSON.parse(await readFile(restoredFile,'utf8')),target=JSON.parse(await readFile(targetFile,'utf8'));
 const result=compareContent(scope.tables,restored,target,scope.binding);
 // Private report never overwrites an earlier decision/evidence.
 const report=await mkdtemp(path.join(await realpath(directory),'comparison-'));await chmod(report,0o700);
 await writeFile(path.join(report,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log('BACKUP_COMPARE_RESULT: '+result.status+'; tables='+result.tablesChecked+'; mismatches='+result.mismatches.length+'; releaseReady=false.');
 if(result.mismatches.length)process.exitCode=1;
}
export async function main(args){
 if(args.length===2&&args[0]==='--prepare-private')return prepare(args[1]);
 if(args.length===4&&args[0]==='--compare-private')return compare(args[1],args[2],args[3]);
 throw Error('Only private file preparation/comparison; no database, apply or restore flags');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('BACKUP_READINESS_STOPPED: private input/hash/scope/evidence check failed; no deployment or restore was run.');process.exitCode=1;});
