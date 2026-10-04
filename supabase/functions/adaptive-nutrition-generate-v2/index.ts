import { createClient } from '@supabase/supabase-js';
import { GenerationEdgeErrorV2, type GenerationProposalProviderV2,
  type TrustedGenerationValidatorV2 } from './contracts.ts';
import { createRequestStatusHandlerV2 } from './http.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

// Unbound: this entrypoint has no privileged client or orchestration path.
const generator: GenerationProposalProviderV2 | null = null;
const validator: TrustedGenerationValidatorV2 | null = null;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new GenerationEdgeErrorV2('SERVER_CONFIGURATION_MISSING', 503);
  return value;
}

Deno.serve(createRequestStatusHandlerV2({
  createUserClient(authorization) {
    const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      async rpc<T>(name: string, args: Record<string, unknown>) {
        const { data, error, status } = await client.rpc(name, args);
        return { data: data as T | null, error, status };
      },
    };
  },
}));

void generator;
void validator;
