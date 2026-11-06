/** Reviewable installation SQL, never a connection, deployment or permission to apply. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const exactStagingProjectV2 = 'ozidryfvhkcbtpnulakq';
export const exactIssuerSourceSha256V2 = 'abb8d12251d3e35e47e7fbde29bc917a54ee9061ced8f23c9ff14681fbc46b7f';
export const exactStagingCatalogFingerprintQueryV2 = `SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
 'id',f.id,'canonicalFoodId',f.canonical_food_id,'stableFoodId',f.stable_food_id,'source',f.source,
 'name',f.name,'normalizedName',f.normalized_name,'brand',f.brand,'normalizedBrand',f.normalized_brand,
 'aliases',f.aliases,'isSearchable',f.is_searchable,'needsReview',f.needs_review,
 'state',to_jsonb(f)->'cooking_state') ORDER BY f.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
 FROM public.foods f WHERE f.source IN ('core','brand') AND f.created_by_user_id IS NULL`;
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
export function readExactIssuerSourceV2(): string { return readFileSync(new URL('./exact-food-nutrition-v2-disposable.sql',import.meta.url),'utf8'); }
export function buildExactFoodNutritionStagingPackageV2(input: { projectId:string;catalogFingerprint:string }, source = readExactIssuerSourceV2()) {
  const { projectId,catalogFingerprint } = input;
  if (projectId!==exactStagingProjectV2 || !/^[a-f0-9]{64}$/.test(catalogFingerprint)
    || sha(source)!==exactIssuerSourceSha256V2) throw Error('EXACT_STAGING_PACKAGE_PIN_MISMATCH');
  const start = source.indexOf('DO $guard$'), end = source.indexOf('END $guard$;')+'END $guard$;'.length;
  if (start<0 || end<start) throw Error('EXACT_STAGING_GUARD_REQUIRED');
  const old = source.slice(start,end), prerequisites = old.slice(old.indexOf('  FOR expected IN SELECT'),old.indexOf('END $guard$;'));
  if (!prerequisites.startsWith('  FOR expected IN SELECT')) throw Error('EXACT_STAGING_PREREQUISITES_REQUIRED');
  const guard = `SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE expected record; actual_fingerprint text;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED'; END IF;
  IF current_setting('potok_food_evidence.exact_staging_target',true) IS DISTINCT FROM 'staging:${projectId}' THEN
    RAISE EXCEPTION 'EXPLICIT_EXACT_STAGING_INSTALL_ACK_REQUIRED'; END IF;
  -- The acknowledgement is not project authentication. The approved connector/connection must separately select this project.
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence:exact-v2-install',0));
  IF to_regclass('potok_food_evidence.exact_sources_v2') IS NOT NULL
    OR to_regprocedure('public.food_nutrition_review_v2(text)') IS NOT NULL THEN RAISE EXCEPTION 'EXACT_V2_ALREADY_PRESENT_REVIEW_STATE'; END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role'))<>4
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND (rolsuper OR rolbypassrls))
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR pg_has_role('anon','postgres','MEMBER') OR pg_has_role('authenticated','postgres','MEMBER') OR pg_has_role('service_role','postgres','MEMBER') THEN
    RAISE EXCEPTION 'REVIEWED_CLIENT_ROLE_ISOLATION_REQUIRED'; END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_food_evidence'
    AND c.relname=ANY(ARRAY['retained_sources_v1','canonical_revisions_v1','nutrition_revisions_v1','review_events_v1','review_requests_v1','current_heads_v1'])
    AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='postgres')<>6 THEN
    RAISE EXCEPTION 'REVIEWED_V1_PRIVATE_TABLES_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
    WHERE n.nspname='potok_food_evidence' AND c.relkind='r' AND r.rolname IN ('anon','authenticated','service_role')
    AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN
    RAISE EXCEPTION 'REVIEWED_V1_PRIVATE_ACL_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
    AND (has_schema_privilege(r.oid,'potok_food_evidence','USAGE') OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='potok_food_evidence' AND has_function_privilege(r.oid,p.oid,'EXECUTE')))) THEN
    RAISE EXCEPTION 'REVIEWED_V1_PRIVATE_FUNCTION_ACL_REQUIRED'; END IF;
  LOCK TABLE public.foods IN SHARE MODE;
  ${exactStagingCatalogFingerprintQueryV2.replace(/\n FROM public/, ' INTO actual_fingerprint\n FROM public')};
  IF actual_fingerprint IS DISTINCT FROM '${catalogFingerprint}' THEN RAISE EXCEPTION 'STAGING_CATALOG_FINGERPRINT_CHANGED'; END IF;
${prerequisites}END $guard$;`;
  // Only the installation guard changes. Every issuer/helper/table/ACL statement stays byte-identical.
  const sql = '-- REVIEW DRAFT: STAGING ONLY. OWNER APPROVAL REQUIRED. No source/catalog/recipe writes.\n'
    +source.slice(source.indexOf('BEGIN;'),start)+guard+source.slice(end).replace(/COMMIT;\s*$/, "NOTIFY pgrst, 'reload schema';\nCOMMIT;\n");
  return { contract:'potok-exact-food-nutrition-staging-install-package-v2',projectId,catalogFingerprint,
    sourceSha256:exactIssuerSourceSha256V2,sqlSha256:sha(sql),sql,
    scope:{ privateTables:5,privateHelpers:7,authenticatedAdminRpcs:3,immutableTableTriggers:4,
      deferredAuthorityTrigger:1,existingV1VersionBarrierTrigger:1,catalogRowWrites:0,sourceApprovals:0,recipePublications:0 },
    canApply:false,ownerApprovalRequired:true,generatorActivated:false };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.argv.length!==3) throw Error('Usage: ... EXPECTED_STAGING_CATALOG_SHA256');
  process.stdout.write(buildExactFoodNutritionStagingPackageV2({ projectId:exactStagingProjectV2,catalogFingerprint:process.argv[2] }).sql);
}
