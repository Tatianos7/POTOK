import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { definitionRequest,nutritionRequest,id,actor } from '../../src/server/__tests__/nonFoodEvidenceFixturesV1';
import { verifyNonFoodReceiptV1, type NonFoodRequestV1 } from '../../src/server/nonFoodEvidenceV1';
const quote=(v:string)=>`'${v.replace(/'/g,"''")}'`;
interface DB { sql(statement:string):Promise<string>;asUser(statement:string,user?:string,claims?:Record<string,unknown>):Promise<string> }
type Receipt = { event:{eventId:string;target:{kind:'DEFINITION'|'NUTRITION';definitionId:string;revisionId:string;digest:string}};
 revision:{definitionId:string;revisionId:string;digest:string};heads:{definition:{revisionId:string;digest:string};nutrition:{revisionId:string;digest:string}|null};replayed:boolean };
export async function runNonFoodAcceptanceV1(t:TestContext,db:DB) {
 const {sql,asUser}=db;
 const file=await readFile('supabase/migration_drafts/nonfood_reviewed_evidence_v1.sql','utf8');
 const req=definitionRequest(20000);
 const review=async(p:NonFoodRequestV1,user=actor):Promise<Receipt>=>{const raw=JSON.stringify(p);
  const value=JSON.parse(await asUser(`SELECT public.nonfood_evidence_review_v1(${quote(raw)})`,user));
  await verifyNonFoodReceiptV1(raw,user,value);return value;};
 const current=async(d:string)=>JSON.parse(await asUser(`SELECT public.nonfood_evidence_current_v1(${quote(d)})`));
 let d:Receipt;
 await t.test('nonfood preflight refuses unmarked target atomically; marked own cluster installs/postchecks',async()=>{
  await assert.rejects(sql(file),/NONFOOD_DISPOSABLE_PREFLIGHT_REQUIRED/);
  assert.equal(await sql("SELECT to_regnamespace('potok_nonfood') IS NULL"),'t');
  const marker="SET potok_nonfood.test_target='disposable-postgresql-only';";
  await sql(marker+await readFile('supabase/migration_drafts/nonfood_reviewed_evidence_v1.preflight.sql','utf8'));
  await sql(marker+file);await sql(await readFile('supabase/migration_drafts/nonfood_reviewed_evidence_v1.postcheck.sql','utf8'));
 });
 await t.test('nonfood real authority/session/role/actor checks and strict SQL raw boundary reject',async()=>{
  await assert.rejects(review(req,id(3)),/VERIFIED_ADMIN_REQUIRED/);
  await assert.rejects(review(req,id(4)),/LIVE_AUTH_SESSION_REQUIRED/);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_review_v1(${quote(JSON.stringify(req))})`,actor,{sub:id(999)}));
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_review_v1(${quote(JSON.stringify(req))})`,actor,{exp:1}),/JWT_EXPIRED/);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_review_v1(${quote(JSON.stringify(req).replace('"kind":"REVIEW_APPROVED"','"kind":"REVIEW_APPROVED","kind":"REVIEW_APPROVED"'))})`),/DUPLICATE_JSON_KEY/);
 });
 await t.test('nonfood server-mints separate definition, exact byte replay and actor-scoped receipt recovery',async()=>{
  d=await review(req);assert.equal(d.replayed,false);
  assert.equal((await review(req)).replayed,true);
  const recovered=JSON.parse(await asUser(`SELECT public.nonfood_evidence_receipt_v1(${quote(req.idempotencyReference)})`));
  await verifyNonFoodReceiptV1(JSON.stringify(req),actor,recovered);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_receipt_v1(${quote(req.idempotencyReference)})`,id(2)),/REQUEST_NOT_FOUND/);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_review_v1(${quote(JSON.stringify(req,null,2))})`),/IDEMPOTENCY_BYTES_CONFLICT/);
 });
 await t.test('nonfood exact definition/evidence/source applicability and rollback leave no orphans',async()=>{
  const n=nutritionRequest(d.revision.definitionId,d.revision.revisionId,d.revision.digest,20100);
  const count=await sql("SELECT jsonb_build_array((SELECT count(*) FROM potok_nonfood.nutrition_v1),(SELECT count(*) FROM potok_nonfood.events_v1),(SELECT count(*) FROM potok_nonfood.receipts_v1))");
  const bad=structuredClone(n);bad.retainedSource.byteLength++;await assert.rejects(review(bad),/SOURCE_BYTE_LENGTH_MISMATCH/);
  assert.equal(await sql("SELECT jsonb_build_array((SELECT count(*) FROM potok_nonfood.nutrition_v1),(SELECT count(*) FROM potok_nonfood.events_v1),(SELECT count(*) FROM potok_nonfood.receipts_v1))"),count);
  for(const f of ['calories','protein','fat','carbs','fiber']) for(const value of [null,'','—',0]) {
   const missing=structuredClone(n);(missing.proposal as unknown as {sourceValues:Record<string,unknown>}).sourceValues[f]=value;
   await assert.rejects(review(missing));
  }
  const drift=structuredClone(n);drift.retainedSource.sourceBytesSha256='0'.repeat(64);await assert.rejects(review(drift),/SOURCE_SHA256_MISMATCH/);
  const state=structuredClone(n);state.retainedSource.mappings[0].applicability.foodState='raw';await assert.rejects(review(state),/SOURCE_MAPPING_MISMATCH/);
  const fields=structuredClone(n);fields.retainedSource.mappings=[];await assert.rejects(review(fields),/MAPPING/);
  await review(n);assert.equal((await current(d.revision.definitionId)).nutritionUsable,true);
  const mismatch=nutritionRequest(d.revision.definitionId,id(999),'f'.repeat(64),20101);await assert.rejects(review(mismatch),/EXACT_TARGET_REQUIRED/);
 });
 await t.test('nonfood rejected review has terminal receipt but no new revision/head; nutrition invalidation is exact',async()=>{
  const rejected:NonFoodRequestV1={...definitionRequest(20150),kind:'REVIEW_REJECTED',reason:'Synthetic review rejected'};if(rejected.proposal.kind==='DEFINITION')rejected.proposal.definitionId=d.revision.definitionId;
  rejected.expectedHead={revisionId:d.revision.revisionId,digest:d.revision.digest};const r=await review(rejected);assert.equal(r.revision,null);
  const c=await current(d.revision.definitionId);assert.equal(c.definitionRevision.revisionId,d.revision.revisionId);
  const p:NonFoodRequestV1={contract:req.contract,kind:'INVALIDATION',idempotencyReference:id(20151),target:{kind:'NUTRITION',definitionId:d.revision.definitionId,revisionId:c.nutritionRevision.revisionId,digest:c.nutritionRevision.digest},severity:'SAFETY_CRITICAL',reason:'Synthetic nutrition invalidation',retainedSource:nutritionRequest(d.revision.definitionId,d.revision.revisionId,d.revision.digest,20100).retainedSource};
  await review(p);assert.equal((await current(d.revision.definitionId)).nutritionUsable,false);
 });
 await t.test('nonfood stale head and two reviewers race: exactly one CAS wins, deterministic gate',async()=>{
  const make=(key:number)=>{const p=definitionRequest(key);if(p.proposal.kind==='DEFINITION')p.proposal.definitionId=d.revision.definitionId;p.expectedHead={revisionId:d.revision.revisionId,digest:d.revision.digest};return p;};
  const results=await Promise.allSettled([review(make(20200)),review(make(20201),id(2))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.ok(results.some(r=>r.status==='rejected'&&/EXPECTED_HEAD_CONFLICT/.test(String(r.reason))));
  const c=await current(d.revision.definitionId);assert.notEqual(c.definitionRevision.revisionId,d.revision.revisionId);
  assert.equal(c.nutritionUsable,false,'old nutrition never rebinds to new definition');
  await assert.rejects(review(make(20202)),/EXPECTED_HEAD_CONFLICT/);
 });
 await t.test('nonfood historical invalidation cannot resurrect current; current invalidation unusable',async()=>{
  const c=await current(d.revision.definitionId);
  const p:NonFoodRequestV1={contract:req.contract,kind:'INVALIDATION',idempotencyReference:id(20300),target:{kind:'DEFINITION',definitionId:d.revision.definitionId,revisionId:c.definitionRevision.revisionId,digest:c.definitionRevision.digest},severity:'CORRECTION',reason:'Synthetic invalidation',retainedSource:req.retainedSource};
  await review(p);assert.equal((await current(d.revision.definitionId)).definitionUsable,false);
  const receipt=JSON.parse(await asUser(`SELECT public.nonfood_evidence_receipt_v1(${quote(req.idempotencyReference)})`));
  assert.equal(receipt.revision.revisionId,d.revision.revisionId,'receipt is historical, never currentness proof');
 });
 await t.test('nonfood audit events follow UTC occurrence through review, supersession and invalidation',async()=>{
  const first=definitionRequest(20350);if(first.proposal.kind==='DEFINITION')first.proposal.stableKey='synthetic_audit_chronology';
  const opening=await review(first);
  await sql('SELECT pg_sleep(0.01)');
  const next=definitionRequest(20351);
  if(next.proposal.kind==='DEFINITION') {next.proposal.definitionId=opening.revision.definitionId;next.proposal.stableKey='synthetic_audit_chronology';}
  next.expectedHead={revisionId:opening.revision.revisionId,digest:opening.revision.digest};
  const supersession=await review(next);
  await sql('SELECT pg_sleep(0.01)');
  const invalidation:NonFoodRequestV1={contract:first.contract,kind:'INVALIDATION',idempotencyReference:id(20352),
   target:{kind:'DEFINITION',definitionId:opening.revision.definitionId,revisionId:supersession.revision.revisionId,digest:supersession.revision.digest},
   severity:'CORRECTION',reason:'Synthetic audit invalidation',retainedSource:next.retainedSource};
  const invalidated=await review(invalidation);
  const audit=(await current(opening.revision.definitionId)).events as Array<{eventId:string;occurredAt:string;kind:string}>;
  assert.deepEqual(audit.map(e=>e.eventId),[opening.event.eventId,supersession.event.eventId,invalidated.event.eventId]);
  assert.deepEqual(audit.map(e=>e.kind),['REVIEW_APPROVED','REVIEW_APPROVED','INVALIDATION']);
  assert.ok(audit.every((e,i)=>i===0 || audit[i-1].occurredAt<e.occurredAt));
  const typed=JSON.parse(await sql(`SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'occurredAt',to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY occurred_at,event_id) FROM potok_nonfood.events_v1 WHERE definition_id=${quote(opening.revision.definitionId)}`));
  assert.deepEqual(typed,audit.map(e=>({eventId:e.eventId,occurredAt:e.occurredAt})));
 });
 await t.test('nonfood direct writes/service-role RPC/immutability/FORCE RLS and food namespace denied',async()=>{
  for(const table of ['roots_v1','sources_v1','events_v1','definitions_v1','nutrition_v1','heads_v1','receipts_v1']){
   for(const command of [`SELECT * FROM potok_nonfood.${table}`,`DELETE FROM potok_nonfood.${table}`,`TRUNCATE potok_nonfood.${table}`]) await assert.rejects(asUser(command),/permission denied/);
   if(table!=='heads_v1') await assert.rejects(sql(`UPDATE potok_nonfood.${table} SET ${table==='roots_v1'?'stable_key=stable_key':table==='sources_v1'?'snapshot=snapshot':table==='receipts_v1'?'receipt=receipt':'snapshot=snapshot'}`),/IMMUTABLE_FOOD_EVIDENCE/);
  }
  await assert.rejects(sql(`SET ROLE service_role;SELECT public.nonfood_evidence_receipt_v1(${quote(req.idempotencyReference)})`),/permission denied/);
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${quote(d.revision.definitionId)}`),'0');
 });
 await t.test('nonfood real gate wait rechecks JWT expiry; revocation blocks receipt/read',async()=>{
  const holder=sql("BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('potok-nonfood-v1:catalog',0));SELECT pg_sleep(2);COMMIT;");
  const until=Date.now()+1500;let held=false;
  while(Date.now()<until){if(await sql("SELECT pg_try_advisory_xact_lock(hashtextextended('potok-nonfood-v1:catalog',0))")==='f'){held=true;break;}await new Promise(r=>setTimeout(r,20));}
  assert.ok(held);
  try{await assert.rejects(asUser(`SELECT public.nonfood_evidence_current_v1(${quote(d.revision.definitionId)})`,actor,{exp:Math.floor(Date.now()/1000)+1}),/JWT_EXPIRED/);}finally{await holder;}
  // Existing fixture account3 has no trusted grant, and literal admin does not authorize reads.
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_current_v1(${quote(d.revision.definitionId)})`,id(3)),/VERIFIED_ADMIN_REQUIRED/);
 });
 await t.test('nonfood actual entitlement revocation denies historical recovery, even with literal admin',async()=>{
  const who=id(5);await sql(`INSERT INTO auth.users VALUES(${quote(who)},false);INSERT INTO auth.sessions VALUES(${quote(id(105))},${quote(who)},NULL);INSERT INTO public.user_profiles(user_id) VALUES(${quote(who)});SELECT potok_control.grant_entitlement_v2(${quote(who)},'admin',NULL,'synthetic-local-test','nonfood acceptance');`);
  const p=definitionRequest(20400);if(p.proposal.kind==='DEFINITION')p.proposal.stableKey='synthetic_revocation';
  await review(p,who);await sql(`SELECT potok_control.revoke_entitlement_v2(${quote(who)},'admin','synthetic revoke','nonfood acceptance');UPDATE public.user_profiles SET is_admin=true WHERE user_id=${quote(who)}`);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_receipt_v1(${quote(p.idempotencyReference)})`,who),/VERIFIED_ADMIN_REQUIRED/);
 });
 await t.test('nonfood commit-time expiry rolls back root/source/revision/event/head/receipt together',async()=>{
  const inventory=()=>sql("SELECT jsonb_build_array((SELECT count(*) FROM potok_nonfood.roots_v1),(SELECT count(*) FROM potok_nonfood.sources_v1),(SELECT count(*) FROM potok_nonfood.definitions_v1),(SELECT count(*) FROM potok_nonfood.events_v1),(SELECT count(*) FROM potok_nonfood.heads_v1),(SELECT count(*) FROM potok_nonfood.receipts_v1))");
  const before=await inventory();const p=definitionRequest(20500);if(p.proposal.kind==='DEFINITION')p.proposal.stableKey='synthetic_commit_expiry';
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_review_v1(${quote(JSON.stringify(p))});SELECT pg_sleep(3)`,actor,{exp:Math.floor(Date.now()/1000)+2}),/JWT_EXPIRED/);
  assert.equal(await inventory(),before);
  await assert.rejects(asUser(`SELECT public.nonfood_evidence_receipt_v1(${quote(p.idempotencyReference)})`),/REQUEST_NOT_FOUND/);
 });

}
