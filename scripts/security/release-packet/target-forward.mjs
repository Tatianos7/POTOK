// Offline assembly only. This module cannot connect to a database or publish a client.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildArtifacts as buildRehearsal,reviewedBody,scopeSQL,contextSQL,canonicalCTE,sha} from './target-rehearsal.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const rehearsalHash='96aa896dbd00855ecd3750e0ef2fd57ab50eeb6aa74579f737a5247e1d627592';
const target='dtsdnhbcwpbfrhcazqkb';

export function finalChecks(body){
  const anchor='\nDO $history_final$\n',at=body.indexOf(anchor);
  assert(at>0&&body.indexOf(anchor,at+1)<0);
  const checks=body.slice(at);
  assert(checks.trimEnd().endsWith('END $review_final$;'));
  // This suffix is already part of the pinned, rehearsed body. It needs no temp tables.
  assert.doesNotMatch(checks,/\b(?:CREATE|ALTER|DROP|REVOKE|GRANT|INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE)\s+(?:TABLE|SCHEMA|FUNCTION|POLICY|INTO|FROM|ON)|pg_temp\.|legacy_plan_keep_/i);
  for(const guard of ['History final effective mutation boundary failed','Legacy plan quarantine final permissions mismatch','Program read final source contract mismatch','Final effective permission review failed','Authority must remain empty','SQL boundary review failed'])assert(checks.includes(guard));
  return checks;
}

export async function buildArtifacts(){
  const rehearsal=(await buildRehearsal())['target-twelve-rehearsal.pending-approval.sql'];
  assert.equal(sha(rehearsal),rehearsalHash);
  const sourceManifest=JSON.parse(await read('manifest.json'));
  const body=reviewedBody(await read('forward.review.sql'),sourceManifest);
  const tail="DO $done$ BEGIN RAISE NOTICE 'TARGET_TWELVE_REHEARSAL_CHECKS_OK';END $done$;\nROLLBACK;\n";
  assert(rehearsal.endsWith(tail));
  const header='-- PENDING EXACT OWNER APPROVAL: managed POTOK rollback rehearsal only.';
  assert(rehearsal.startsWith(header+'\n'));
  // Deliberately separate artifact, never edit the approved rollback file in place.
  const forward=rehearsal.replace(header,'-- PENDING SEPARATE EXACT OWNER APPROVAL: managed POTOK permanent SQL installation.')
    .replace(`-- Execute only through the reviewed connector call project_id=${target}.`,
      `-- Connection must be independently bound to ${target} (reviewed connector or fixed linked CLI).`)
    .slice(0,-tail.length)+
    "DO $done$ BEGIN RAISE NOTICE 'TARGET_TWELVE_PRECOMMIT_CHECKS_OK';END $done$;\nCOMMIT;\n";
  assert.equal((forward.match(/^COMMIT;$/gm)||[]).length,1);
  assert.doesNotMatch(forward,/^ROLLBACK;/m);
  assert(forward.includes(body));

  const inventory=JSON.parse(await read('../backup-readiness/inventory-20261027.json'));
  const observation=JSON.parse(await read('target-observation-20261029.json'));
  const owners=observation.lockScope.tables.map(({schema,name,owner})=>({schema,name,owner}));
  const context=contextSQL()
    .replace(" OR current_setting('transaction_isolation')<>'read committed'",'')
    .replace(" OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))",'');
  assert(!context.includes("nspname IN('potok_control'"));
  const cte=canonicalCTE(await read('preflight.sql'));
  const post=`-- Submit independently, on a new connection, even after a lost apply response.
-- Read-only contract check; not a fresh all-row comparison or HTTP acceptance.
BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL statement_timeout='30s';SET LOCAL lock_timeout='3s';
${context}
DO $installed$ BEGIN
 IF (SELECT count(*) FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery') AND nspowner='postgres'::regrole)<>3
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='execution_reason' AND NOT attisdropped AND NOT attnotnull AND atttypid='text'::regtype)
 THEN RAISE EXCEPTION 'TARGET_COMMITTED_INSTALLATION_STOPPED';END IF;
END $installed$;
${scopeSQL(inventory.tables,{after:true,owners})}
${finalChecks(body)}
${cte}
SELECT jsonb_build_object('status','TARGET_TWELVE_COMMITTED_CONTRACTS_OK',
 'readOnly',current_setting('transaction_read_only'),'observedAt',transaction_timestamp(),
 'publicMetadataSha256',encode(sha256(convert_to(document::text,'UTF8')),'hex'),
 'publicTables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')),
 'authorityRows',(SELECT count(*) FROM potok_control.access_attestations),
 'clientPublished',false,'httpAcceptance',false,'releaseReady',false) AS deployment_check
FROM canonical_metadata;
ROLLBACK;
`;
  const files={'target-twelve-forward.pending-approval.sql':forward,'target-twelve-postcommit.readonly.sql':post};
  files['target-twelve-forward-manifest.json']=JSON.stringify({
    protocol:'potok-target-twelve-forward-review-v1',projectRef:target,status:'PENDING_SEPARATE_EXACT_OWNER_APPROVAL',
    derivedFromRehearsalSha256:rehearsalHash,sqlInputs:sourceManifest.sqlInputs,clientCommit:sourceManifest.clientCommit,
    clientFiles:sourceManifest.clientFiles,terminalAction:'COMMIT',oldTablesCheckedBeforeCommit:116,
    lockCounts:{writeBlocking:112,accessShareOnly:4},hostedExecuted:false,clientPublished:false,releaseReady:false,
    requirements:['Separate exact approval for this SQL hash and project; prior rollback approval does not authorize COMMIT',
      'Verified off-Mac encrypted fresh backup, decrypt check and retained password before permanent installation',
      'No provider maintenance, migrations or concurrent deployment; quiet client window',
      'Fixed linked target and CLI version; fresh independent baseline admission',
      'Existing client compatibility/publication decision for the pinned client before apply',
      'Always run independent postcommit check on a new connection; no automatic replay after uncertainty'],
    recovery:['Before COMMIT: any SQL error aborts transaction; independently reconcile baseline',
      'Lost response: classify with baseline and committed-contract readonly checks, never rerun apply blindly',
      'After COMMIT: stop publication and writes; preserve current evidence; separately approve a reviewed forward repair or metadata recovery',
      'Do not restore old data over newer writes, reset sequences, remove internal schemas or restore blanket grants automatically'],
    limitations:['No client publication or HTTP/application acceptance in this package',
      'Postcommit check verifies selected contracts and shape, not a new full all-row proof',
      'Four managed tables are not write-frozen; sequence increments cannot be rolled back',
      'No automated postcommit inverse migration; fresh restore is a recovery source, not authorization for destructive restore'],
    artifacts:Object.entries(files).map(([path,text])=>({path,sha256:sha(text)}))
  },null,2)+'\n';
  return files;
}
export async function main(args){
  assert(args.length===1&&['--write-review','--verify'].includes(args[0]));
  for(const [name,text] of Object.entries(await buildArtifacts())){
    if(args[0]==='--write-review')await writeFile(new URL(name,import.meta.url),text);
    else assert.equal(await read(name),text);
  }
  console.log('TARGET_FORWARD_REVIEW_PACKAGE_OK: same twelve bodies; precommit preservation; independent readonly JSON; not executed or approved');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{console.error('TARGET_FORWARD_REVIEW_PACKAGE_STOPPED');process.exitCode=1;});
