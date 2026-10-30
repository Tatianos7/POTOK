import {
  decodeTrustedGenerationInputRawV1, trustedGenerationInputDigestV1,
} from '../utils/adaptiveNutritionGraphV2';
import {
  assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1,
} from '../utils/adaptiveNutritionWireV1';
import {
  trustedValidationPoliciesRawBoundaryContractV2,
} from '../utils/trustedValidationPoliciesV1';
import {
  validateGeneratedWeekPlanTrustedV1, type TrustedGeneratedWeekValidationResultV1,
} from '../utils/trustedGeneratedWeekValidatorV1';

export const generationValidationAuthorityContractV1 = 'potok-generation-validation-authority-v1' as const;

/**
 * Trusted server dependency, never a generator/client callback. Its raw package must
 * independently load the durable request actor/input binding, policies, context and
 * warning evidence for this exact proposal. Hashes alone do not establish provenance.
 * No database implementation, publication or runtime wiring is provided here.
 */
export interface GenerationValidationAuthorityPortV1 {
  loadForProposalRaw(requestOperationId: string, proposalRawSha256: string): Promise<string | null>;
}

export interface GenerationValidationAuthorityV1 {
  contract: typeof generationValidationAuthorityContractV1;
  requestOperationId: string;
  accountId: string;
  generationInputDigest: string;
  evaluatedPlanRawSha256: string;
  trustedContextRaw: string;
  pinnedPoliciesRaw: string;
  pinnedWarningEvidenceRaw: string;
}

type AcceptedValidation = Extract<TrustedGeneratedWeekValidationResultV1, { status: 'ACCEPTED' }>;
type FailedValidation = Exclude<TrustedGeneratedWeekValidationResultV1, AcceptedValidation>;
export type RequestBoundGenerationValidationResultV1 =
  | Readonly<{ status: 'ACCEPTED'; requestOperationId: string; proposalRawSha256: string;
      generatedPlanRaw: string; validation: AcceptedValidation }>
  | Readonly<{ status: 'BLOCKED'; reason: 'VALIDATION_AUTHORITY_UNAVAILABLE' }>
  | Readonly<{ status: FailedValidation['status']; validation: FailedValidation }>;

export class GenerationValidationBindingErrorV1 extends Error {
  constructor(readonly code: 'INVALID_REQUEST_OPERATION_ID' | 'RAW_STRING_REQUIRED'
    | 'INVALID_AUTHORITY_PACKAGE' | 'REQUEST_BINDING_MISMATCH' | 'PROPOSAL_BINDING_MISMATCH'
    | 'INPUT_BINDING_MISMATCH' | 'INVALID_RAW_UNICODE') {
    super(code);
    this.name = 'GenerationValidationBindingErrorV1';
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const authorityKeys = ['contract', 'requestOperationId', 'accountId', 'generationInputDigest',
  'evaluatedPlanRawSha256', 'trustedContextRaw', 'pinnedPoliciesRaw', 'pinnedWarningEvidenceRaw'] as const;
const contextKeys = ['contract', 'trustedGenerationInputRaw', 'candidateManifestRaw',
  'preferenceSnapshotRaw', 'safetySnapshotRaw', 'trustedValidationEvidenceRaw'] as const;

// All object inspection below follows our own duplicate-aware JSON.parse boundary.
function parseRecord(raw: string, keys: readonly string[]): Record<string, unknown> {
  if (typeof raw !== 'string') throw new GenerationValidationBindingErrorV1('RAW_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length
    || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new GenerationValidationBindingErrorV1('INVALID_AUTHORITY_PACKAGE');
  }
  return value as Record<string, unknown>;
}

function decodeAuthority(raw: string): GenerationValidationAuthorityV1 {
  const row = parseRecord(raw, authorityKeys);
  if (row.contract !== generationValidationAuthorityContractV1
    || authorityKeys.some(key => typeof row[key] !== 'string')
    || !uuidPattern.test(row.requestOperationId as string) || !uuidPattern.test(row.accountId as string)
    || !digestPattern.test(row.generationInputDigest as string)
    || !digestPattern.test(row.evaluatedPlanRawSha256 as string)) {
    throw new GenerationValidationBindingErrorV1('INVALID_AUTHORITY_PACKAGE');
  }
  return row as unknown as GenerationValidationAuthorityV1;
}

/**
 * Inactive request-scoped bridge to the existing real validator. The returned API
 * accepts only request identity and proposal text; authority never comes from it.
 * ACCEPTED means validation only, never current entitlement, DB commit or ACTIVE.
 * The result is data, not an authorization token for a database gateway.
 */
export function createGenerationValidationAdapterV1(port: GenerationValidationAuthorityPortV1) {
  return Object.freeze({
    async validate(requestOperationId: string, generatedPlanRaw: string): Promise<RequestBoundGenerationValidationResultV1> {
      if (typeof requestOperationId !== 'string' || !uuidPattern.test(requestOperationId)) {
        throw new GenerationValidationBindingErrorV1('INVALID_REQUEST_OPERATION_ID');
      }
      if (typeof generatedPlanRaw !== 'string') throw new GenerationValidationBindingErrorV1('RAW_STRING_REQUIRED');
      const bytes = new TextEncoder().encode(generatedPlanRaw);
      // TextEncoder replaces lone UTF-16 surrogates; never bind two raw strings to
      // the same replacement bytes. JSON-escaped Unicode remains valid raw text.
      if (new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== generatedPlanRaw) {
        throw new GenerationValidationBindingErrorV1('INVALID_RAW_UNICODE');
      }
      const proposalRawSha256 = await adaptiveNutritionSha256HexV1(bytes);
      const authorityRaw = await port.loadForProposalRaw(requestOperationId, proposalRawSha256);
      if (authorityRaw === null) return Object.freeze({ status: 'BLOCKED', reason: 'VALIDATION_AUTHORITY_UNAVAILABLE' });
      const authority = decodeAuthority(authorityRaw);
      if (authority.requestOperationId !== requestOperationId) {
        throw new GenerationValidationBindingErrorV1('REQUEST_BINDING_MISMATCH');
      }
      if (authority.evaluatedPlanRawSha256 !== proposalRawSha256) {
        throw new GenerationValidationBindingErrorV1('PROPOSAL_BINDING_MISMATCH');
      }
      const context = parseRecord(authority.trustedContextRaw, contextKeys);
      if (context.contract !== trustedValidationPoliciesRawBoundaryContractV2
        || contextKeys.some(key => typeof context[key] !== 'string')) {
        throw new GenerationValidationBindingErrorV1('INVALID_AUTHORITY_PACKAGE');
      }
      const input = decodeTrustedGenerationInputRawV1(context.trustedGenerationInputRaw as string);
      if (input.operation.requestId !== requestOperationId || input.accountId !== authority.accountId
        || await trustedGenerationInputDigestV1(input) !== authority.generationInputDigest) {
        throw new GenerationValidationBindingErrorV1('INPUT_BINDING_MISMATCH');
      }
      const validation = await validateGeneratedWeekPlanTrustedV1(generatedPlanRaw,
        authority.pinnedPoliciesRaw, authority.trustedContextRaw, authority.pinnedWarningEvidenceRaw);
      if (validation.status !== 'ACCEPTED') return Object.freeze({ status: validation.status, validation });
      // Defense in depth: return only the exact proposal text checked by the real
      // validator, with its independently recomputed request/input receipt.
      if (validation.generationInputDigest !== authority.generationInputDigest
        || validation.plan.accountId !== authority.accountId) {
        throw new GenerationValidationBindingErrorV1('INPUT_BINDING_MISMATCH');
      }
      return Object.freeze({ status: 'ACCEPTED', requestOperationId, proposalRawSha256,
        generatedPlanRaw, validation });
    },
  });
}
