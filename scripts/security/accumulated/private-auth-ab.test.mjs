import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connect} from 'node:net';
import {readFile} from 'node:fs/promises';
import {createMailCapture} from './private-auth-ab-worker.mjs';
import {assertOriginalRows,rowSnapshotSQL,templateEnvironment,workerArgs,workerHash} from './private-auth-ab.mjs';
import {authEnvironment} from './private-auth.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await test('original duplicate row multiplicities must survive while bounded synthetic rows are added',()=>{
 const before=[{schema:'auth',name:'users',hashes:[hash('old'),hash('old')]}],after=[{schema:'auth',name:'users',hashes:[hash('old'),hash('old'),hash('synthetic')]}];assert.deepEqual(assertOriginalRows(before,after),{originalRows:2,addedRows:1});assert.throws(()=>assertOriginalRows(before,[{...after[0],hashes:[hash('old'),hash('synthetic')]}]));
});
await test('new data outside Auth/profile scope and same-count historical tamper are rejected',()=>{
 const old=[{schema:'public',name:'food_diary_entries',hashes:[hash('preserved')]}];assert.throws(()=>assertOriginalRows(old,[{...old[0],hashes:[hash('preserved'),hash('extra')]}]));assert.throws(()=>assertOriginalRows(old,[{...old[0],hashes:[hash('changed')]}]));assert.throws(()=>rowSnapshotSQL([{schema:'private',name:'x'}]));
});
await test('mail template overrides preserve the existing key and role/cleanup guards',()=>{
 const before=authEnvironment('synthetic','a'.repeat(128)),after=templateEnvironment(before);assert.deepEqual(Object.keys(after).filter(k=>before[k]!==after[k]).sort(),['GOTRUE_MAILER_TEMPLATES_CONFIRMATION','GOTRUE_MAILER_TEMPLATES_MAGIC_LINK']);assert.equal(after.GOTRUE_JWT_SECRET,before.GOTRUE_JWT_SECRET);assert.throws(()=>templateEnvironment({...before,GOTRUE_SMTP_HOST:'external.invalid'}));
});
await test('worker command is pinned, isolated and has no master signing key or database credentials',async()=>{
 const source=await readFile(new URL('private-auth-ab-worker.mjs',import.meta.url),'utf8');assert.equal(hash(source),workerHash);const args=workerArgs({name:'potok_ab_test',dbId:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),envFile:'/private/worker.env',source});assert(!args.includes('--mount'));assert(!args.includes('--publish'));assert(!source.includes('PGPASSWORD'));assert(!source.includes('GOTRUE_JWT_SECRET'));assert.throws(()=>workerArgs({name:'potok_ab_test',dbId:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),envFile:'/private/worker.env',source:source+'\n'}));
});
const emails=['potok-ab-cafe-a@example.test','potok-ab-cafe-b@example.test'],capture=createMailCapture(emails);await capture.start();
async function smtp(){const s=connect(11025,'127.0.0.1');s.setEncoding('utf8');let buffer='',queue=[],wait=[];s.on('data',chunk=>{buffer+=chunk;for(let i;(i=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,i).replace(/\r$/,'');buffer=buffer.slice(i+1);if(wait.length)wait.shift()(line);else queue.push(line);}});const line=()=>queue.length?Promise.resolve(queue.shift()):new Promise(r=>wait.push(r));assert.match(await line(),/^220 /);return {s,line,async send(text){s.write(text+'\r\n');return line();}};}
try{
 await test('SMTP captures fragmented numeric codes locally and supports quoted-printable wrapping',async()=>{const c=await smtp();assert.match(await c.send('HELO test'),/^250-/);await c.line();assert.match(await c.send('MAIL FROM:<local@example.test>'),/^250/);assert.match(await c.send('RCPT TO:<'+emails[0]+'>'),/^250/);assert.match(await c.send('DATA'),/^354/);c.s.write('Content-Type: text/html\r\n\r\nPOTOK_OTP_BE');c.s.write('GIN123=\r\n456POTOK_OTP_END\r\n.\r\n');assert.match(await c.line(),/^250/);assert.equal(capture.codes.get(emails[0]),'123456');await c.send('QUIT');c.s.destroy();});
 await test('SMTP refuses unrelated recipients and never relays messages',async()=>{const c=await smtp();await c.send('MAIL FROM:<local@example.test>');assert.match(await c.send('RCPT TO:<owner@example.com>'),/^550/);assert.match(await c.send('DATA'),/^503/);assert.equal(capture.rejected,1);await c.send('QUIT');c.s.destroy();});
 await test('template endpoint contains only a GoTrue token placeholder, not a captured code',async()=>{const r=await fetch('http://127.0.0.1:33003/template');assert.equal(r.status,200);const text=await r.text();assert(text.includes('{{ .Token }}'));assert(!text.includes('123456'));assert.equal((await fetch('http://127.0.0.1:33003/codes')).status,404);});
}finally{capture.codes.clear();await capture.close();}
console.log('PRIVATE_AUTH_AB_UNIT_OK: '+passed+' cases; synthetic messages only');
