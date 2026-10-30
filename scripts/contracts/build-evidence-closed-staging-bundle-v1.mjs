/** Offline SQL composition only. This module never connects to a database. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const bundleOutput='supabase/migration_drafts/evidence_closed_staging_bundle_v1.sql';
export const rpcSignatures=[
 'public.food_evidence_review_v1(text)','public.food_evidence_receipt_v1(uuid)',
 'public.food_evidence_current_v1(uuid,text)','public.nonfood_evidence_review_v1(text)',
 'public.nonfood_evidence_receipt_v1(uuid)','public.nonfood_evidence_current_v1(uuid)',
 'public.account_closure_begin_v1(text)',
];
export function buildClosedEvidenceStagingBundleV1(load=p=>readFileSync(resolve(root,p),'utf8')) {
 const manifest=JSON.parse(load('scripts/contracts/evidence-closed-staging-manifest-v1.json'));
 if(manifest.contract!=='potok-closed-evidence-staging-bundle-v1')throw Error('BUNDLE_MANIFEST_CONTRACT');
 const parts=manifest.parts.map(({path,sha256,transaction})=>{
  let text=load(path);
  if(createHash('sha256').update(text).digest('hex')!==sha256)throw Error('BUNDLE_SOURCE_DRIFT: '+path);
  if(transaction){
   if((text.match(/^BEGIN;$/gm)??[]).length!==1 || (text.match(/^COMMIT;$/gm)??[]).length!==1 || !text.endsWith('COMMIT;\n'))
    throw Error('BUNDLE_TRANSACTION_WRAPPER: '+path);
   text=text.replace(/^BEGIN;\n/m,'').slice(0,-'COMMIT;\n'.length);
  }
  return `-- BEGIN PINNED COMPONENT ${path} SHA256 ${sha256}\n${text}-- END PINNED COMPONENT ${path}\n`;
 });
 return `-- GENERATED INACTIVE STAGING PACKAGE. No live application is authorized.
-- One transaction; no intermediate component commit or client-opening window.
-- Source base: ${manifest.sourceCommit}. Reviewed Auth inventory must be supplied independently.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $bundle$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_SQL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF current_setting('potok_evidence.bundle_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF coalesce(current_setting('potok_closure.reviewed_auth_triggers_sha256',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_REVIEWED_AUTH_INVENTORY_REQUIRED' USING ERRCODE='42501';
 END IF;
END $bundle$;
SET LOCAL potok_food_evidence.admission_columns_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_food_evidence.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_nonfood.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_closure.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_closure.registration_rollout_target='staging:ozidryfvhkcbtpnulakq';
${parts.join('\n')}
-- Close every application entry before this transaction can become visible.
REVOKE ALL ON FUNCTION ${rpcSignatures.join(',')} FROM PUBLIC,anon,authenticated,service_role;
DO $closed$
DECLARE signature text; r text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[${rpcSignatures.map(s=>"'"+s+"'").join(',')}] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,signature,'EXECUTE') THEN RAISE EXCEPTION 'EVIDENCE_BUNDLE_RPC_MUST_STAY_CLOSED'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM potok_closure.accounts_v1) OR EXISTS(SELECT 1 FROM potok_closure.registration_records_v1)
 OR EXISTS(SELECT 1 FROM potok_closure.registration_permits_v1) THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_NO_EXISTING_ACCOUNT_BACKFILL';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
  AND tgname='potok_closure_register_new_auth_v1' AND tgenabled='O' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_REGISTRATION_HOOK_REQUIRED';
 END IF;
END $closed$;
COMMIT;
`;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if(process.argv.length!==3)throw Error('Usage: node build-evidence-closed-staging-bundle-v1.mjs OUTPUT_SQL');
 writeFileSync(resolve(process.argv[2]),buildClosedEvidenceStagingBundleV1());
}
