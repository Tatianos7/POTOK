import {
  GenerationEdgeErrorV2, decodeGenerationRequestV2, decodeGenerationStatusInputV2,
  lookupGenerationStatusV2, requestGenerationV2, type GenerationRpcClientV2,
} from './contracts.ts';

export interface RequestStatusDependenciesV2 {
  createUserClient(authorization: string): GenerationRpcClientV2;
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'cache-control': 'no-store',
};
const clientErrors = new Set([
  'INVALID_JSON', 'DUPLICATE_JSON_KEY', 'INVALID_GENERATION_REQUEST_FIELDS',
  'UNSUPPORTED_PROTOCOL', 'INVALID_IDEMPOTENCY_KEY', 'INVALID_REQUEST_OPERATION_ID',
  'INVALID_STATUS_QUERY', 'AUTH_REQUIRED', 'METHOD_NOT_ALLOWED',
]);
const rpcErrors: Record<string, number> = {
  AUTH_REQUIRED: 401, VERIFIED_PREMIUM_REQUIRED: 403, REQUEST_NOT_FOUND: 404,
  INVALID_REQUEST: 400, UNSUPPORTED_PROTOCOL: 400,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409, GENERATION_REQUEST_ALREADY_EXISTS: 409,
  PENDING_SELECTION_REQUIRED: 409, AMBIGUOUS_PENDING_SELECTION: 409,
};

function json(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

/** No retries, replacement keys, identity decoding, or privileged capability. */
export function createRequestStatusHandlerV2(deps: RequestStatusDependenciesV2) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    let validated = false;
    try {
      if (request.method !== 'POST' && request.method !== 'GET') {
        throw new GenerationEdgeErrorV2('METHOD_NOT_ALLOWED', 405);
      }
      const authorization = request.headers.get('authorization') ?? '';
      if (!/^Bearer [^\s,]+$/i.test(authorization)) throw new GenerationEdgeErrorV2('AUTH_REQUIRED', 401);
      const query = new URL(request.url).searchParams;
      if ((request.method === 'GET' && (Array.from(query.keys()).length !== 1
          || !query.has('requestOperationId'))) || (request.method === 'POST' && query.size !== 0)) {
        throw new GenerationEdgeErrorV2('INVALID_STATUS_QUERY', 400);
      }
      const input = request.method === 'POST'
        ? decodeGenerationRequestV2(await request.text())
        : decodeGenerationStatusInputV2(query.get('requestOperationId'));
      validated = true;
      const userClient = deps.createUserClient(authorization);
      const restricted: GenerationRpcClientV2 = {
        async rpc<T>(name: string, args: Record<string, unknown>) {
          if (name !== 'adaptive_nutrition_request_generation_v2'
              && name !== 'adaptive_nutrition_generation_status_v2') {
            throw new GenerationEdgeErrorV2('RPC_FAILED', 502);
          }
          let result: { data: T | null; error: unknown | null };
          try { result = await userClient.rpc<T>(name, args); }
          catch { throw new GenerationEdgeErrorV2('RPC_FAILED', 502); }
          if (result.error) {
            const error = result.error;
            const code = typeof error === 'object' && error !== null && 'message' in error
              && typeof error.message === 'string' ? error.message : '';
            const status = Object.prototype.hasOwnProperty.call(rpcErrors, code) ? rpcErrors[code] : undefined;
            throw new GenerationEdgeErrorV2(status ? code : 'RPC_FAILED', status ?? 502);
          }
          return result;
        },
      };
      const response = 'idempotencyKey' in input
        ? await requestGenerationV2(restricted, input)
        : await lookupGenerationStatusV2(restricted, input);
      return json(request.method === 'POST' ? 202 : 200, response);
    } catch (error) {
      if (error instanceof GenerationEdgeErrorV2) {
        if (!validated && clientErrors.has(error.code)) return json(error.httpStatus, { error: error.code, retryable: false });
        if (error.code === 'SERVER_CONFIGURATION_MISSING') return json(503, { error: error.code, retryable: false });
        if (error.code === 'RPC_FAILED') return json(502, { error: error.code, retryable: true });
        if (validated && Object.prototype.hasOwnProperty.call(rpcErrors, error.code)) {
          return json(rpcErrors[error.code], { error: error.code, retryable: false });
        }
        return json(502, { error: 'INVALID_SERVER_RESPONSE', retryable: true });
      }
      return json(500, { error: 'UNEXPECTED_SERVER_ERROR', retryable: true });
    }
  };
}
