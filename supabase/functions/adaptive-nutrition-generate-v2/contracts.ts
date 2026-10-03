export const generationRequestProtocolV2 = 'potok-adaptive-generation-request-v2' as const;

export type GenerationRequestStatusV2 =
  | 'REQUESTED'
  | 'GENERATING'
  | 'GENERATED'
  | 'ACTIVATING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CONFLICT'
  | 'UNKNOWN_RETRYABLE';

export interface GenerationRequestInputV2 {
  protocolVersion: typeof generationRequestProtocolV2;
  idempotencyKey: string;
}

export interface GenerationRequestStatusInputV2 {
  requestOperationId: string;
}

export interface GenerationRequestResponseV2 {
  contract: 'potok-adaptive-generation-request-status-v2';
  requestOperationId: string;
  status: GenerationRequestStatusV2;
  retryable: boolean;
  reasonCode: string | null;
}

export interface LoadedGenerationRequestV2 extends GenerationRequestResponseV2 {
  generationInputCanonicalHex: string | null;
  candidateManifestCanonicalHex: string | null;
  attemptOperationId: string | null;
}

export interface GeneratedProposalV2 {
  generatedWeekPlanCanonicalHex: string;
}

export interface GenerationRpcClientV2 {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: unknown | null }>;
}

export interface GenerationProposalProviderV2 {
  generate(input: {
    generationInputCanonicalHex: string;
    candidateManifestCanonicalHex: string;
  }): Promise<GeneratedProposalV2>;
}

export interface TrustedGenerationValidatorV2 {
  validate(input: {
    generationInputCanonicalHex: string;
    candidateManifestCanonicalHex: string;
    generatedWeekPlanCanonicalHex: string;
  }): Promise<GeneratedProposalV2>;
}

export class GenerationEdgeErrorV2 extends Error {
  constructor(public readonly code: string, public readonly httpStatus: number, message = code) {
    super(message);
    this.name = 'GenerationEdgeErrorV2';
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hexPattern = /^(?:[0-9a-f]{2})+$/;
const statuses: readonly GenerationRequestStatusV2[] = [
  'REQUESTED', 'GENERATING', 'GENERATED', 'ACTIVATING', 'ACTIVE',
  'REJECTED', 'CONFLICT', 'UNKNOWN_RETRYABLE',
];

function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new GenerationEdgeErrorV2(`INVALID_${label.toUpperCase()}_FIELDS`, 400);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new GenerationEdgeErrorV2(`INVALID_${label.toUpperCase()}`, 400);
  }
  return value;
}

/** Duplicate-aware scan occurs before JSON.parse so repeated keys cannot disappear. */
export function assertNoDuplicateJsonKeysV2(raw: string): void {
  let offset = 0;
  const fail = (): never => { throw new GenerationEdgeErrorV2('INVALID_JSON', 400); };
  const whitespace = (): void => { while (/\s/.test(raw[offset] ?? '')) offset += 1; };
  const scanString = (): string => {
    if (raw[offset] !== '"') return fail();
    const start = offset++;
    while (offset < raw.length) {
      const current = raw[offset];
      if (current === '"') {
        offset += 1;
        try { return JSON.parse(raw.slice(start, offset)) as string; } catch { return fail(); }
      }
      if (current === '\\') {
        offset += 1;
        if (raw[offset] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(raw.slice(offset + 1, offset + 5))) return fail();
          offset += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(raw[offset] ?? '')) return fail();
      } else if (raw.charCodeAt(offset) < 0x20) return fail();
      offset += 1;
    }
    return fail();
  };
  const scanValue = (): void => {
    whitespace();
    if (raw[offset] === '{') {
      offset += 1;
      whitespace();
      const keys = new Set<string>();
      if (raw[offset] === '}') { offset += 1; return; }
      while (offset < raw.length) {
        const key = scanString();
        if (keys.has(key)) throw new GenerationEdgeErrorV2('DUPLICATE_JSON_KEY', 400);
        keys.add(key);
        whitespace();
        if (raw[offset++] !== ':') return fail();
        scanValue();
        whitespace();
        if (raw[offset] === '}') { offset += 1; return; }
        if (raw[offset++] !== ',') return fail();
        whitespace();
      }
      return fail();
    }
    if (raw[offset] === '[') {
      offset += 1;
      whitespace();
      if (raw[offset] === ']') { offset += 1; return; }
      while (offset < raw.length) {
        scanValue();
        whitespace();
        if (raw[offset] === ']') { offset += 1; return; }
        if (raw[offset++] !== ',') return fail();
      }
      return fail();
    }
    if (raw[offset] === '"') { scanString(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (raw.startsWith(literal, offset)) { offset += literal.length; return; }
    }
    const number = raw.slice(offset).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!number) return fail();
    offset += number[0].length;
  };
  whitespace();
  scanValue();
  whitespace();
  if (offset !== raw.length) fail();
}

export function decodeGenerationRequestV2(raw: string): GenerationRequestInputV2 {
  assertNoDuplicateJsonKeysV2(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new GenerationEdgeErrorV2('INVALID_JSON', 400); }
  const row = exactRecord(parsed, ['protocolVersion', 'idempotencyKey'], 'generation_request');
  if (row.protocolVersion !== generationRequestProtocolV2) {
    throw new GenerationEdgeErrorV2('UNSUPPORTED_PROTOCOL', 400);
  }
  return { protocolVersion: generationRequestProtocolV2, idempotencyKey: uuid(row.idempotencyKey, 'idempotency_key') };
}

export function decodeGenerationStatusInputV2(value: string | null): GenerationRequestStatusInputV2 {
  return { requestOperationId: uuid(value, 'request_operation_id') };
}

export function decodeGenerationResponseV2(value: unknown): GenerationRequestResponseV2 {
  const row = exactRecord(
    value,
    ['contract', 'requestOperationId', 'status', 'retryable', 'reasonCode'],
    'generation_response',
  );
  if (row.contract !== 'potok-adaptive-generation-request-status-v2'
      || typeof row.status !== 'string' || !statuses.includes(row.status as GenerationRequestStatusV2)
      || typeof row.retryable !== 'boolean'
      || (row.reasonCode !== null && typeof row.reasonCode !== 'string')) {
    throw new GenerationEdgeErrorV2('INVALID_SERVER_RESPONSE', 502);
  }
  return {
    contract: 'potok-adaptive-generation-request-status-v2',
    requestOperationId: uuid(row.requestOperationId, 'request_operation_id'),
    status: row.status as GenerationRequestStatusV2,
    retryable: row.retryable,
    reasonCode: row.reasonCode as string | null,
  };
}

export function decodeLoadedRequestV2(value: unknown): LoadedGenerationRequestV2 {
  const row = exactRecord(value, [
    'contract', 'requestOperationId', 'status', 'retryable', 'reasonCode',
    'generationInputCanonicalHex', 'candidateManifestCanonicalHex', 'attemptOperationId',
  ], 'loaded_generation_request');
  const base = decodeGenerationResponseV2({
    contract: row.contract,
    requestOperationId: row.requestOperationId,
    status: row.status,
    retryable: row.retryable,
    reasonCode: row.reasonCode,
  });
  const optionalHex = (candidate: unknown): string | null => {
    if (candidate === null) return null;
    if (typeof candidate !== 'string' || !hexPattern.test(candidate)) {
      throw new GenerationEdgeErrorV2('INVALID_SERVER_CANONICAL_BYTES', 502);
    }
    return candidate;
  };
  return {
    ...base,
    generationInputCanonicalHex: optionalHex(row.generationInputCanonicalHex),
    candidateManifestCanonicalHex: optionalHex(row.candidateManifestCanonicalHex),
    attemptOperationId: row.attemptOperationId === null ? null : uuid(row.attemptOperationId, 'attempt_operation_id'),
  };
}

async function rpc<T>(client: GenerationRpcClientV2, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc<T>(name, args);
  if (error || data === null) throw new GenerationEdgeErrorV2('RPC_FAILED', 502);
  return data;
}

export async function requestGenerationV2(
  userClient: GenerationRpcClientV2,
  request: GenerationRequestInputV2,
): Promise<GenerationRequestResponseV2> {
  return decodeGenerationResponseV2(await rpc(userClient, 'adaptive_nutrition_request_generation_v2', {
    p_protocol_version: request.protocolVersion,
    p_idempotency_key: request.idempotencyKey,
  }));
}

export async function lookupGenerationStatusV2(
  userClient: GenerationRpcClientV2,
  input: GenerationRequestStatusInputV2,
): Promise<GenerationRequestResponseV2> {
  return decodeGenerationResponseV2(await rpc(userClient, 'adaptive_nutrition_generation_status_v2', {
    p_request_operation_id: input.requestOperationId,
  }));
}

export async function continueGenerationV2(input: {
  requestOperationId: string;
  gatewayClient: GenerationRpcClientV2;
  generator: GenerationProposalProviderV2;
  validator: TrustedGenerationValidatorV2;
}): Promise<GenerationRequestResponseV2> {
  const loaded = decodeLoadedRequestV2(await rpc(
    input.gatewayClient,
    'load_generation_request_v2',
    { p_request_operation_id: input.requestOperationId },
  ));
  if (loaded.status === 'ACTIVE' || loaded.status === 'REJECTED' || loaded.status === 'CONFLICT') return loaded;
  if (loaded.status === 'GENERATED' || loaded.status === 'ACTIVATING') {
    return decodeGenerationResponseV2(await rpc(
      input.gatewayClient,
      'activate_generated_week_gateway_v2',
      { p_request_operation_id: input.requestOperationId },
    ));
  }
  if (!loaded.generationInputCanonicalHex || !loaded.candidateManifestCanonicalHex) {
    throw new GenerationEdgeErrorV2('GENERATION_INPUT_UNAVAILABLE', 409);
  }
  const proposal = await input.generator.generate({
    generationInputCanonicalHex: loaded.generationInputCanonicalHex,
    candidateManifestCanonicalHex: loaded.candidateManifestCanonicalHex,
  });
  const validated = await input.validator.validate({
    generationInputCanonicalHex: loaded.generationInputCanonicalHex,
    candidateManifestCanonicalHex: loaded.candidateManifestCanonicalHex,
    generatedWeekPlanCanonicalHex: proposal.generatedWeekPlanCanonicalHex,
  });
  const recorded = decodeGenerationResponseV2(await rpc(
    input.gatewayClient,
    'record_generated_week_gateway_v2',
    {
      p_request_operation_id: input.requestOperationId,
      p_generated_week_plan_canonical: `\\x${validated.generatedWeekPlanCanonicalHex}`,
    },
  ));
  if (recorded.status !== 'GENERATED' && recorded.status !== 'ACTIVE') return recorded;
  return decodeGenerationResponseV2(await rpc(
    input.gatewayClient,
    'activate_generated_week_gateway_v2',
    { p_request_operation_id: input.requestOperationId },
  ));
}
