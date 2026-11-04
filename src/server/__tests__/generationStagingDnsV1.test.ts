import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {connect,createServer,type ConnectionOptions} from 'node:tls';
import {BasicConstraintsExtension,SubjectAlternativeNameExtension,X509CertificateGenerator} from '@peculiar/x509';
import {resolveGenerationStagingIpv6V1 as resolve,generationStagingIpv6ConfigV1 as route} from '../generationStagingDnsV1';
import {generationStagingPgConfigV1,generationStagingPgHostV1 as host} from '../generationNodePgPoolV1';
import {generationRootCertificateFixtureV1 as certificate} from './generationRootCaFixturesV1';

test('fixed-host AAAA lookup selects one current IPv6 answer without retries or logging addresses',async()=>{
  let calls=0,cancels=0;
  const address=await resolve(new AbortController().signal,()=>({async resolve6(name){calls++;assert.equal(name,host);return ['2001:db8::1','2001:db8::2'];},cancel(){cancels++;}}));
  assert.equal(address,'2001:db8::1');assert.equal(calls,1);assert.equal(cancels,0);
});
test('empty, non-IPv6, scoped and mixed replies reject with one fixed error and no fallback',async()=>{
  for(const answer of [[],['127.0.0.1'],['fe80::1%en0'],['2001:db8::1','bad'],['another.host'],new Array(17).fill('2001:db8::1')]){
    let calls=0,cancels=0;
    await assert.rejects(resolve(new AbortController().signal,()=>({async resolve6(){calls++;return answer;},cancel(){cancels++;}})),/^Error: GENERATION_DNS_UNAVAILABLE$/);
    assert.equal(calls,1);assert.equal(cancels,1);
  }
  await assert.rejects(resolve(new AbortController().signal,()=>({async resolve6(){throw Error('sensitive resolver detail');},cancel(){}})),/^Error: GENERATION_DNS_UNAVAILABLE$/);
});
test('abort and total deadline cancel a pending resolver, with no late accepted address',async()=>{
  for(const mode of ['abort','deadline']){
    const controller=new AbortController();let cancels=0,reply!:(addresses:string[])=>void;
    const pending=resolve(controller.signal,()=>({resolve6(){return new Promise(r=>{reply=r;});},cancel(){cancels++;}}),10);
    await Promise.resolve();if(mode==='abort')controller.abort();
    await assert.rejects(pending,/GENERATION_DNS_UNAVAILABLE/);reply(['2001:db8::1']);await Promise.resolve();assert.equal(cancels,1);
  }
  const controller=new AbortController();controller.abort();
  await assert.rejects(resolve(controller.signal,()=>{throw Error('MUST_NOT_CREATE');}),/GENERATION_DNS_UNAVAILABLE/);
});
test('numeric routing requires the existing exact logical TLS identity and retains all driver selectors',async()=>{
  const config=generationStagingPgConfigV1('reader',{ca:(await certificate()).toString('pem'),readerPassword:'synthetic-reader',gatewayPassword:'synthetic-gateway'});
  const routed=route(config,'2001:db8::1');assert.equal(routed.host,'2001:db8::1');assert.equal(config.host,host);
  assert.deepEqual(routed,{...config,host:'2001:db8::1'});assert.notEqual(routed.ssl,config.ssl);
  for(const address of ['127.0.0.1','host.invalid','fe80::1%en0',''])assert.throws(()=>route(config,address),/GENERATION_DNS_CONFIGURATION_INVALID/);
  assert.throws(()=>route({...config,host:'other.invalid'},'::1'),/GENERATION_DNS_CONFIGURATION_INVALID/);
  assert.throws(()=>route({...config,ssl:{...(config.ssl as ConnectionOptions),servername:'other.invalid'}},'::1'),/GENERATION_DNS_CONFIGURATION_INVALID/);
  assert.throws(()=>route({...config,ssl:{...(config.ssl as ConnectionOptions),rejectUnauthorized:false}},'::1'),/GENERATION_DNS_CONFIGURATION_INVALID/);
});
test('actual IPv6 numeric TLS transport authenticates the fixed DNS name and rejects wrong name or CA',{timeout:10000},async()=>{
  const algorithm={name:'ECDSA',namedCurve:'P-256'},signingAlgorithm={name:'ECDSA',hash:'SHA-256'};
  const rootKeys=await crypto.subtle.generateKey(algorithm,true,['sign','verify']),leafKeys=await crypto.subtle.generateKey(algorithm,true,['sign','verify']);
  const dates={notBefore:new Date(Date.now()-86400000),notAfter:new Date(Date.now()+86400000)};
  const root=await X509CertificateGenerator.createSelfSigned({...dates,name:'CN=synthetic route CA',keys:rootKeys,signingAlgorithm,
    extensions:[new BasicConstraintsExtension(true,undefined,true)]},crypto);
  const leaf=await X509CertificateGenerator.create({...dates,issuer:root.subject,subject:`CN=${host}`,publicKey:leafKeys.publicKey,
    signingKey:rootKeys.privateKey,signingAlgorithm,extensions:[new SubjectAlternativeNameExtension([{type:'dns',value:host}])]},crypto);
  const key=`-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8',leafKeys.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
  const server=createServer({key,cert:leaf.toString('pem')},socket=>socket.end());server.on('tlsClientError',()=>{});
  server.listen(0,'::1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
  const config=route(generationStagingPgConfigV1('reader',{ca:root.toString('pem'),readerPassword:'synthetic-reader',gatewayPassword:'synthetic-gateway'}),'::1');
  const handshake=(change:ConnectionOptions={})=>new Promise<void>((done,fail)=>{
    const socket=connect({...config.ssl as ConnectionOptions,...change,host:config.host,port:address.port});
    socket.once('secureConnect',()=>{socket.destroy();done();});socket.once('error',e=>{socket.destroy();fail(e);});
  });
  try{await handshake();await assert.rejects(handshake({servername:'wrong.invalid'}));await assert.rejects(handshake({ca:(await certificate()).toString('pem')}));}
  finally{await new Promise<void>((done,fail)=>server.close(e=>e?fail(e):done()));}
});
