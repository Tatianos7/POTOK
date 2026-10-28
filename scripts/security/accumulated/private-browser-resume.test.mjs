import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dockerfile,sandboxArgs} from './private-browser-runtime.mjs';
import {validateContext,resumePublicBuild,buildTimeout} from './private-browser-resume.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'potok-resume-test-')),publicDir=await fs.mkdtemp(path.join(parent,'potok-public-browser-source.')),root=path.join(publicDir,'source'),build=path.join(parent,'private-browser-build-Test123'),context=path.join(build,'context');
 await fs.mkdir(path.join(root,'scripts/security/accumulated'),{recursive:true});await fs.mkdir(path.join(context,'src'),{recursive:true});await fs.copyFile(new URL('private-browser-runtime.mjs',import.meta.url),path.join(root,'scripts/security/accumulated/private-browser-runtime.mjs'));
 await fs.writeFile(path.join(context,'src/a.ts'),'public source');await fs.writeFile(path.join(context,'Dockerfile'),dockerfile);await fs.writeFile(path.join(build,'build.log'),'old canceled build');
 const entries=[{path:'src/a.ts',sha256:hash('public source')}],digest='a'.repeat(64),imageId='sha256:'+'b'.repeat(64),calls=[];
 const runtime={dockerfile,sandboxArgs,runtimeInputs:async()=>({entries,digest}),async docker(args,opts={}){calls.push({args,opts});if(args[0]==='context')return JSON.stringify('unix:///local.sock');if(args[0]==='build'){await fs.writeFile(args[args.indexOf('--iidfile')+1],imageId);await fs.writeFile(opts.log,'build complete');return '';}if(args[0]==='image')return JSON.stringify([{Os:'linux',Architecture:'arm64',Config:{User:'node',Labels:{'potok.browser-source':digest}}}]);if(args[0]==='run'){await fs.writeFile(opts.log,'PRIVATE_BROWSER_RUNTIME_OK: public self-check');return '';}throw Error('Unexpected command');}};
 return {parent,root,build,context,runtime,calls,digest,imageId,async close(){await fs.rm(parent,{recursive:true,force:true});}};
}
test('unchanged public context resumes with cache and one-hour limit; isolated self-check alone permits receipt',async(t)=>{t.mock.method(console,'log',()=>{});
 const f=await fixture();try{const result=await resumePublicBuild(f.root,f.build,f.runtime);assert.equal(buildTimeout,3600000);assert.equal(result.receipt.imageId,f.imageId);assert.equal(result.receipt.digest,f.digest);assert.equal(result.receipt.selfCheck,true);
 const build=f.calls.find(c=>c.args[0]==='build');assert.equal(build.opts.timeout,3600000);assert(!build.args.includes('--no-cache'));assert.equal(build.args.at(-1),f.context);
 const run=f.calls.find(c=>c.args[0]==='run');assert.deepEqual(run.args,['run','--rm','--pull','never','--network','none',...sandboxArgs,f.imageId,'--self-check']);assert.equal(run.opts.timeout,180000);assert.equal(await fs.readFile(path.join(f.build,'build.log'),'utf8'),'old canceled build');assert.equal(await fs.readFile(path.join(f.context,'src/a.ts'),'utf8'),'public source');
 assert.equal((await fs.stat(path.join(f.build,'receipt.json'))).mode&0o777,0o600);assert.equal((await fs.stat(result.attempt)).mode&0o777,0o700);
 await assert.rejects(resumePublicBuild(f.root,f.build,f.runtime));assert.equal(f.calls.filter(c=>c.args[0]==='build').length,1);
 }finally{await f.close();}
});
test('changed/extra/symlink source, changed Dockerfile/runtime and an existing image result stop before Docker',async(t)=>{t.mock.method(console,'log',()=>{});
 for(const change of [f=>fs.writeFile(path.join(f.context,'src/a.ts'),'changed'),f=>fs.writeFile(path.join(f.context,'.env'),'private'),f=>fs.symlink('/tmp',path.join(f.context,'escape')),f=>fs.writeFile(path.join(f.context,'Dockerfile'),dockerfile+'\n'),f=>fs.writeFile(path.join(f.root,'scripts/security/accumulated/private-browser-runtime.mjs'),'changed'),f=>fs.writeFile(path.join(f.build,'image-id.txt'),'existing')]){const f=await fixture();try{await change(f);await assert.rejects(resumePublicBuild(f.root,f.build,f.runtime));assert.equal(f.calls.length,0);}finally{await f.close();}}
});
test('build/self-check failures retain logs and cannot create success receipt',async(t)=>{t.mock.method(console,'log',()=>{});
 for(const stage of ['build','run']){const f=await fixture();const original=f.runtime.docker;f.runtime.docker=async(args,opts)=>{if(args[0]===stage){await fs.writeFile(opts.log,'simulated failed public operation');throw Error('stopped');}return original(args,opts);};try{await assert.rejects(resumePublicBuild(f.root,f.build,f.runtime));await assert.rejects(fs.stat(path.join(f.build,'receipt.json')),{code:'ENOENT'});assert.equal(await fs.readFile(path.join(f.build,'build.log'),'utf8'),'old canceled build');const attempts=(await fs.readdir(f.build)).filter(n=>n.startsWith('resume.'));assert.equal(attempts.length,1);assert((await fs.readFile(path.join(f.build,attempts[0],stage==='build'?'build.log':'self-check.log'),'utf8')).includes('simulated failed'));}finally{await f.close();}}
});
test('wrong image label/non-root contract or missing self-check marker never passes',async(t)=>{t.mock.method(console,'log',()=>{});
 for(const variant of ['label','user','marker']){const f=await fixture();const original=f.runtime.docker;f.runtime.docker=async(args,opts)=>{if(args[0]==='image'){const image=JSON.parse(await original(args,opts));if(variant==='label')image[0].Config.Labels['potok.browser-source']='changed';if(variant==='user')image[0].Config.User='root';return JSON.stringify(image);}if(args[0]==='run'&&variant==='marker'){await fs.writeFile(opts.log,'no success marker');return '';}return original(args,opts);};try{await assert.rejects(resumePublicBuild(f.root,f.build,f.runtime));await assert.rejects(fs.stat(path.join(f.build,'receipt.json')),{code:'ENOENT'});}finally{await f.close();}}
});
test('public-root binding and unsupported CLI modes cannot target an arbitrary context or database',async(t)=>{t.mock.method(console,'log',()=>{});
 const f=await fixture();try{await assert.rejects(validateContext('/unrelated/source',f.build,f.runtime));assert.equal(f.calls.length,0);}finally{await f.close();}
 const file=fileURLToPath(new URL('private-browser-resume.mjs',import.meta.url));for(const args of [['--apply'],['--resume-public-runtime','https://example.invalid']]){const r=spawnSync(process.execPath,[file,...args],{encoding:'utf8'});assert.equal(r.status,1);assert(r.stderr.includes('PRIVATE_BROWSER_RESUME_STOPPED'));assert(!r.stderr.includes('example.invalid'));}
});
