import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync('supabase/migration_drafts/'+p,'utf8');
const original=read('nonfood_reviewed_evidence_v1.sql');
const staging=read('nonfood_reviewed_evidence_v1_staging.sql');
test('staged installer preserves every table/issuer/history byte and removes only client opening',()=>{
 const body=s=>s.slice(s.indexOf('CREATE SCHEMA potok_nonfood;'));
 assert.equal(body(staging),body(original).replace(/^GRANT EXECUTE ON FUNCTION .* TO authenticated;\n/m,''));
 assert.doesNotMatch(staging,/^GRANT /m);
 assert.match(staging,/NONFOOD_STAGING_TARGET_REQUIRED/);
 assert.match(staging,/NONFOOD_STAGING_EXISTING_OBJECTS_REQUIRE_REVIEW/);
 assert.match(original,/DISPOSABLE ONLY/);
});
test('all referenced Food helper bodies, including transitive integer serialization, are pinned',()=>{
 const food=read('food_reviewed_evidence_v1_phase2b.sql');
 const names=new Set([...original.matchAll(/potok_food_evidence\.([a-z0-9_]+)\(/g)].map(m=>m[1]));
 names.add('integer_values_v1');
 for(const name of names){
  const match=food.match(new RegExp('CREATE FUNCTION potok_food_evidence\\.'+name+'\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;'));
  assert.ok(match,name);assert.ok(staging.includes(createHash('sha256').update(match[1]).digest('hex')),name);
 }
 assert.match(staging,/p\.proconfig IS DISTINCT FROM ARRAY\['search_path=pg_catalog'\]/);
 assert.match(staging,/NONFOOD_STAGING_DEPENDENCY_DRIFT/);
});
