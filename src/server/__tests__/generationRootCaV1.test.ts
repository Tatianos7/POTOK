import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {X509Certificate as NodeCertificate} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {connect, createServer, type ConnectionOptions} from 'node:tls';
import {once} from 'node:events';
import {BasicConstraintsExtension, KeyUsageFlags, SubjectAlternativeNameExtension, X509CertificateGenerator} from '@peculiar/x509';
import {generationRootCertificateFixtureV1 as certificate} from './generationRootCaFixturesV1';
import {assertGenerationRootCaV1} from '../generationRootCaV1';
import {generationStagingPgConfigV1, preparePortableStagingGenerationNodePgPoolsV1} from '../generationNodePgPoolV1';
import {createPortableStagingGenerationRuntimeV1} from '../generationRuntimeV1';

test('portable CA path verifies real signatures and matches the legacy fixed TLS configuration', async () => {
  const cert = await certificate(), ca = cert.toString('pem');
  await assertGenerationRootCaV1(ca);
  const node = new NodeCertificate(ca); assert.ok(node.ca && node.checkIssued(node) && node.verify(node.publicKey));
  const secrets = {ca, readerPassword: 'synthetic-reader', gatewayPassword: 'synthetic-gateway'};
  const nodeConfig = generationStagingPgConfigV1('reader', secrets);
  assert.equal(nodeConfig.ssl && typeof nodeConfig.ssl === 'object' && nodeConfig.ssl.rejectUnauthorized, true);
  const open = await preparePortableStagingGenerationNodePgPoolsV1(secrets), pools = open();
  await assert.rejects(pools.sourcesPool.acquire(), /GENERATION_PG_DISABLED/);
  await assert.rejects(pools.gatewayPool.acquire(), /GENERATION_PG_DISABLED/); await pools.close();
});
test('non-CA, expired, future, wrong key usage and conflicting authority key IDs fail closed', async () => {
  for (const change of [{ca: false}, {before: Date.now() - 2 * 86400000, after: Date.now() - 86400000},
    {before: Date.now() + 86400000, after: Date.now() + 2 * 86400000}, {usage: KeyUsageFlags.digitalSignature}, {aki: '010203'}]) {
    await assert.rejects(assertGenerationRootCaV1((await certificate(change)).toString('pem')), /^Error: GENERATION_PG_CONFIGURATION_INVALID$/);
  }
});
test('tampered signatures, duplicate extensions, malformed and multiple certificates are rejected', async () => {
  const cert = await certificate(), ca = cert.toString('pem');
  const der = new Uint8Array(cert.rawData); der[der.length - 1] ^= 1;
  const tampered = `-----BEGIN CERTIFICATE-----\n${Buffer.from(der).toString('base64')}\n-----END CERTIFICATE-----`;
  for (const value of [tampered, ca + ca, 'invalid', 'x'.repeat(65537), (await certificate({duplicate: true})).toString('pem')])
    await assert.rejects(assertGenerationRootCaV1(value), /^Error: GENERATION_PG_CONFIGURATION_INVALID$/);
});
test('public RSA and EC roots validate without using Node X509 issuance/verify methods', async () => {
  for (const type of ['rsa', 'ec']) {
    const ca = rootCertificates.find(pem => {
      const r = new NodeCertificate(pem);
      return r.publicKey.asymmetricKeyType === type && r.ca && r.checkIssued(r) && r.verify(r.publicKey)
        && Date.now() >= Date.parse(r.validFrom) && Date.now() < Date.parse(r.validTo);
    });
    assert.ok(ca); await assertGenerationRootCaV1(ca);
  }
});
test('portable factory snapshots secrets before verification and never accepts absent/shared passwords', async () => {
  const cert = await certificate();
  for (const passwords of [{readerPassword: '', gatewayPassword: 'x'}, {readerPassword: 'x', gatewayPassword: 'x'}])
    await assert.rejects(preparePortableStagingGenerationNodePgPoolsV1({ca: cert.toString('pem'), ...passwords}), /GENERATION_PG_CONFIGURATION_INVALID/);
  const secrets = {ca: cert.toString('pem'), readerPassword: 'reader-fixture', gatewayPassword: 'gateway-fixture'};
  const pending = preparePortableStagingGenerationNodePgPoolsV1(secrets); secrets.ca = 'invalid';
  const open = await pending, pools = open(); await pools.close();
  const clock = Date.now;
  try {Date.now = () => cert.notAfter.getTime() + 1; assert.throws(() => open(), /GENERATION_PG_CONFIGURATION_INVALID/);}
  finally {Date.now = clock;}
});
test('portable runtime uses the existing configuration-error contract for an invalid CA', async () => {
  await assert.rejects(createPortableStagingGenerationRuntimeV1({secrets: {ca: 'invalid', readerPassword: 'a', gatewayPassword: 'b'},
    comparison: 'STRICT', optimizationPolicyRaw: '{}', metricPolicyRaw: '{}', convenience: null}), /^Error: GENERATION_RUNTIME_CONFIGURATION_INVALID$/);
});

test('native TLS still accepts the valid chain and rejects wrong CA or server name', {timeout: 10000}, async () => {
  const algorithm = {name: 'ECDSA', namedCurve: 'P-256'}, signingAlgorithm = {name: 'ECDSA', hash: 'SHA-256'};
  const rootKeys = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const serverKeys = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const dates = {notBefore: new Date(Date.now() - 86400000), notAfter: new Date(Date.now() + 86400000)};
  const root = await X509CertificateGenerator.createSelfSigned({...dates, name: 'CN=local synthetic CA',
    keys: rootKeys, signingAlgorithm, extensions: [new BasicConstraintsExtension(true, undefined, true)]}, crypto);
  const host = 'db.ozidryfvhkcbtpnulakq.supabase.co';
  const leaf = await X509CertificateGenerator.create({...dates, issuer: root.subject, subject: `CN=${host}`,
    publicKey: serverKeys.publicKey, signingKey: rootKeys.privateKey, signingAlgorithm,
    extensions: [new SubjectAlternativeNameExtension([{type: 'dns', value: host}])]}, crypto);
  const ca = root.toString('pem'); await assertGenerationRootCaV1(ca);
  // Synthetic private key remains in memory only; never printed or persisted.
  const key = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', serverKeys.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
  const server = createServer({key, cert: leaf.toString('pem')}, socket => {socket.end();});
  server.on('tlsClientError', () => {}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const config = generationStagingPgConfigV1('reader', {ca, readerPassword: 'reader-fixture', gatewayPassword: 'gateway-fixture'});
  const tls = config.ssl as ConnectionOptions;
  async function handshake(change: ConnectionOptions = {}) {
    await new Promise<void>((resolve, reject) => {
      const socket = connect({...tls, ...change, host: '127.0.0.1', port});
      socket.once('secureConnect', () => {socket.destroy(); resolve();});
      socket.once('error', e => {socket.destroy(); reject(e);});
    });
  }
  try {
    await handshake();
    await assert.rejects(handshake({servername: 'wrong.invalid'}));
    await assert.rejects(handshake({ca: (await certificate()).toString('pem')}));
  } finally {await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));}
});
