import assert from 'node:assert/strict';
import test from 'node:test';
import {isGenerationEnabled} from '../generationAvailabilityV2';

test('release gate can enable the real app without using a staging build',()=>{
  assert.equal(isGenerationEnabled({MODE:'production',VITE_POTOK_GENERATION_ENABLED:'true'}),true);
  assert.equal(isGenerationEnabled({MODE:'production',VITE_POTOK_STAGING_GENERATION_ENABLED:'true',
    VITE_POTOK_STAGING_PREVIEW:'true',VITE_SUPABASE_URL:'https://ozidryfvhkcbtpnulakq.supabase.co'}),false);
  assert.equal(isGenerationEnabled({MODE:'production'}),false);
});

test('existing staging preview gate remains isolated',()=>{
  const preview={MODE:'staging-preview',VITE_POTOK_STAGING_GENERATION_ENABLED:'true',
    VITE_POTOK_STAGING_PREVIEW:'true'};
  assert.equal(isGenerationEnabled({...preview,VITE_SUPABASE_URL:'https://ozidryfvhkcbtpnulakq.supabase.co'}),true);
  assert.equal(isGenerationEnabled({...preview,VITE_SUPABASE_URL:'https://different.supabase.co'}),false);
});
