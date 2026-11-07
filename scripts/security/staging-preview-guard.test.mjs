import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStagingPreviewEnv,STAGING_SUPABASE_ORIGIN} from './staging-preview-guard.mjs';
const good=()=>({VITE_POTOK_STAGING_PREVIEW:'true',VITE_SUPABASE_URL:STAGING_SUPABASE_ORIGIN,
 VITE_SUPABASE_ANON_KEY:'sb_publishable_'+ 'a'.repeat(32)});
const jwt=(role,ref='ozidryfvhkcbtpnulakq')=>
 ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({role,ref})).toString('base64url'),'signature'].join('.');
test('only exact Staging project and a public browser key build',()=>{
 assert.equal(validateStagingPreviewEnv(good()),true);
 assert.equal(validateStagingPreviewEnv({...good(),VITE_SUPABASE_ANON_KEY:jwt('anon')}),true);
});
test('Production, missing keys, elevated credentials and unverified app modes are denied',()=>{
 for(const patch of [
  {VITE_SUPABASE_URL:'https://dtsdnhbcwpbfrhcazqkb.supabase.co'},
  {VITE_SUPABASE_URL:'https://ozidryfvhkcbtpnulakq.supabase.co.evil.invalid'},
  {VITE_SUPABASE_ANON_KEY:''},
  {VITE_SUPABASE_ANON_KEY:'sb_secret_'+'x'.repeat(32)},
  {VITE_SUPABASE_ANON_KEY:jwt('service_role')},
  {VITE_SUPABASE_ANON_KEY:jwt('anon','dtsdnhbcwpbfrhcazqkb')},
  {VITE_POTOK_STAGING_PREVIEW:'false'},
 ]){
  assert.throws(()=>validateStagingPreviewEnv({...good(),...patch}),/POTOK_STAGING_PREVIEW_CONFIG_INVALID/);
 }
});
