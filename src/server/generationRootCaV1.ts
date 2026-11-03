import 'reflect-metadata';
import {AuthorityKeyIdentifierExtension, BasicConstraintsExtension, KeyUsagesExtension, KeyUsageFlags,
  SubjectKeyIdentifierExtension, X509Certificate} from '@peculiar/x509';

/** Portable local root validation, not proof of a CA's provenance or live TLS.
 * No global crypto provider mutation and no unsupported-method fallback.
 */
export async function assertGenerationRootCaV1(ca: string): Promise<Readonly<{notBefore: number; notAfter: number}>> {
  try {
    if (typeof ca !== 'string' || new TextEncoder().encode(ca).length > 65536
      || !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(ca)) throw Error();
    const body = ca.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
    const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
    const root = new X509Certificate(ca);
    const der = new Uint8Array(root.rawData);
    if (bytes.length !== der.length || bytes.some((b, i) => b !== der[i])) throw Error();
    if (new Set(root.extensions.map(e => e.type)).size !== root.extensions.length
      || root.getExtension(BasicConstraintsExtension)?.ca !== true) throw Error();
    const start = root.notBefore.getTime(), end = root.notAfter.getTime(), now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) throw Error();
    const usage = root.getExtension(KeyUsagesExtension);
    if (usage && !(usage.usages & KeyUsageFlags.keyCertSign)) throw Error();
    const authority = root.getExtension(AuthorityKeyIdentifierExtension), subject = root.getExtension(SubjectKeyIdentifierExtension);
    // Preserve issuer key-identifier consistency. Issuer+serial AKI variants are
    // conservatively unsupported instead of pretending to validate their names.
    if (authority?.certId || (authority?.keyId && authority.keyId !== subject?.keyId)) throw Error();
    if (!await root.isSelfSigned(globalThis.crypto)) throw Error();
    // Recheck after asynchronous signature verification, including expiry crossing.
    if (Date.now() < start || Date.now() >= end) throw Error();
    return Object.freeze({notBefore: start, notAfter: end});
  } catch {throw Error('GENERATION_PG_CONFIGURATION_INVALID');}
}
