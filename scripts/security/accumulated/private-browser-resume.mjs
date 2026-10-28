// Public build recovery only. Never opens backup contents, service Env or a database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const runtimeHash='f47eb49c6f95eec54c3138e4fbc9ee4d706616a985e0b4ae068d46e03ab50e1e';
export const buildTimeout=3600000;
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file);}
async function absent(file){try{await fs.lstat(file);throw Error('Existing result retained');}catch(e){if(e.code!=='ENOENT')throw e;}}
export async function validateContext(root,build,runtime){
 assert.match(path.basename(build),/^private-browser-build-[A-Za-z0-9]+$/);assert.equal(path.basename(root),'source');assert.match(path.basename(path.dirname(root)),/^potok-public-browser-source\.[A-Za-z0-9]+$/);assert.equal(path.dirname(path.dirname(root)),path.dirname(build));
 assert.equal(sha(await regular(path.join(root,'scripts/security/accumulated/private-browser-runtime.mjs'))),runtimeHash);
 await absent(path.join(build,'receipt.json'));await absent(path.join(build,'image-id.txt'));
 const {entries,digest}=await runtime.runtimeInputs(root),context=path.join(build,'context');assert((await fs.lstat(context)).isDirectory()&&!(await fs.lstat(context)).isSymbolicLink());
 const expected=new Set([...entries.map(e=>e.path),'Dockerfile']),found=[];
 const walk=async(directory,relative='')=>{for(const d of await fs.readdir(directory,{withFileTypes:true})){const rel=relative?relative+'/'+d.name:d.name;assert(!d.isSymbolicLink());if(d.isDirectory())await walk(path.join(directory,d.name),rel);else{assert(d.isFile());found.push(rel);}}};await walk(context);
 assert.deepEqual(found.sort(),[...expected].sort());
 for(const entry of entries)assert.equal(sha(await regular(path.join(context,entry.path))),entry.sha256);
 assert.equal((await regular(path.join(context,'Dockerfile'))).toString('utf8'),runtime.dockerfile);
 return {context,digest};
}
export async function resumePublicBuild(root,build,runtime){
 const {context,digest}=await validateContext(root,build,runtime);const space=await fs.statfs(build,{bigint:true});assert(space.bavail*space.bsize>=8n*1024n**3n);
 const local=value=>typeof value==='string'&&value.startsWith('unix:///');assert(!process.env.DOCKER_HOST||local(process.env.DOCKER_HOST));assert(local(JSON.parse(await runtime.docker(['context','inspect','--format','{{json .Endpoints.docker.Host}}']))));
 const attempt=await fs.mkdtemp(path.join(build,'resume.'));await fs.chmod(attempt,0o700);console.log('Public build recovery folder: '+attempt);
 const imageFile=path.join(attempt,'image-id.txt');
 console.log('PUBLIC_BROWSER_BUILD_RESUMING: unchanged public context; Docker cache enabled; one-hour build limit; no database connection.');
 await runtime.docker(['build','--pull','--progress','plain','--label','potok.browser-source='+digest,'--iidfile',imageFile,context],{log:path.join(attempt,'build.log'),timeout:buildTimeout});
 const imageId=(await regular(imageFile)).toString('utf8').trim();assert.match(imageId,/^sha256:[a-f0-9]{64}$/);const image=JSON.parse(await runtime.docker(['image','inspect',imageId]))[0];
 assert.equal(image.Os,'linux');assert(['arm64','amd64'].includes(image.Architecture));assert.equal(image.Config.User,'node');assert.equal(image.Config.Labels['potok.browser-source'],digest);
 await runtime.docker(['run','--rm','--pull','never','--network','none',...runtime.sandboxArgs,imageId,'--self-check'],{log:path.join(attempt,'self-check.log'),timeout:180000});
 // docker(log=...) streams to the file; read it after completion instead of trusting stdout.
 const log=(await regular(path.join(attempt,'self-check.log'))).toString('utf8');assert(log.includes('PRIVATE_BROWSER_RUNTIME_OK'));
 const receipt={imageId,digest,architecture:image.Architecture,node:'24.22.1',playwright:'1.40.0',selfCheck:true};
 await fs.writeFile(path.join(build,'receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600,flag:'wx'});
 console.log('PRIVATE_BROWSER_RUNTIME_PREPARED_OK: public image and isolated self-check passed; original failed logs retained; no database contacted.');
 return {attempt,receipt};
}
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--resume-public-runtime');const root=await fs.realpath(args[1]),build=await fs.realpath(args[2]);
 const file=path.join(root,'scripts/security/accumulated/private-browser-runtime.mjs');assert.equal(sha(await regular(file)),runtimeHash);const runtime=await import(pathToFileURL(file));return resumePublicBuild(root,build,runtime);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('PRIVATE_BROWSER_RESUME_STOPPED: preserve original context and resume logs; no database was contacted. Do not rerun automatically.');process.exitCode=1;});
