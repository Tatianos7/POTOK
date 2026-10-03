import { createClient } from '@supabase/supabase-js';
import {
  GenerationEdgeErrorV2,
  decodeGenerationRequestV2,
  decodeGenerationStatusInputV2,
  continueGenerationV2,
  lookupGenerationStatusV2,
  requestGenerationV2,
  type GenerationProposalProviderV2,
  type GenerationRpcClientV2,
  type TrustedGenerationValidatorV2,
} from './contracts.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new GenerationEdgeErrorV2('SERVER_CONFIGURATION_MISSING', 503);
  return value;
}

function json(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function bearer(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/.test(authorization)) throw new GenerationEdgeErrorV2('AUTH_REQUIRED', 401);
  return authorization;
}

/*
 * Deliberately disabled: the real generator and full trusted TypeScript validator are
 * separate reviewed artifacts. Keeping both null makes this skeleton request/status
 * capable while preventing Graph record or activation calls.
 */
const generator: GenerationProposalProviderV2 | null = null;
const validator: TrustedGenerationValidatorV2 | null = null;

Deno.serve(async (request) => {
  try {
    const authorization = bearer(request);
    const url = requiredEnv('SUPABASE_URL');
    const publicKey = requiredEnv('SUPABASE_ANON_KEY');
    const userClient = createClient(url, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userRpcClient: GenerationRpcClientV2 = {
      async rpc<T>(name: string, args: Record<string, unknown>) {
        const { data, error } = await userClient.rpc(name, args);
        return { data: data as T | null, error };
      },
    };

    if (request.method === 'GET') {
      const input = decodeGenerationStatusInputV2(new URL(request.url).searchParams.get('requestOperationId'));
      return json(200, await lookupGenerationStatusV2(userRpcClient, input));
    }
    if (request.method !== 'POST') throw new GenerationEdgeErrorV2('METHOD_NOT_ALLOWED', 405);

    const input = decodeGenerationRequestV2(await request.text());
    const requested = await requestGenerationV2(userRpcClient, input);
    if (!generator || !validator) {
      return json(202, requested);
    }

    // The service-role client exists only in server memory and may call only the three
    // reviewed gateway RPCs. It is never returned to the client or passed to generator code.
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const gatewayClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const gatewayRpcClient: GenerationRpcClientV2 = {
      async rpc<T>(name: string, args: Record<string, unknown>) {
        const { data, error } = await gatewayClient.rpc(name, args);
        return { data: data as T | null, error };
      },
    };
    const result = await continueGenerationV2({
      requestOperationId: requested.requestOperationId,
      gatewayClient: gatewayRpcClient,
      generator,
      validator,
    });
    return json(result.status === 'ACTIVE' ? 200 : 202, result);
  } catch (error) {
    if (error instanceof GenerationEdgeErrorV2) return json(error.httpStatus, { error: error.code });
    return json(500, { error: 'UNEXPECTED_SERVER_ERROR' });
  }
});
