/** Runs only inside the caller's disposable Unix-socket PostgreSQL cluster. */
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
interface DB { sql(statement:string):Promise<string> }
export async function runFoodAdmissionColumnsV1(t:TestContext,{sql}:DB) {
 const draft=await readFile('supabase/migration_drafts/food_evidence_admission_columns_v1.sql','utf8');
 const marker="SET potok_food_evidence.admission_columns_target='staging:ozidryfvhkcbtpnulakq';";
 const absent=()=>sql("SELECT count(*) FROM pg_attribute WHERE attrelid='public.foods'::regclass AND attnum>0 AND NOT attisdropped AND attname IN('is_searchable','needs_review')");
 const snapshot=()=>sql(`SELECT jsonb_build_object(
  'foods',(SELECT jsonb_agg(to_jsonb(f)-'is_searchable'-'needs_review' ORDER BY id) FROM public.foods f),
  'diary',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.food_diary_entries d),
  'aliases',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.food_aliases a),
  'metadata',(SELECT jsonb_build_object('owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) FROM pg_class WHERE oid='public.foods'::regclass),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY polname) FROM pg_policy p WHERE polrelid='public.foods'::regclass))`);
 assert.equal(await absent(),'0','fixture must reproduce the actual missing-column shape');
 const before=await snapshot();
 await t.test('admission columns: no target or wrong target fails atomically',async()=>{
  await assert.rejects(sql(draft),/FOOD_ADMISSION_STAGING_TARGET_REQUIRED/);
  await assert.rejects(sql("SET potok_food_evidence.admission_columns_target='production';"+draft),/FOOD_ADMISSION_STAGING_TARGET_REQUIRED/);
  assert.equal(await absent(),'0'); assert.equal(await snapshot(),before);
 });
 await t.test('admission columns: client SQL role cannot install schema',async()=>{
  await assert.rejects(sql('SET ROLE authenticated;'+marker+draft),/FOOD_ADMISSION_SQL_OWNER_REQUIRED/);
  assert.equal(await absent(),'0');
 });
 await t.test('admission columns: partial or incompatible prior schema is rejected without coercion',async()=>{
  await sql('ALTER TABLE public.foods ADD COLUMN is_searchable text');
  try {
   await assert.rejects(sql(marker+draft),/FOOD_ADMISSION_EXISTING_COLUMNS_REQUIRE_REVIEW/);
   assert.equal(await absent(),'1');
   assert.equal(await sql("SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.foods'::regclass AND attname='is_searchable' AND NOT attisdropped"),'text');
  } finally { await sql('ALTER TABLE public.foods DROP COLUMN is_searchable'); }
 });
 await t.test('admission columns: atomic schema support preserves content, snapshots, ACL and policies',async()=>{
  await sql(marker+draft);
  assert.equal(await absent(),'2'); assert.equal(await snapshot(),before);
  assert.equal(await sql('SELECT bool_and(is_searchable IS NULL AND needs_review IS NULL) FROM public.foods'),'t');
  assert.equal(await sql("SELECT count(*) FROM pg_attribute WHERE attrelid='public.foods'::regclass AND attname IN('is_searchable','needs_review') AND NOT attisdropped AND atttypid='boolean'::regtype AND NOT attnotnull AND NOT atthasdef"),'2');
 });
 assert.equal(await absent(),'2','installation must succeed before dependent tests');
 await t.test('admission columns: replay does not silently accept or overwrite existing flags',async()=>{
  await assert.rejects(sql(marker+draft),/FOOD_ADMISSION_EXISTING_COLUMNS_REQUIRE_REVIEW/);
  assert.equal(await snapshot(),before);
  assert.equal(await sql('SELECT bool_and(is_searchable IS NULL AND needs_review IS NULL) FROM public.foods'),'t');
 });
}
