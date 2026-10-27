import assert from 'node:assert/strict';
const namespaces=['potok_control','potok_delivery','potok_nutrition'];
const columns=[['id','uuid'],['program_id','uuid'],['date','date'],['session_type','text'],['plan_payload','jsonb'],['status','text'],['created_at','timestamp with time zone']];
export function classifyPreflight(facts) {
  assert.equal(facts.protocol,'potok-release-preflight-v1');
  assert.match(facts.public_metadata_sha256,/^[a-f0-9]{64}$/);
  assert(Array.isArray(facts.candidate_namespaces));assert.equal(new Set(facts.candidate_namespaces).size,facts.candidate_namespaces.length);
  assert(facts.candidate_namespaces.every(n=>namespaces.includes(n)));
  assert.equal(typeof facts.execution_reason_present,'boolean');
  for(const key of ['public_tables','plan_tables_reviewed','client_truncate_tables','protected_profile_write_columns'])assert(Number.isSafeInteger(facts[key])&&facts[key]>=0);
  const actor=facts.actor==='postgres'&&facts.session_actor==='postgres'&&facts.actor_super===false&&facts.actor_bypass===true&&facts.replication_role==='origin'&&Number.isInteger(facts.server_version_num)&&facts.server_version_num>=170000&&facts.server_version_num<180000;
  const baselineShape=JSON.stringify(facts.session_columns.map(c=>[c.name,c.type]));
  const knownShape=[columns,[...columns,['day_date','date']]].some(c=>JSON.stringify(c)===baselineShape);
  const fresh=facts.candidate_namespaces.length===0&&!facts.execution_reason_present;
  const candidateShape=facts.candidate_namespaces.length===3&&facts.execution_reason_present&&facts.client_truncate_tables===0&&facts.protected_profile_write_columns===0&&facts.trgm?.schema==='extensions';
  const state=!actor?'ACTOR_OR_VERSION_STOP':facts.plan_tables_reviewed!==9?'OWNERSHIP_OR_RLS_STOP':fresh&&knownShape?'BASELINE_OBSERVED':candidateShape?'CANDIDATE_SHAPED_NEEDS_FULL_VERIFY':'PARTIAL_OR_DRIFT_STOP';
  return {state,mayApply:false,mayRetry:false,releaseReady:false,metadataDigest:facts.public_metadata_sha256,
    blockers:['fresh_backup_and_complete_scope','approved_target_rehearsal','managed_extension_path','effective_permissions_and_sources','http_exposed_schema_boundary','client_window_and_exact_approval'],
    extensionPath: facts.trgm?.schema==='public'&&facts.trgm?.owner!=='postgres'?'MANAGED_OWNER_CONFIRMATION_REQUIRED':'REVIEW_REQUIRED',
    note:'Metadata classification is not content integrity, committed visibility, API acceptance or release approval.'};
}
export function recoveryDecision({outcome,baselineRestored=false}) {
  assert(['not_started','rolled_back','unknown_commit','committed'].includes(outcome));
  assert.equal(typeof baselineRestored,'boolean');
  const action=outcome==='unknown_commit'?'STOP_AND_RECONCILE_IN_NEW_READ_ONLY_CONNECTION':outcome==='committed'?'KEEP_CONTAINMENT_REVIEW_FORWARD_REPAIR':outcome==='rolled_back'&&baselineRestored?'REVIEW_CAUSE_BEFORE_NEW_APPROVED_ATTEMPT':outcome==='rolled_back'?'STOP_VERIFY_BASELINE_CONTENT_AND_METADATA':'PREPARE_ONLY_NO_APPLY';
  return {action,mayApply:false,mayRetry:false,restoreBroadGrants:false,restoreOldClient:false,issueEntitlements:false};
}
