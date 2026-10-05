import { decodeMealCompositionPolicyV1, type MealCompositionPolicyV1 } from './adaptiveNutritionMealCompositionV1';
import { decodeBalancePolicyV1, type BalancePolicyV1 } from './adaptiveNutritionMealBalanceV1';
import { decodeTrustedGenerationInputV1, trustedGenerationInputDigestV1 } from './adaptiveNutritionGraphV2';
import { decodeTrustedValidationEvidenceV1, type TrustedValidationEvidenceContextV1 } from './trustedValidationEvidenceV1';
import { assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';

export const compositionPolicySnapshotContractV1 = 'potok-composition-policy-snapshot-v1' as const;
export const balancePolicySnapshotContractV1 = 'potok-balance-policy-snapshot-v1' as const;
export const trustedValidationPoliciesContractV1 = 'potok-trusted-validation-policies-v1' as const;
export const compositionPolicySnapshotEncodingV1 = 'potok-composition-policy-snapshot-canonical-json-v1' as const;
export const balancePolicySnapshotEncodingV1 = 'potok-balance-policy-snapshot-canonical-json-v1' as const;
export const trustedValidationPoliciesEncodingV1 = 'potok-trusted-validation-policies-canonical-json-v1' as const;

export interface CompositionPolicySnapshotV1 {
  contract: typeof compositionPolicySnapshotContractV1;
  policy: MealCompositionPolicyV1;
  digest: string;
}
export interface BalancePolicySnapshotV1 {
  contract: typeof balancePolicySnapshotContractV1;
  policy: BalancePolicyV1;
  digest: string;
}
export interface TrustedValidationPoliciesV1 {
  contract: typeof trustedValidationPoliciesContractV1;
  generationInputDigest: string;
  validationEvidenceDigest: string;
  composition: CompositionPolicySnapshotV1;
  balance: BalancePolicySnapshotV1;
  digest: string;
}
/** Versioned transport wrapper. Every authority payload is independently parsed raw JSON. */
export const trustedValidationPoliciesRawBoundaryContractV2 = 'potok-trusted-validation-policies-raw-boundary-v2' as const;
export interface TrustedValidationPoliciesRawContextV2 {
  contract: typeof trustedValidationPoliciesRawBoundaryContractV2;
  trustedGenerationInputRaw: string;
  candidateManifestRaw: string;
  preferenceSnapshotRaw: string;
  safetySnapshotRaw: string;
  trustedValidationEvidenceRaw: string;
}
interface OwnedContextV2 extends TrustedValidationEvidenceContextV1 { evidence: unknown }
type OwnedJsonV2 = null | string | boolean | number | OwnedJsonV2[] | { [key: string]: OwnedJsonV2 };
const hashPattern = /^[0-9a-f]{64}$/;
/** Only this parser admits external values. No object serialization/coercion bridge exists. */
function parseRawV2(raw: unknown): OwnedJsonV2 {
  if (typeof raw !== 'string') throw new Error('RAW_JSON_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  const owned: OwnedJsonV2 = JSON.parse(raw);
  assertOwnedNumbersV2(owned);
  return owned;
}
// Private: callers can only reach this walk through JSON.parse-created or normalized data.
function assertOwnedNumbersV2(value: OwnedJsonV2): void {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
    throw new Error('INVALID_POLICY_JSON_NUMBER');
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) assertOwnedNumbersV2(value[index]);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) assertOwnedNumbersV2(value[key]);
  }
}
// Private object helpers never receive arbitrary external JS object graphs.
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.prototype.hasOwnProperty.call(value,key))) {
    throw new Error('INVALID_POLICY_FIELDS');
  }
  return value as Record<string, unknown>;
}
function canonical(value: OwnedJsonV2): string {
  if (Array.isArray(value)) {
    let result = '[';
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) result += ',';
      result += canonical(value[index]);
    }
    return `${result}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function bytes(contract: string, encoding: string, content: unknown): Uint8Array {
  // content is exclusively private normalized output, never externally supplied objects.
  const envelope = { contract, encoding, policy: content } as OwnedJsonV2;
  assertOwnedNumbersV2(envelope);
  return new TextEncoder().encode(canonical(envelope));
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
function verifyDigest(supplied: unknown, expected: string): void {
  if (typeof supplied !== 'string' || !hashPattern.test(supplied) || supplied !== expected) {
    throw new Error('POLICY_DIGEST_MISMATCH');
  }
}
function revision(actual: string, expected: string): void {
  if (actual !== expected) throw new Error('POLICY_REVISION_MISMATCH');
}
function parseContextV2(raw: unknown): OwnedContextV2 {
  const row = record(parseRawV2(raw), ['contract','trustedGenerationInputRaw','candidateManifestRaw',
    'preferenceSnapshotRaw','safetySnapshotRaw','trustedValidationEvidenceRaw']);
  if (row.contract !== trustedValidationPoliciesRawBoundaryContractV2) throw new Error('INVALID_RAW_BOUNDARY_CONTRACT');
  // Each nested primitive string gets its own duplicate-aware parser before any decoder.
  return { input: parseRawV2(row.trustedGenerationInputRaw), manifest: parseRawV2(row.candidateManifestRaw),
    preference: parseRawV2(row.preferenceSnapshotRaw), safety: parseRawV2(row.safetySnapshotRaw),
    evidence: parseRawV2(row.trustedValidationEvidenceRaw) };
}
async function decodeCompositionOwnedV2(value: unknown, input: unknown): Promise<CompositionPolicySnapshotV1> {
  const row = record(value,['contract','policy','digest']);
  if (row.contract !== compositionPolicySnapshotContractV1) throw new Error('INVALID_COMPOSITION_POLICY_CONTRACT');
  const policy = decodeMealCompositionPolicyV1(row.policy);
  revision(policy.policyRevision,decodeTrustedGenerationInputV1(input).compositionPolicyRevision);
  const content = { contract: compositionPolicySnapshotContractV1, policy };
  const digest = await adaptiveNutritionSha256HexV1(bytes(compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1,content));
  verifyDigest(row.digest,digest);
  return frozen({ ...content,digest });
}
async function decodeBalanceOwnedV2(value: unknown, input: unknown): Promise<BalancePolicySnapshotV1> {
  const row = record(value,['contract','policy','digest']);
  if (row.contract !== balancePolicySnapshotContractV1) throw new Error('INVALID_BALANCE_POLICY_CONTRACT');
  const policy = decodeBalancePolicyV1(row.policy);
  revision(policy.policyRevision,decodeTrustedGenerationInputV1(input).validationPolicyRevision);
  const content = { contract: balancePolicySnapshotContractV1, policy };
  const digest = await adaptiveNutritionSha256HexV1(bytes(balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1,content));
  verifyDigest(row.digest,digest);
  return frozen({ ...content,digest });
}
async function decodeAggregateOwnedV2(value: unknown, context: OwnedContextV2): Promise<TrustedValidationPoliciesV1> {
  const row = record(value,['contract','generationInputDigest','validationEvidenceDigest','composition','balance','digest']);
  const input = decodeTrustedGenerationInputV1(context.input);
  const evidence = await decodeTrustedValidationEvidenceV1(context.evidence,context);
  const inputDigest = await trustedGenerationInputDigestV1(input);
  if (row.contract !== trustedValidationPoliciesContractV1 || row.generationInputDigest !== inputDigest
    || row.validationEvidenceDigest !== evidence.digest) throw new Error('POLICY_AGGREGATE_BINDING_MISMATCH');
  const composition = await decodeCompositionOwnedV2(row.composition,input);
  const balance = await decodeBalanceOwnedV2(row.balance,input);
  revision(composition.policy.policyRevision,evidence.compositionPolicyRevision);
  revision(balance.policy.policyRevision,evidence.validationPolicyRevision);
  const content = { contract: trustedValidationPoliciesContractV1,generationInputDigest: inputDigest,
    validationEvidenceDigest: evidence.digest,composition,balance };
  const digest = await adaptiveNutritionSha256HexV1(bytes(trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1,content));
  verifyDigest(row.digest,digest);
  return frozen({ ...content,digest });
}
/** All public runtime arguments are primitive JSON strings; snapshots prove integrity, not provenance. */
export async function decodeCompositionPolicySnapshotRawV2(raw: string, trustedInputRaw: string): Promise<CompositionPolicySnapshotV1> {
  const owned = parseRawV2(raw);
  const input = parseRawV2(trustedInputRaw);
  return decodeCompositionOwnedV2(owned,input);
}
export async function decodeBalancePolicySnapshotRawV2(raw: string, trustedInputRaw: string): Promise<BalancePolicySnapshotV1> {
  const owned = parseRawV2(raw);
  const input = parseRawV2(trustedInputRaw);
  return decodeBalanceOwnedV2(owned,input);
}
export async function decodeTrustedValidationPoliciesRawV2(raw: string, trustedContextRaw: string): Promise<TrustedValidationPoliciesV1> {
  const owned = parseRawV2(raw);
  const context = parseContextV2(trustedContextRaw);
  return decodeAggregateOwnedV2(owned,context);
}
export async function compositionPolicySnapshotCanonicalBytesRawV2(raw: string, trustedInputRaw: string): Promise<Uint8Array> {
  const snapshot = await decodeCompositionPolicySnapshotRawV2(raw,trustedInputRaw);
  const content: Record<string, unknown> = { ...snapshot };
  delete content.digest;
  return bytes(compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1,content);
}
export async function balancePolicySnapshotCanonicalBytesRawV2(raw: string, trustedInputRaw: string): Promise<Uint8Array> {
  const snapshot = await decodeBalancePolicySnapshotRawV2(raw,trustedInputRaw);
  const content: Record<string, unknown> = { ...snapshot };
  delete content.digest;
  return bytes(balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1,content);
}
export async function trustedValidationPoliciesCanonicalBytesRawV2(raw: string, trustedContextRaw: string): Promise<Uint8Array> {
  const snapshot = await decodeTrustedValidationPoliciesRawV2(raw,trustedContextRaw);
  const content: Record<string, unknown> = { ...snapshot };
  delete content.digest;
  return bytes(trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1,content);
}
/** Both pinned strings and context originate independently from the trusted caller/source. */
export async function assertTrustedValidationPoliciesPinnedRawV2(proposedRaw: string, pinnedRaw: string,
  trustedContextRaw: string): Promise<TrustedValidationPoliciesV1> {
  const proposed = parseRawV2(proposedRaw);
  const pinned = parseRawV2(pinnedRaw);
  const context = parseContextV2(trustedContextRaw);
  const authority = await decodeAggregateOwnedV2(pinned,context);
  const candidate = await decodeAggregateOwnedV2(proposed,context);
  if (candidate.digest !== authority.digest) throw new Error('TRUSTED_VALIDATION_POLICIES_SUBSTITUTION');
  return authority;
}
