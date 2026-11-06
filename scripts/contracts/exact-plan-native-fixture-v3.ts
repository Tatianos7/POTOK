/** Fixed loopback-only synthetic native fixture. Not source/metric issuance or a hosted seed. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {Pool} from 'pg';
import {optimizationFixtureV3,graphSourceFixtureV3,raw,sha,id,q} from '../../src/server/__tests__/exactWeekOptimizationFixturesV3';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';import {trustedGenerationInputDigestV1} from '../../src/utils/adaptiveNutritionGraphV2';
import {createExactWeekOptimizationV3,exactWeekMetricsContractV3} from '../../src/server/exactWeekOptimizationV3';
import {createExactPlanPostgresStoreV3,type ExactPlanSqlSourceClientV3,type ExactPlanSqlRowV3} from '../../src/server/exactPlanPostgresV3';
import {createExactPlanAdmissionV3} from '../../src/server/exactPlanAdmissionV3';import {adaptGenerationNodePgPoolV1} from '../../src/server/generationNodePgPoolV1';
import type {GenerationTransactionPoolV1} from '../../src/server/generationTransactionClientV1';
import {authorized} from '../../src/server/__tests__/exactWeekNutritionFixturesV3';
export const packetSqlV3='SELECT potok_nutrition.read_exact_native_fixture_packet_v3($1::uuid,$2::text) AS result_raw';
const literal=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
export async function installExactPlanNativeFixtureV3(){
 const owner=new Pool({host:'127.0.0.1',port:5432,database:'potok_generation_store_disposable',user:'postgres',password:'disposable-generation-only',ssl:false,max:2,connectionTimeoutMillis:5000});
 assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name,'potok_generation_store_disposable');
 const f=await optimizationFixtureV3(),manifest=canonical({scope:'SYNTHETIC_NATIVE_ONLY_NOT_APPROVED',version:3}),input={...f.input,candidateManifestDigest:sha(manifest)},inputRaw=canonical(input),inputDigest=await trustedGenerationInputDigestV1(input);
 const update=(source:typeof f.source)=>({...source,numericAuthorityRaw:raw({...JSON.parse(source.numericAuthorityRaw),trustedGenerationInputRaw:inputRaw,generationInputDigest:inputDigest}),
  bindingsRaw:raw(JSON.parse(source.bindingsRaw).map((b:Record<string,unknown>)=>({...b,manifestDigest:input.candidateManifestDigest})))});
 const ordinary=update(f.source),sources=new Map<string,string>();
 for(const item of [f,f.alternative]){const source=update(item.source),g=await graphSourceFixtureV3(f.operation,item.snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(ordinary)});sources.set(sha(item.snapshotRaw),raw(g.graphSource));}
 const poolRaw=raw({...f.pool,trustedGenerationInputRaw:inputRaw});const packets=new Map([['pool',poolRaw],...sources.entries()].map(([k,v])=>[k==='pool'?k:'graph:'+k,v]));
 for(const [index,candidate] of f.pool.candidates.entries())packets.set('metrics:'+candidate.snapshotRawSha256,raw({assessmentRevision:id(190000+index),metrics:{targetFit:q(String(index)),diversity:q('0'),convenience:q('0'),shoppingReuse:q('0')}}));
 const prerequisites=readFileSync(new URL('./generation-admission-prerequisites-v1.sql',import.meta.url),'utf8'),draft=readFileSync(new URL('./exact-plan-retention-v3.sql',import.meta.url),'utf8');
 await owner.query(`BEGIN;
 CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE SCHEMA potok_nutrition;CREATE SCHEMA potok_control;
 CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE ROLE potok_generation_gateway_v1 LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2 PASSWORD 'exact-native-only';
 CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id uuid PRIMARY KEY,account_id uuid NOT NULL,selection_id uuid NOT NULL,generation_input_canonical bytea NOT NULL,generation_input_digest bytea NOT NULL,status text NOT NULL);
 CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2(singleton boolean PRIMARY KEY,current_manifest_revision uuid NOT NULL);
 CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision uuid PRIMARY KEY,publication_state text NOT NULL,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL);
 CREATE TABLE potok_nutrition.nutrition_authority_heads_v1(account_id uuid PRIMARY KEY,current_preference_revision uuid NOT NULL,current_safety_revision uuid NOT NULL);
 CREATE TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2(singleton boolean PRIMARY KEY,publication_state text NOT NULL,target_policy_revision uuid,composition_policy_revision uuid,validation_policy_revision uuid,optimization_policy_revision uuid,generation_policy_revision uuid);
 CREATE TABLE potok_control.access_attestations(attestation_id uuid PRIMARY KEY,account_id uuid NOT NULL,capability text NOT NULL,effect text NOT NULL,previous_attestation_id uuid,lineage_sequence bigint NOT NULL,issued_at timestamptz NOT NULL,valid_until timestamptz);
 CREATE TABLE public.user_premium_plan_selections(id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,plan_revision uuid,week_anchor date NOT NULL,timezone text NOT NULL,goal_revision uuid NOT NULL,origin_lineage jsonb NOT NULL);
 CREATE TABLE public.user_goals(user_id uuid PRIMARY KEY,goal_revision uuid NOT NULL);
 ALTER TABLE public.user_premium_plan_selections ENABLE ROW LEVEL SECURITY;ALTER TABLE public.user_premium_plan_selections FORCE ROW LEVEL SECURITY;
 ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;ALTER TABLE public.user_goals FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON public.user_premium_plan_selections,public.user_goals FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;
 SET LOCAL potok.disposable_generation_store='on';${prerequisites}${draft}
 CREATE TABLE potok_nutrition.exact_native_fixture_packets_v3(request_operation_id uuid NOT NULL,key text NOT NULL,raw text NOT NULL,PRIMARY KEY(request_operation_id,key));
 ALTER TABLE potok_nutrition.exact_native_fixture_packets_v3 ENABLE ROW LEVEL SECURITY;ALTER TABLE potok_nutrition.exact_native_fixture_packets_v3 FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON potok_nutrition.exact_native_fixture_packets_v3 FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;
 CREATE FUNCTION potok_nutrition.read_exact_native_fixture_packet_v3(operation uuid,packet_key text) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 DECLARE answer text;BEGIN PERFORM potok_nutrition.load_locked_exact_plan_admission_v3(operation,NULL);SELECT raw INTO answer FROM potok_nutrition.exact_native_fixture_packets_v3 WHERE request_operation_id=operation AND key=packet_key FOR SHARE;RETURN answer;END $fn$;
 REVOKE ALL ON FUNCTION potok_nutrition.read_exact_native_fixture_packet_v3(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION potok_nutrition.read_exact_native_fixture_packet_v3(uuid,text) TO potok_generation_gateway_v1;
 COMMIT;`);
 await owner.query('INSERT INTO potok_nutrition.adaptive_nutrition_generation_requests_v2 VALUES($1,$2,$3,$4,$5,$6)',[f.operation,input.accountId,input.selection.selectionId,Buffer.from(inputRaw),Buffer.from(inputDigest,'hex'),'REQUESTED']);
 await owner.query('INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2 VALUES($1,$2,$3,$4)',[input.candidateManifestRevision,'PUBLISHED',Buffer.from(manifest),Buffer.from(input.candidateManifestDigest,'hex')]);
 await owner.query('INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 VALUES(true,$1)',[input.candidateManifestRevision]);
 await owner.query('INSERT INTO potok_nutrition.nutrition_authority_heads_v1 VALUES($1,$2,$3)',[input.accountId,input.preferenceRevision,input.safetyRevision]);
 await owner.query('INSERT INTO potok_nutrition.adaptive_nutrition_generation_policy_head_v2 VALUES(true,$1,$2,$3,$4,$5,$6)',['PUBLISHED',input.goalNutritionTarget.targetPolicyRevision,input.compositionPolicyRevision,input.validationPolicyRevision,input.optimizationPolicyRevision,input.generationPolicyRevision]);
 await owner.query("INSERT INTO potok_control.access_attestations VALUES($1,$2,'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',statement_timestamp()+interval '1 day')",[input.entitlementEvidenceRevision,input.accountId]);
 await owner.query("INSERT INTO public.user_premium_plan_selections VALUES($1,$2,'pending_generation',NULL,$3,$4,$5,$6)",[input.selection.selectionId,input.accountId,input.weekStartLocal,input.timezone,input.goalNutritionTarget.goalRevision,{provisionOperationId:input.selection.planSelectionRevision}]);
 await owner.query('INSERT INTO public.user_goals VALUES($1,$2)',[input.accountId,input.goalNutritionTarget.goalRevision]);
 for(const [key,value] of packets)await owner.query('INSERT INTO potok_nutrition.exact_native_fixture_packets_v3 VALUES($1,$2,$3)',[f.operation,key,value]);
 const rawPool=new Pool({host:'127.0.0.1',port:5432,database:'potok_generation_store_disposable',user:'potok_generation_gateway_v1',password:'exact-native-only',ssl:false,max:2,connectionTimeoutMillis:5000,
  options:'-c search_path=pg_catalog -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000',application_name:'potok-exact-v3-native'});
 const pool=adaptGenerationNodePgPoolV1<ExactPlanSqlRowV3>(rawPool,()=>true);
 const factory=(client:ExactPlanSqlSourceClientV3)=>{
  const packet=async(operation:string,key:string)=>(await client.query(packetSqlV3,[operation,key])).rows[0].result_raw;
  return createExactWeekOptimizationV3({loadForOperationRaw:op=>packet(op,'pool')},{loadForProposalRaw:(op,subject)=>packet(op,'graph:'+subject)},
   {assessGraphRaw:async(op,graphRaw,digest,policy)=>{const g=JSON.parse(graphRaw),source=await packet(op,'metrics:'+g.evaluatedSnapshotRawSha256);if(source===null)return null;const values=JSON.parse(source);
    return raw({contract:exactWeekMetricsContractV3,requestOperationId:op,generationInputDigest:digest,graphDigest:g.digest,graphRawSha256:sha(graphRaw),evaluatedSnapshotRawSha256:g.evaluatedSnapshotRawSha256,
     optimizationPolicyRevision:input.optimizationPolicyRevision,optimizationPolicyRawSha256:sha(policy),assessmentRevision:values.assessmentRevision,metrics:values.metrics});}},authorized);
 };
 const storeFor=(p:GenerationTransactionPoolV1<ExactPlanSqlRowV3>)=>createExactPlanPostgresStoreV3(p,[packetSqlV3],factory,()=>true);
 const store=storeFor(pool),service=createExactPlanAdmissionV3(store,()=>true);
 return {owner,pool,rawPool,store,storeFor,service,input,operation:f.operation,inputDigest,literal,canonical,async close(){await pool.close();await owner.end();}};
}
