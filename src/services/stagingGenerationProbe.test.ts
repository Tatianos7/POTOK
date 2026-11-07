import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyStagingGenerationProbe,
  isStagingGenerationProbeEnabled,
} from './stagingGenerationProbe';

const staging = {
  VITE_POTOK_STAGING_PREVIEW: 'true',
  VITE_SUPABASE_URL: 'https://ozidryfvhkcbtpnulakq.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_' + 'a'.repeat(32),
};

test('Staging diagnostic is strictly limited to an explicit isolated project', () => {
  assert.equal(isStagingGenerationProbeEnabled(staging), true);
  assert.equal(isStagingGenerationProbeEnabled({...staging, VITE_POTOK_STAGING_PREVIEW: 'false'}), false);
  assert.equal(isStagingGenerationProbeEnabled({...staging, VITE_SUPABASE_URL: 'https://dtsdnhbcwpbfrhcazqkb.supabase.co'}), false);
  assert.equal(isStagingGenerationProbeEnabled({...staging, VITE_SUPABASE_ANON_KEY: ''}), false);
});

test('Only typed REQUEST_NOT_FOUND establishes endpoint reachability', () => {
  assert.equal(classifyStagingGenerationProbe(404, {error: 'REQUEST_NOT_FOUND'}), 'endpoint-ready');
  assert.equal(classifyStagingGenerationProbe(404, {error: 'FunctionsNotFound'}), 'request-status-unavailable');
  assert.equal(classifyStagingGenerationProbe(502, {error: 'RPC_FAILED'}), 'request-status-unavailable');
  assert.equal(classifyStagingGenerationProbe(401, {error: 'AUTH_REQUIRED'}), 'auth-denied');
  assert.equal(classifyStagingGenerationProbe(500, {error: 'UNEXPECTED_SERVER_ERROR'}), 'server-unavailable');
});
