// Generates synthetic public CA test material. Private keys never leave memory.
import 'reflect-metadata';
import {AuthorityKeyIdentifierExtension, BasicConstraintsExtension, KeyUsagesExtension, KeyUsageFlags, SubjectKeyIdentifierExtension, X509CertificateGenerator} from '@peculiar/x509';
export async function generationRootCertificateFixtureV1(change: {ca?: boolean; before?: number; after?: number; usage?: number; aki?: string; duplicate?: boolean} = {}) {
  const keys = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const ski = await SubjectKeyIdentifierExtension.create(keys.publicKey, false, crypto);
  const basic = new BasicConstraintsExtension(change.ca ?? true, undefined, true);
  return X509CertificateGenerator.createSelfSigned({serialNumber: '01', name: 'CN=POTOK synthetic test root',
    notBefore: new Date(change.before ?? Date.now() - 86400000), notAfter: new Date(change.after ?? Date.now() + 86400000),
    keys, signingAlgorithm: {name: 'ECDSA', hash: 'SHA-256'}, extensions: [basic,
      new KeyUsagesExtension(change.usage ?? KeyUsageFlags.keyCertSign, true), ski,
      new AuthorityKeyIdentifierExtension(change.aki ?? ski.keyId), ...(change.duplicate ? [basic] : [])]}, crypto);
}
