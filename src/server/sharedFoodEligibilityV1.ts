import { assertRawJsonWithoutDuplicateKeysV1, canonicalJsonV1, adaptiveNutritionSha256HexV1 } from '../utils/adaptiveNutritionWireV1';

// Pure input contract, not authorization or a mounted endpoint. Phase 1 domains unchanged.
export const sharedFoodEligibilityContractV1 = 'potok-shared-food-eligibility-request-v1' as const;
export const sharedFoodEligibilityDomainsV1 = {
  request: 'potok-shared-food-eligibility-request-sha256-v1',
  fingerprint: 'potok-shared-food-identity-fingerprint-sha256-v1',
} as const;
export type SharedFoodEligibilityStatusV1 = 'PENDING' | 'ELIGIBLE' | 'HIDDEN' | 'BLOCKED';
export interface SharedFoodEligibilityRequestV1 {
  contract: typeof sharedFoodEligibilityContractV1;
  foodId: string;
  idempotencyReference: string;
  expectedHead: { decisionId: string; version: string } | null;
  catalogIdentityEpoch: string;
  identityFingerprint: string;
  status: SharedFoodEligibilityStatusV1;
  reason: string;
}
export interface SharedFoodIdentityV1 {
  foodId: string; canonicalFoodId: string; foodStableId: string; source: 'core' | 'brand'; createdByUserId: null;
  identitySnapshot: { name: string; nameOriginal: string | null; normalizedName: string | null;
    brand: string | null; normalizedBrand: string | null; barcode: string | null; aliases: string[] | null };
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const counter = /^(0|[1-9][0-9]{0,18})$/;
function fail(): never { throw new Error('SHARED_ELIGIBILITY_INVALID'); }
function object(v: unknown, fields: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail();
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== fields.length || fields.some(k => !Object.prototype.hasOwnProperty.call(r, k))) fail();
  return r;
}
function text(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.includes('\u0000')
    || new TextDecoder().decode(new TextEncoder().encode(v)) !== v) fail();
  return v;
}
function match(v: unknown, re: RegExp): string { const s = text(v); if (!re.test(s)) fail(); return s; }
function integer(v: unknown): string {
  const s = match(v, counter); if (BigInt(s) > 9223372036854775807n) fail(); return s;
}
export function decodeSharedFoodEligibilityRequestRawV1(raw: unknown): SharedFoodEligibilityRequestV1 {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 16_384) fail();
  assertRawJsonWithoutDuplicateKeysV1(raw);
  const r = object(JSON.parse(raw), ['contract', 'foodId', 'idempotencyReference', 'expectedHead',
    'catalogIdentityEpoch', 'identityFingerprint', 'status', 'reason']);
  if (r.contract !== sharedFoodEligibilityContractV1 || !['PENDING', 'ELIGIBLE', 'HIDDEN', 'BLOCKED'].includes(text(r.status))) fail();
  let expectedHead: SharedFoodEligibilityRequestV1['expectedHead'] = null;
  if (r.expectedHead !== null) {
    const h = object(r.expectedHead, ['decisionId', 'version']);
    expectedHead = { decisionId: match(h.decisionId, uuid), version: integer(h.version) };
  }
  return { contract: sharedFoodEligibilityContractV1, foodId: match(r.foodId, uuid),
    idempotencyReference: match(r.idempotencyReference, uuid), expectedHead,
    catalogIdentityEpoch: integer(r.catalogIdentityEpoch), identityFingerprint: match(r.identityFingerprint, hash),
    status: r.status as SharedFoodEligibilityStatusV1, reason: text(r.reason) };
}
export async function sharedFoodEligibilityRequestDigestRawV1(raw: unknown): Promise<string> {
  const input = decodeSharedFoodEligibilityRequestRawV1(raw);
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain: sharedFoodEligibilityDomainsV1.request, payload: input })));
}
export async function sharedFoodIdentityFingerprintV1(identity: SharedFoodIdentityV1): Promise<string> {
  // Encoder for a server-extracted identity. A digest never confers authority.
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain: sharedFoodEligibilityDomainsV1.fingerprint,
    payload: { contract: 'potok-shared-food-identity-v1', encoding: 'canonical-json-utf8-v1', ...identity } })));
}
