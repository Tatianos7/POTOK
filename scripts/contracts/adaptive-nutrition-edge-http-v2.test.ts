import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequestStatusHandlerV2 } from '../../supabase/functions/adaptive-nutrition-generate-v2/http.ts';
import { generationRequestProtocolV2, type GenerationRpcClientV2 } from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts.ts';

const key = '93020000-0000-4000-8000-000000000050';
const requestId = '93020000-0000-4000-8000-000000000060';
const dto = { protocolVersion: generationRequestProtocolV2, idempotencyKey: key };
const status = {
  contract: 'potok-adaptive-generation-request-status-v2', requestOperationId: requestId,
  status: 'REQUESTED', retryable: true, reasonCode: null,
};
const base = 'https://example.invalid/functions/v1/adaptive-nutrition-generate-v2';
function request(body: string = JSON.stringify(dto), method = 'POST', query = '', auth = 'Bearer test-only') {
  return new Request(base + query, {
    method, headers: auth ? { authorization: auth, 'content-type': 'application/json' } : {},
    ...(method === 'POST' ? { body } : {}),
  });
}
function fixture(result: unknown = status, error: unknown = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const bearers: string[] = [];
  const client: GenerationRpcClientV2 = {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      assert.ok(['adaptive_nutrition_request_generation_v2', 'adaptive_nutrition_generation_status_v2'].includes(name));
      return { data: result as T, error };
    },
  };
  const handler = createRequestStatusHandlerV2({
    createUserClient(authorization) { bearers.push(authorization); return client; },
  });
  return { handler, calls, bearers };
}

test('OPTIONS works without auth/client and advertises bearer CORS', async () => {
  const f = fixture();
  const response = await f.handler(request('', 'OPTIONS', '', ''));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /authorization/);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.equal(f.bearers.length, 0);
  assert.equal(f.calls.length, 0);
});

for (const [label, body, code] of [
  ['malformed JSON', '{', 'INVALID_JSON'],
  ['invalid protocol', JSON.stringify({ ...dto, protocolVersion: 'other' }), 'UNSUPPORTED_PROTOCOL'],
  ['invalid key', JSON.stringify({ ...dto, idempotencyKey: 'bad' }), 'INVALID_IDEMPOTENCY_KEY'],
  ['authoritative extra field', JSON.stringify({ ...dto, accountId: key }), 'INVALID_GENERATION_REQUEST_FIELDS'],
  ['duplicate key', '{"protocolVersion":"' + generationRequestProtocolV2 + '","idempotencyKey":"' + key + '","idempotencyKey":"' + key + '"}', 'DUPLICATE_JSON_KEY'],
] as const) {
  test(label + ' fails before client creation', async () => {
    const f = fixture();
    const response = await f.handler(request(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, code);
    assert.equal(f.calls.length, 0);
    assert.equal(f.bearers.length, 0);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
}

test('missing/malformed bearer and unsupported method never call RPC', async () => {
  const f = fixture();
  for (const auth of ['', 'Basic x', 'Bearer a,b', 'Bearer a b']) {
    assert.equal((await f.handler(request(JSON.stringify(dto), 'POST', '', auth))).status, 401);
  }
  assert.equal((await f.handler(request('', 'DELETE'))).status, 405);
  assert.equal(f.calls.length, 0);
});

test('valid POST forwards bearer unchanged and preserves retry identity', async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    const response = await f.handler(request(JSON.stringify(dto), 'POST', '', 'bEaReR opaque-test'));
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), status);
  }
  assert.deepEqual(f.bearers, ['bEaReR opaque-test', 'bEaReR opaque-test']);
  assert.deepEqual(f.calls, [0, 1].map(() => ({
    name: 'adaptive_nutrition_request_generation_v2',
    args: { p_protocol_version: generationRequestProtocolV2, p_idempotency_key: key },
  })));
});

test('GET status accepts exactly one opaque request identity', async () => {
  const f = fixture();
  const response = await f.handler(request('', 'GET', '?requestOperationId=' + requestId));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), status);
  assert.deepEqual(f.calls, [{ name: 'adaptive_nutrition_generation_status_v2', args: { p_request_operation_id: requestId } }]);
  for (const query of ['', '?requestOperationId=bad', '?requestOperationId=' + requestId + '&accountId=' + key,
    '?requestOperationId=' + requestId + '&requestOperationId=' + requestId]) {
    assert.equal((await f.handler(request('', 'GET', query))).status, 400);
  }
  assert.equal(f.calls.length, 1);
});

test('disabled path never generates, validates, creates privileged client, records or activates', async () => {
  const counts = { privileged: 0, generate: 0, validate: 0, record: 0, activate: 0 };
  const forbidden = {
    createPrivilegedClient() { counts.privileged++; throw new Error('forbidden'); },
    generate() { counts.generate++; throw new Error('forbidden'); },
    validate() { counts.validate++; throw new Error('forbidden'); },
    record() { counts.record++; throw new Error('forbidden'); },
    activate() { counts.activate++; throw new Error('forbidden'); },
  };
  const f = fixture();
  const handler = createRequestStatusHandlerV2({
    ...forbidden, createUserClient() {
      return { async rpc<T>(name: string, args: Record<string, unknown>) {
        f.calls.push({ name, args });
        assert.ok(!/gateway|load_generation/.test(name));
        return { data: status as T, error: null };
      } };
    },
  });
  for (const state of ['REQUESTED', 'GENERATED', 'ACTIVATING', 'ACTIVE']) {
    // Existing status is never an instruction to resume privileged work.
    const g = fixture({ ...status, status: state });
    assert.equal((await g.handler(request())).status, 202);
  }
  await handler(request());
  await handler(request('', 'GET', '?requestOperationId=' + requestId));
  assert.deepEqual(counts, { privileged: 0, generate: 0, validate: 0, record: 0, activate: 0 });
  const entrypoint = readFileSync(new URL('../../supabase/functions/adaptive-nutrition-generate-v2/index.ts', import.meta.url), 'utf8');
  assert.match(entrypoint, /const generator: GenerationProposalProviderV2 \| null = null/);
  assert.match(entrypoint, /const validator: TrustedGenerationValidatorV2 \| null = null/);
  assert.doesNotMatch(entrypoint, /SERVICE_ROLE|continueGenerationV2|gatewayClient/);
});

test('RPC allowlisted denial is typed; unknown RPC details never escape', async () => {
  for (const [message, expected] of [['VERIFIED_PREMIUM_REQUIRED', 403], ['IDEMPOTENCY_PAYLOAD_MISMATCH', 409],
    ['REQUEST_NOT_FOUND', 404], ['private details test-only', 502]] as const) {
    const f = fixture(null, { message, details: 'private details test-only' });
    const response = await f.handler(request());
    assert.equal(response.status, expected);
    const body = await response.text();
    assert.ok(!body.includes('private details'));
    assert.equal(f.calls.length, 1);
  }
});

test('transport failure retry uses original key; no internal retry', async () => {
  const keys: unknown[] = [];
  let attempts = 0;
  const handler = createRequestStatusHandlerV2({ createUserClient() {
    return { async rpc<T>(_name: string, args: Record<string, unknown>) {
      keys.push(args.p_idempotency_key);
      if (++attempts === 1) throw new Error('private transport details');
      return { data: status as T, error: null };
    } };
  } });
  const failed = await handler(request());
  assert.deepEqual(await failed.json(), { error: 'RPC_FAILED', retryable: true });
  assert.equal(attempts, 1);
  assert.equal((await handler(request())).status, 202);
  assert.deepEqual(keys, [key, key]);
});

test('unknown errors and malformed upstream DTO map safely', async () => {
  const handler = createRequestStatusHandlerV2({ createUserClient() { throw new Error('private factory detail'); } });
  const response = await handler(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'UNEXPECTED_SERVER_ERROR', retryable: true });
  for (const bad of [{}, { ...status, requestOperationId: 'bad' }, { ...status, extra: true }]) {
    const response = await fixture(bad).handler(request());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'INVALID_SERVER_RESPONSE', retryable: true });
  }
});
