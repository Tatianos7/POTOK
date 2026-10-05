import {
  decodeTrustedValidationPoliciesRawV2, trustedValidationPoliciesRawBoundaryContractV2,
} from './trustedValidationPoliciesV1';
import { decodeTrustedValidationEvidenceV1 } from './trustedValidationEvidenceV1';
import { assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';

export const mealWarningEvidenceContractV1 = 'potok-meal-warning-evidence-v1' as const;
export const mealWarningEvidenceEncodingV1 = 'potok-meal-warning-evidence-canonical-json-v1' as const;
export const trustedMealWarningEvidenceSetContractV1 = 'potok-trusted-meal-warning-evidence-set-v1' as const;
export const trustedMealWarningEvidenceSetEncodingV1 = 'potok-trusted-meal-warning-evidence-set-canonical-json-v1' as const;

export interface MealWarningSignalsV1 {
  readonly softTargetFitDeviation: boolean;
  readonly longPreparationBurden: boolean;
  readonly shoppingListBurden: boolean;
  readonly lowerConvenienceScore: boolean;
  readonly repetitionApproachingLimit: boolean;
}
export interface MealWarningEvidenceV1 {
  readonly contract: typeof mealWarningEvidenceContractV1;
  readonly slotId: string;
  readonly validationPolicyRevision: string;
  readonly validationEvidenceDigest: string;
  readonly signals: MealWarningSignalsV1;
  readonly evidenceRevision: string;
  readonly digest: string;
}
export interface TrustedMealWarningEvidenceSetV1 {
  readonly contract: typeof trustedMealWarningEvidenceSetContractV1;
  readonly validationEvidenceDigest: string;
  readonly validationPoliciesDigest: string;
  readonly entries: readonly MealWarningEvidenceV1[];
  readonly digest: string;
}

const signalKeys = ['softTargetFitDeviation', 'longPreparationBurden', 'shoppingListBurden',
  'lowerConvenienceScore', 'repetitionApproachingLimit'] as const;
const entryKeys = ['contract', 'slotId', 'validationPolicyRevision', 'validationEvidenceDigest',
  'signals', 'evidenceRevision', 'digest'] as const;
const contextKeys = ['contract', 'trustedGenerationInputRaw', 'candidateManifestRaw',
  'preferenceSnapshotRaw', 'safetySnapshotRaw', 'trustedValidationEvidenceRaw'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;

// These helpers are private. Only JSON.parse-created or normalized owned data enters them.
function parseRaw(raw: unknown): unknown {
  if (typeof raw !== 'string') throw new Error('RAW_JSON_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length
    || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error('INVALID_WARNING_EVIDENCE_FIELDS');
  }
  return value as Record<string, unknown>;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    let encoded = '[';
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) encoded += ',';
      encoded += canonical(value[index]);
    }
    return `${encoded}]`;
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  throw new Error('INVALID_WARNING_CANONICAL_VALUE');
}
function bytes(contract: string, encoding: string, evidence: unknown): Uint8Array {
  return new TextEncoder().encode(canonical({ contract, encoding, evidence }));
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('INVALID_WARNING_EVIDENCE_UUID');
  return value;
}
function verifyDigest(actual: unknown, expected: string): void {
  if (typeof actual !== 'string' || !digestPattern.test(actual) || actual !== expected) {
    throw new Error('WARNING_EVIDENCE_DIGEST_MISMATCH');
  }
}
async function authoritiesOwned(policies: unknown, context: unknown) {
  // Reject non-primitive arguments before passing anything to another public boundary.
  if (typeof policies !== 'string' || typeof context !== 'string') throw new Error('RAW_JSON_STRING_REQUIRED');
  const row = record(parseRaw(context), contextKeys);
  if (row.contract !== trustedValidationPoliciesRawBoundaryContractV2) throw new Error('INVALID_RAW_BOUNDARY_CONTRACT');
  const owned = { input: parseRaw(row.trustedGenerationInputRaw), manifest: parseRaw(row.candidateManifestRaw),
    preference: parseRaw(row.preferenceSnapshotRaw), safety: parseRaw(row.safetySnapshotRaw) };
  const evidenceOwned = parseRaw(row.trustedValidationEvidenceRaw);
  // Policies always cross the accepted raw-only V2 API. No private policy decoder is imported.
  const pinnedPolicies = await decodeTrustedValidationPoliciesRawV2(policies, context);
  const evidence = await decodeTrustedValidationEvidenceV1(evidenceOwned, owned);
  if (pinnedPolicies.validationEvidenceDigest !== evidence.digest) throw new Error('WARNING_AUTHORITY_BINDING_MISMATCH');
  return { evidence, policies: pinnedPolicies,
    slots: new Set(evidence.distributionPolicy.days.flatMap((day) => day.requiredSlots.map((slot) => slot.slotId))) };
}
type Authorities = Awaited<ReturnType<typeof authoritiesOwned>>;
async function entryOwned(value: unknown, authority: Authorities): Promise<MealWarningEvidenceV1> {
  const row = record(value, entryKeys);
  if (row.contract !== mealWarningEvidenceContractV1) throw new Error('INVALID_WARNING_EVIDENCE_CONTRACT');
  const slotId = uuid(row.slotId);
  if (!authority.slots.has(slotId)) throw new Error('WARNING_SLOT_UNKNOWN');
  const validationPolicyRevision = uuid(row.validationPolicyRevision);
  if (validationPolicyRevision !== authority.evidence.validationPolicyRevision
    || validationPolicyRevision !== authority.policies.balance.policy.policyRevision) {
    throw new Error('WARNING_VALIDATION_POLICY_MISMATCH');
  }
  if (row.validationEvidenceDigest !== authority.evidence.digest) throw new Error('WARNING_VALIDATION_EVIDENCE_MISMATCH');
  const values = record(row.signals, signalKeys);
  for (const key of signalKeys) if (typeof values[key] !== 'boolean') throw new Error('INVALID_WARNING_SIGNAL_TYPE');
  const signals: MealWarningSignalsV1 = Object.freeze({ softTargetFitDeviation: values.softTargetFitDeviation as boolean,
    longPreparationBurden: values.longPreparationBurden as boolean, shoppingListBurden: values.shoppingListBurden as boolean,
    lowerConvenienceScore: values.lowerConvenienceScore as boolean, repetitionApproachingLimit: values.repetitionApproachingLimit as boolean });
  const content = { contract: mealWarningEvidenceContractV1, slotId, validationPolicyRevision,
    validationEvidenceDigest: authority.evidence.digest, signals, evidenceRevision: uuid(row.evidenceRevision) };
  const digest = await adaptiveNutritionSha256HexV1(bytes(mealWarningEvidenceContractV1, mealWarningEvidenceEncodingV1, content));
  verifyDigest(row.digest, digest);
  return Object.freeze({ ...content, digest });
}
async function setOwned(value: unknown, authority: Authorities): Promise<TrustedMealWarningEvidenceSetV1> {
  const row = record(value, ['contract', 'validationEvidenceDigest', 'validationPoliciesDigest', 'entries', 'digest']);
  if (row.contract !== trustedMealWarningEvidenceSetContractV1) throw new Error('INVALID_WARNING_SET_CONTRACT');
  if (row.validationEvidenceDigest !== authority.evidence.digest) throw new Error('WARNING_VALIDATION_EVIDENCE_MISMATCH');
  if (row.validationPoliciesDigest !== authority.policies.digest) throw new Error('WARNING_VALIDATION_POLICIES_MISMATCH');
  if (!Array.isArray(row.entries)) throw new Error('INVALID_WARNING_ENTRIES');
  const entries: MealWarningEvidenceV1[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < row.entries.length; index += 1) {
    const entry = await entryOwned(row.entries[index], authority);
    if (seen.has(entry.slotId)) throw new Error('WARNING_SLOT_DUPLICATE');
    if (index > 0 && entries[index - 1].slotId >= entry.slotId) throw new Error('WARNING_SLOT_ORDER_INVALID');
    seen.add(entry.slotId);
    entries.push(entry);
  }
  if (seen.size !== authority.slots.size) throw new Error('WARNING_SLOT_COVERAGE_MISMATCH');
  const content = { contract: trustedMealWarningEvidenceSetContractV1, validationEvidenceDigest: authority.evidence.digest,
    validationPoliciesDigest: authority.policies.digest, entries: Object.freeze(entries) };
  const digest = await adaptiveNutritionSha256HexV1(bytes(trustedMealWarningEvidenceSetContractV1,
    trustedMealWarningEvidenceSetEncodingV1, content));
  verifyDigest(row.digest, digest);
  return Object.freeze({ ...content, digest });
}

/** Raw strings come from an independently trusted source. Digests prove integrity, not provenance. */
export async function decodeMealWarningEvidenceRawV1(raw: string, policiesRaw: string, trustedContextRaw: string): Promise<MealWarningEvidenceV1> {
  const owned = parseRaw(raw);
  const authority = await authoritiesOwned(policiesRaw, trustedContextRaw);
  return entryOwned(owned, authority);
}
export async function decodeTrustedMealWarningEvidenceSetRawV1(raw: string, policiesRaw: string,
  trustedContextRaw: string): Promise<TrustedMealWarningEvidenceSetV1> {
  const owned = parseRaw(raw);
  const authority = await authoritiesOwned(policiesRaw, trustedContextRaw);
  return setOwned(owned, authority);
}
export async function mealWarningEvidenceCanonicalBytesRawV1(raw: string, policiesRaw: string, trustedContextRaw: string): Promise<Uint8Array> {
  const content: Record<string, unknown> = { ...await decodeMealWarningEvidenceRawV1(raw, policiesRaw, trustedContextRaw) };
  delete content.digest;
  return bytes(mealWarningEvidenceContractV1, mealWarningEvidenceEncodingV1, content);
}
export async function trustedMealWarningEvidenceSetCanonicalBytesRawV1(raw: string, policiesRaw: string,
  trustedContextRaw: string): Promise<Uint8Array> {
  const content: Record<string, unknown> = { ...await decodeTrustedMealWarningEvidenceSetRawV1(raw, policiesRaw, trustedContextRaw) };
  delete content.digest;
  return bytes(trustedMealWarningEvidenceSetContractV1, trustedMealWarningEvidenceSetEncodingV1, content);
}
/** Neither pinnedRaw nor policies/context may originate from the generator's proposed authority package. */
export async function assertTrustedMealWarningEvidenceSetPinnedRawV1(proposedRaw: string, pinnedRaw: string,
  policiesRaw: string, trustedContextRaw: string): Promise<TrustedMealWarningEvidenceSetV1> {
  const proposed = parseRaw(proposedRaw);
  const pinned = parseRaw(pinnedRaw);
  const authority = await authoritiesOwned(policiesRaw, trustedContextRaw);
  const decodedPinned = await setOwned(pinned, authority);
  const decodedProposed = await setOwned(proposed, authority);
  if (decodedPinned.digest !== decodedProposed.digest) throw new Error('WARNING_EVIDENCE_SUBSTITUTION');
  return decodedPinned;
}
