/** Acceptance only: the DB capability is the caller's own disposable Unix cluster. */
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
interface DB {sql(statement:string):Promise<string>}
export async function installClosedNonfoodStagingV1(t:TestContext,{sql}:DB) {
 const file=await readFile('supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.sql','utf8');
 const post=await readFile('supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.postcheck.sql','utf8');
 const marker="SET potok_nonfood.rollout_target='staging:ozidryfvhkcbtpnulakq';";
 const absent=()=>sql("SELECT to_regnamespace('potok_nonfood') IS NULL");
 await t.test('staged nonfood: missing/wrong target and disposable marker cannot authorize installation',async()=>{
  for(const prefix of ['',"SET potok_nonfood.rollout_target='production';","SET potok_nonfood.test_target='disposable-postgresql-only';"])
   await assert.rejects(sql(prefix+file),/NONFOOD_STAGING_TARGET_REQUIRED/);
  assert.equal(await absent(),'t');
 });
 await t.test('staged nonfood: authenticated cannot install even with a target marker',async()=>{
  await assert.rejects(sql('SET ROLE authenticated;'+marker+file),/NONFOOD_STAGING_SQL_OWNER_REQUIRED/);
  assert.equal(await absent(),'t');
 });
 await t.test('staged nonfood: exact dependency body and security metadata drift fail atomically',async()=>{
  const original=await sql("SELECT pg_get_functiondef('potok_food_evidence.text_v1(jsonb,boolean)'::regprocedure)");
  try {
   await sql('ALTER FUNCTION potok_food_evidence.text_v1(jsonb,boolean) SET search_path=public');
   await assert.rejects(sql(marker+file),/NONFOOD_STAGING_DEPENDENCY_DRIFT/);
   await sql(original);
   await sql("CREATE OR REPLACE FUNCTION potok_food_evidence.text_v1(v jsonb,nullable boolean DEFAULT false) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$ BEGIN RETURN 'synthetic altered dependency'; END $$;");
   await assert.rejects(sql(marker+file),/NONFOOD_STAGING_DEPENDENCY_DRIFT/);
   assert.equal(await absent(),'t');
  } finally {await sql(original);}
 });
 await t.test('staged nonfood: existing orphan public RPC is preserved and blocks installation',async()=>{
  await sql('CREATE FUNCTION public.nonfood_evidence_receipt_v1(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$');
  try {
   await assert.rejects(sql(marker+file),/NONFOOD_STAGING_EXISTING_OBJECTS_REQUIRE_REVIEW/);
   assert.equal(await absent(),'t');
   assert.equal(await sql("SELECT to_regprocedure('public.nonfood_evidence_receipt_v1(uuid)') IS NOT NULL"),'t');
  } finally {await sql('DROP FUNCTION public.nonfood_evidence_receipt_v1(uuid)');}
 });
 await t.test('staged nonfood: installs empty immutable tables with every client RPC closed',async()=>{
  await sql(marker+file);await sql(post);
  for(const role of ['anon','authenticated','service_role']) {
   for(const call of ["public.nonfood_evidence_review_v1('{}')","public.nonfood_evidence_receipt_v1(null::uuid)","public.nonfood_evidence_current_v1(null::uuid)"])
    await assert.rejects(sql(`SET ROLE ${role}; SELECT ${call}`),/permission denied/);
  }
 });
 assert.equal(await absent(),'f','staged installation must succeed before any issuer scenario');
 await t.test('staged nonfood: reinstallation fails without overwriting definitions or opening RPCs',async()=>{
  await assert.rejects(sql(marker+file),/NONFOOD_STAGING_EXISTING_OBJECTS_REQUIRE_REVIEW/);
  await sql(post);
 });
 // Synthetic test capability only. The shipped installer contains no client grant.
 // Run all unchanged issuer/security/closure scenarios after this controlled opening.
 await sql('GRANT EXECUTE ON FUNCTION public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid) TO authenticated');
}
