import {
  sealAdaptiveNutritionCandidateManifestV2, adaptiveNutritionCandidateManifestCanonicalBytesV2,
  sealNutritionPreferenceSnapshotV1, nutritionPreferenceSnapshotCanonicalBytesV1,
  sealNutritionSafetySnapshotV1, nutritionSafetySnapshotCanonicalBytesV1,
} from '../utils/adaptiveNutritionAuthoritiesV1';
import { decodeTrustedGenerationInputRawV1, trustedGenerationInputDigestV1 } from '../utils/adaptiveNutritionGraphV2';
import { assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1, canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { decodeTrustedValidationPoliciesRawV2, trustedValidationPoliciesRawBoundaryContractV2 } from '../utils/trustedValidationPoliciesV1';
import {
  generationValidationAuthorityContractV1, type GenerationValidationAuthorityPortV1,
} from './generationValidationAdapterV1';

export const generationValidationSourceContractV1 = 'potok-generation-validation-source-v1' as const;
export interface StoredGenerationCanonicalV1 { canonicalHex: string; storageSha256: string }
export interface StoredGenerationInputV1 { canonicalHex: string; generationInputDigest: string }
export interface GenerationValidationSourceV1 {
  contract: typeof generationValidationSourceContractV1;
  requestOperationId: string;
  accountId: string;
  evaluatedPlanRawSha256: string;
  input: StoredGenerationInputV1 | null;
  manifest: StoredGenerationCanonicalV1 | null;
  preference: StoredGenerationCanonicalV1 | null;
  safety: StoredGenerationCanonicalV1 | null;
  validationEvidenceRaw: string | null;
  policiesRaw: string | null;
  warningEvidenceRaw: string | null;
}

/**
 * Trusted server storage boundary, not a browser/generator provider. A future DB
 * implementation must read request, authorization/currentness and all pinned
 * sources in one consistent snapshot, preserving actual stored bytes and hashes.
 * This module does not install that DB implementation or mint publication evidence.
 */
export interface GenerationValidationSourceStoreV1 {
  readSnapshotRaw(requestOperationId: string, proposalRawSha256: string): Promise<string | null>;
}

export class GenerationValidationSourceErrorV1 extends Error {
  constructor(readonly code: 'INVALID_SOURCE_ARGUMENT' | 'INVALID_SOURCE_PACKAGE' | 'SOURCE_BINDING_MISMATCH'
    | 'STORAGE_DIGEST_MISMATCH' | 'STORAGE_CANONICAL_MISMATCH') {
    super(code); this.name = 'GenerationValidationSourceErrorV1';
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;
const hex = /^(?:[0-9a-f]{2})+$/;
const sourceKeys = ['contract', 'requestOperationId', 'accountId', 'evaluatedPlanRawSha256', 'input',
  'manifest', 'preference', 'safety', 'validationEvidenceRaw', 'policiesRaw', 'warningEvidenceRaw'] as const;

function parse(raw: string): unknown {
  if (typeof raw !== 'string') throw new GenerationValidationSourceErrorV1('INVALID_SOURCE_PACKAGE');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(value, k))) {
    throw new GenerationValidationSourceErrorV1('INVALID_SOURCE_PACKAGE');
  }
  return value as Record<string, unknown>;
}
function bytesHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function descriptor(value: unknown): StoredGenerationCanonicalV1 {
  const row = record(value, ['canonicalHex', 'storageSha256']);
  if (typeof row.canonicalHex !== 'string' || !hex.test(row.canonicalHex)
    || typeof row.storageSha256 !== 'string' || !digest.test(row.storageSha256)) {
    throw new GenerationValidationSourceErrorV1('INVALID_SOURCE_PACKAGE');
  }
  return { canonicalHex: row.canonicalHex, storageSha256: row.storageSha256 };
}
function inputDescriptor(value: unknown): StoredGenerationInputV1 {
  const row = record(value, ['canonicalHex', 'generationInputDigest']);
  if (typeof row.canonicalHex !== 'string' || !hex.test(row.canonicalHex)
    || typeof row.generationInputDigest !== 'string' || !digest.test(row.generationInputDigest)) {
    throw new GenerationValidationSourceErrorV1('INVALID_SOURCE_PACKAGE');
  }
  return { canonicalHex: row.canonicalHex, generationInputDigest: row.generationInputDigest };
}
function decodeBytes(canonicalHex: string): { raw: string; value: unknown; canonicalHex: string } {
  const bytes = Uint8Array.from(canonicalHex.match(/../g)!, byte => parseInt(byte, 16));
  // Preserve a BOM as content so the strict JSON/canonical boundary rejects it;
  // the default decoder would silently strip those stored bytes.
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  return { raw, value: parse(raw), canonicalHex };
}
async function stored(value: unknown): Promise<{ raw: string; value: unknown; canonicalHex: string }> {
  const row = descriptor(value);
  const bytes = Uint8Array.from(row.canonicalHex.match(/../g)!, byte => parseInt(byte, 16));
  if (await adaptiveNutritionSha256HexV1(bytes) !== row.storageSha256) {
    throw new GenerationValidationSourceErrorV1('STORAGE_DIGEST_MISMATCH');
  }
  return decodeBytes(row.canonicalHex);
}

/** Inactive storage-to-consumer projection; no credentials, SQL execution or writes. */
export function createGenerationValidationAuthorityLoaderV1(store: GenerationValidationSourceStoreV1): GenerationValidationAuthorityPortV1 {
  return Object.freeze({
    async loadForProposalRaw(requestOperationId: string, proposalRawSha256: string): Promise<string | null> {
      if (typeof requestOperationId !== 'string' || !uuid.test(requestOperationId)
        || typeof proposalRawSha256 !== 'string' || !digest.test(proposalRawSha256)) {
        throw new GenerationValidationSourceErrorV1('INVALID_SOURCE_ARGUMENT');
      }
      const snapshotRaw = await store.readSnapshotRaw(requestOperationId, proposalRawSha256);
      if (snapshotRaw === null) return null;
      const row = record(parse(snapshotRaw), sourceKeys);
      if (row.contract !== generationValidationSourceContractV1 || row.requestOperationId !== requestOperationId
        || row.evaluatedPlanRawSha256 !== proposalRawSha256 || typeof row.accountId !== 'string' || !uuid.test(row.accountId)) {
        throw new GenerationValidationSourceErrorV1('SOURCE_BINDING_MISMATCH');
      }
      // Null means an explicitly missing row/source, never implicit defaults. Reject
      // malformed provided values even when a different prerequisite is absent.
      for (const field of ['validationEvidenceRaw', 'policiesRaw', 'warningEvidenceRaw'] as const) {
        if (row[field] !== null) parse(row[field] as string);
      }
      if (row.input !== null) inputDescriptor(row.input);
      for (const field of ['manifest', 'preference', 'safety'] as const) {
        if (row[field] !== null) descriptor(row[field]);
      }
      if (sourceKeys.some(key => row[key] === null)) return null;
      const inputRecord = inputDescriptor(row.input);
      const inputSource = decodeBytes(inputRecord.canonicalHex);
      const input = decodeTrustedGenerationInputRawV1(inputSource.raw);
      if (canonicalJsonV1(input, 'SAFE_INTEGER') !== inputSource.raw) {
        throw new GenerationValidationSourceErrorV1('STORAGE_CANONICAL_MISMATCH');
      }
      // Actual generation_requests_v2.generation_input_digest uses the existing
      // {contract,input} domain, unlike manifest/preference/safety storage hashes.
      const generationInputDigest = await trustedGenerationInputDigestV1(input);
      if (generationInputDigest !== inputRecord.generationInputDigest) {
        throw new GenerationValidationSourceErrorV1('STORAGE_DIGEST_MISMATCH');
      }
      if (input.accountId !== row.accountId || input.operation.requestId !== requestOperationId) {
        throw new GenerationValidationSourceErrorV1('SOURCE_BINDING_MISMATCH');
      }
      const manifestSource = await stored(row.manifest);
      const preferenceSource = await stored(row.preference);
      const safetySource = await stored(row.safety);
      // Only parser-owned DB content enters existing seal functions. These compute
      // existing content digests; they confer no approval, publication or provenance.
      const manifest = await sealAdaptiveNutritionCandidateManifestV2(manifestSource.value as Parameters<typeof sealAdaptiveNutritionCandidateManifestV2>[0]);
      const preference = await sealNutritionPreferenceSnapshotV1(preferenceSource.value as Parameters<typeof sealNutritionPreferenceSnapshotV1>[0]);
      const safety = await sealNutritionSafetySnapshotV1(safetySource.value as Parameters<typeof sealNutritionSafetySnapshotV1>[0]);
      if (bytesHex(await adaptiveNutritionCandidateManifestCanonicalBytesV2(manifest)) !== manifestSource.canonicalHex
        || bytesHex(await nutritionPreferenceSnapshotCanonicalBytesV1(preference)) !== preferenceSource.canonicalHex
        || bytesHex(await nutritionSafetySnapshotCanonicalBytesV1(safety)) !== safetySource.canonicalHex) {
        throw new GenerationValidationSourceErrorV1('STORAGE_CANONICAL_MISMATCH');
      }
      if (manifest.manifestRevision !== input.candidateManifestRevision || manifest.digest !== input.candidateManifestDigest
        || preference.accountId !== input.accountId || preference.revisionId !== input.preferenceRevision
        || safety.accountId !== input.accountId || safety.revisionId !== input.safetyRevision) {
        throw new GenerationValidationSourceErrorV1('SOURCE_BINDING_MISMATCH');
      }
      // This is serialization of our own raw-string wrapper and parser-owned,
      // strictly decoded snapshots. It is not JSON.stringify(arbitraryObject).
      const trustedContextRaw = JSON.stringify({ contract: trustedValidationPoliciesRawBoundaryContractV2,
        trustedGenerationInputRaw: inputSource.raw, candidateManifestRaw: JSON.stringify(manifest),
        preferenceSnapshotRaw: JSON.stringify(preference), safetySnapshotRaw: JSON.stringify(safety),
        trustedValidationEvidenceRaw: row.validationEvidenceRaw });
      await decodeTrustedValidationPoliciesRawV2(row.policiesRaw as string, trustedContextRaw);
      return JSON.stringify({ contract: generationValidationAuthorityContractV1, requestOperationId,
        accountId: input.accountId, generationInputDigest,
        evaluatedPlanRawSha256: proposalRawSha256, trustedContextRaw,
        pinnedPoliciesRaw: row.policiesRaw, pinnedWarningEvidenceRaw: row.warningEvidenceRaw });
    },
  });
}
