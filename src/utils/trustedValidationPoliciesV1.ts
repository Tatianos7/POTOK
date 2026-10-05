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
/** Every context field is independently supplied by a trusted caller. Never generator data. */
export interface TrustedValidationPoliciesContextV1 extends TrustedValidationEvidenceContextV1 {
  evidence: unknown;
}
const digestPattern = /^[0-9a-f]{64}$/;
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length || !keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable === true && 'value' in descriptor;
    })) throw new Error('INVALID_POLICY_FIELDS');
  return value as Record<string, unknown>;
}
function exactJson(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return;
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw new Error('INVALID_POLICY_ARRAY');
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) throw new Error('INVALID_POLICY_ARRAY');
      exactJson(descriptor.value);
    }
    return;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new Error('INVALID_POLICY_KEY');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('INVALID_POLICY_PROPERTY');
      exactJson(descriptor.value);
    }
    return;
  }
  throw new Error('INVALID_POLICY_JSON');
}
function canonical(value: unknown): string {
  exactJson(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function bytes(contract: string, encoding: string, content: unknown): Uint8Array {
  return new TextEncoder().encode(canonical({ contract, encoding, policy: content }));
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) throw new Error('INVALID_POLICY_DIGEST');
  return value;
}
function revision(actual: string, expected: string): void {
  if (actual !== expected) throw new Error('POLICY_REVISION_MISMATCH');
}
function compositionContent(value: unknown, input: unknown): Omit<CompositionPolicySnapshotV1, 'digest'> {
  exactJson(value);
  const row = record(value, ['contract', 'policy']);
  if (row.contract !== compositionPolicySnapshotContractV1) throw new Error('INVALID_COMPOSITION_POLICY_CONTRACT');
  const policy = decodeMealCompositionPolicyV1(row.policy);
  revision(policy.policyRevision, decodeTrustedGenerationInputV1(input).compositionPolicyRevision);
  // Policy pattern order is retained: existing composer tie-breaking uses supplied pattern order.
  return { contract: compositionPolicySnapshotContractV1, policy };
}
function balanceContent(value: unknown, input: unknown): Omit<BalancePolicySnapshotV1, 'digest'> {
  exactJson(value);
  const row = record(value, ['contract', 'policy']);
  if (row.contract !== balancePolicySnapshotContractV1) throw new Error('INVALID_BALANCE_POLICY_CONTRACT');
  const policy = decodeBalancePolicyV1(row.policy);
  revision(policy.policyRevision, decodeTrustedGenerationInputV1(input).validationPolicyRevision);
  return { contract: balancePolicySnapshotContractV1, policy };
}
export function compositionPolicySnapshotCanonicalBytesV1(value: unknown, input: unknown): Uint8Array {
  return bytes(compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1, compositionContent(value, input));
}
export function balancePolicySnapshotCanonicalBytesV1(value: unknown, input: unknown): Uint8Array {
  return bytes(balancePolicySnapshotContractV1, balancePolicySnapshotEncodingV1, balanceContent(value, input));
}
export async function sealCompositionPolicySnapshotV1(value: Omit<CompositionPolicySnapshotV1, 'digest'>,
  input: unknown): Promise<CompositionPolicySnapshotV1> {
  const content = compositionContent(value, input);
  return frozen({ ...content, digest: await adaptiveNutritionSha256HexV1(compositionPolicySnapshotCanonicalBytesV1(content, input)) });
}
export async function sealBalancePolicySnapshotV1(value: Omit<BalancePolicySnapshotV1, 'digest'>,
  input: unknown): Promise<BalancePolicySnapshotV1> {
  const content = balanceContent(value, input);
  return frozen({ ...content, digest: await adaptiveNutritionSha256HexV1(balancePolicySnapshotCanonicalBytesV1(content, input)) });
}
export async function decodeCompositionPolicySnapshotV1(value: unknown, input: unknown): Promise<CompositionPolicySnapshotV1> {
  const row = record(value, ['contract', 'policy', 'digest']);
  const decoded = await sealCompositionPolicySnapshotV1({ contract: row.contract, policy: row.policy } as Omit<CompositionPolicySnapshotV1, 'digest'>, input);
  if (digest(row.digest) !== decoded.digest) throw new Error('COMPOSITION_POLICY_DIGEST_MISMATCH');
  return decoded;
}
export async function decodeBalancePolicySnapshotV1(value: unknown, input: unknown): Promise<BalancePolicySnapshotV1> {
  const row = record(value, ['contract', 'policy', 'digest']);
  const decoded = await sealBalancePolicySnapshotV1({ contract: row.contract, policy: row.policy } as Omit<BalancePolicySnapshotV1, 'digest'>, input);
  if (digest(row.digest) !== decoded.digest) throw new Error('BALANCE_POLICY_DIGEST_MISMATCH');
  return decoded;
}
export async function decodeCompositionPolicySnapshotRawV1(raw: string, input: unknown): Promise<CompositionPolicySnapshotV1> {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return decodeCompositionPolicySnapshotV1(JSON.parse(raw), input);
}
export async function decodeBalancePolicySnapshotRawV1(raw: string, input: unknown): Promise<BalancePolicySnapshotV1> {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return decodeBalancePolicySnapshotV1(JSON.parse(raw), input);
}
async function aggregateContent(value: unknown, context: TrustedValidationPoliciesContextV1): Promise<Omit<TrustedValidationPoliciesV1, 'digest'>> {
  const row = record(value, ['contract', 'generationInputDigest', 'validationEvidenceDigest', 'composition', 'balance']);
  const input = decodeTrustedGenerationInputV1(context.input);
  const evidence = await decodeTrustedValidationEvidenceV1(context.evidence, context);
  const inputDigest = await trustedGenerationInputDigestV1(input);
  if (row.contract !== trustedValidationPoliciesContractV1 || row.generationInputDigest !== inputDigest
    || row.validationEvidenceDigest !== evidence.digest) throw new Error('POLICY_AGGREGATE_BINDING_MISMATCH');
  const composition = await decodeCompositionPolicySnapshotV1(row.composition, input);
  const balance = await decodeBalancePolicySnapshotV1(row.balance, input);
  revision(composition.policy.policyRevision, evidence.compositionPolicyRevision);
  revision(balance.policy.policyRevision, evidence.validationPolicyRevision);
  return { contract: trustedValidationPoliciesContractV1, generationInputDigest: inputDigest,
    validationEvidenceDigest: evidence.digest, composition, balance };
}
export async function sealTrustedValidationPoliciesV1(value: Omit<TrustedValidationPoliciesV1, 'digest'>,
  context: TrustedValidationPoliciesContextV1): Promise<TrustedValidationPoliciesV1> {
  const content = await aggregateContent(value, context);
  return frozen({ ...content, digest: await adaptiveNutritionSha256HexV1(bytes(trustedValidationPoliciesContractV1,
    trustedValidationPoliciesEncodingV1, content)) });
}
export async function decodeTrustedValidationPoliciesV1(value: unknown,
  context: TrustedValidationPoliciesContextV1): Promise<TrustedValidationPoliciesV1> {
  const row = record(value, ['contract', 'generationInputDigest', 'validationEvidenceDigest', 'composition', 'balance', 'digest']);
  const content = { ...row }; delete content.digest;
  const decoded = await sealTrustedValidationPoliciesV1(content as unknown as Omit<TrustedValidationPoliciesV1, 'digest'>, context);
  if (digest(row.digest) !== decoded.digest) throw new Error('POLICY_AGGREGATE_DIGEST_MISMATCH');
  return decoded;
}
export async function decodeTrustedValidationPoliciesRawV1(raw: string,
  context: TrustedValidationPoliciesContextV1): Promise<TrustedValidationPoliciesV1> {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return decodeTrustedValidationPoliciesV1(JSON.parse(raw), context);
}
export async function trustedValidationPoliciesCanonicalBytesV1(value: unknown,
  context: TrustedValidationPoliciesContextV1): Promise<Uint8Array> {
  const decoded = await decodeTrustedValidationPoliciesV1(value, context);
  const content: Record<string, unknown> = { ...decoded }; delete content.digest;
  return bytes(trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1, content);
}
/** Hashes establish integrity only. The pinned package must originate independently from the trusted caller. */
export async function assertTrustedValidationPoliciesPinnedV1(proposed: unknown, pinned: unknown,
  context: TrustedValidationPoliciesContextV1): Promise<TrustedValidationPoliciesV1> {
  const authority = await decodeTrustedValidationPoliciesV1(pinned, context);
  const candidate = await decodeTrustedValidationPoliciesV1(proposed, context);
  if (candidate.digest !== authority.digest) throw new Error('TRUSTED_VALIDATION_POLICIES_SUBSTITUTION');
  return authority;
}
