import assert from 'node:assert/strict';
import test from 'node:test';
import {ok,literal} from './generation-validation-fixture-v1';
import {createGenerationSqlGatewayV1,generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationActivateGatewaySqlV1} from '../../src/server/generationSqlGatewayV1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const request='00000000-0000-4000-8000-000000000001';
// Dedicated disposable SQL transport/identity fixture, not the real ledger writer.
// No credentials/TLS/real backend login or source admission are established here.
test('native SQL gateway parameter and execution-identity boundary',{skip:!native},async t=>{
  assert.equal(ok('SELECT current_database();'),'potok_generation_store_disposable');
  ok(`BEGIN;
    CREATE SCHEMA potok_nutrition;
    CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE transport_backend_fixture NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE transport_admin_fixture NOLOGIN CREATEROLE NOBYPASSRLS;
    GRANT service_role TO transport_backend_fixture,transport_admin_fixture;
    GRANT USAGE ON SCHEMA potok_nutrition TO anon,authenticated,service_role,transport_backend_fixture;
    CREATE TABLE potok_nutrition.transport_events(operation text,request_id uuid,payload bytea);
    REVOKE ALL ON potok_nutrition.transport_events FROM PUBLIC,anon,authenticated,service_role,transport_backend_fixture;
    CREATE FUNCTION potok_nutrition.load_generation_request_v2(p_request_operation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
    BEGIN
      INSERT INTO potok_nutrition.transport_events VALUES ('load',p_request_operation_id,NULL);
      RETURN jsonb_build_object('contract','potok-adaptive-generation-request-status-v2','requestOperationId',p_request_operation_id,
        'status','GENERATED','retryable',true,'reasonCode',NULL,'generationInputCanonicalHex',NULL,'candidateManifestCanonicalHex',NULL,'attemptOperationId',NULL);
    END $fn$;
    CREATE FUNCTION potok_nutrition.record_generated_week_gateway_v2(p_request_operation_id uuid,p_generated_week_plan_canonical bytea) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
    BEGIN
      INSERT INTO potok_nutrition.transport_events VALUES ('record',p_request_operation_id,p_generated_week_plan_canonical);
      RETURN jsonb_build_object('contract','potok-adaptive-generation-request-status-v2','requestOperationId',p_request_operation_id,
        'status','GENERATED','retryable',true,'reasonCode',NULL);
    END $fn$;
    CREATE FUNCTION potok_nutrition.activate_generated_week_gateway_v2(p_request_operation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
    BEGIN
      INSERT INTO potok_nutrition.transport_events VALUES ('activate',p_request_operation_id,NULL);
      RETURN jsonb_build_object('contract','potok-adaptive-generation-request-status-v2','requestOperationId',p_request_operation_id,
        'status','ACTIVE','retryable',false,'reasonCode',NULL);
    END $fn$;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role,transport_backend_fixture;
    GRANT EXECUTE ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),potok_nutrition.activate_generated_week_gateway_v2(uuid) TO service_role;
    COMMIT;`);
  let prefix='SET SESSION AUTHORIZATION transport_backend_fixture;SET ROLE service_role;';
  let executed=0;
  const client=createGenerationSqlGatewayV1({async query(statement,parameters){
    assert.ok([generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationActivateGatewaySqlV1].includes(statement));executed++;
    // Fixed loopback-only fixture substitution, not the production parameterized driver.
    const sql=statement.replace(/\$(\d+)/g,(_m,n)=>literal(parameters[Number(n)-1]));
    const result=ok(prefix+sql+';');return {rows:[{result_raw:JSON.parse(result)}]};
  }},()=>true);
  const args={p_request_operation_id:request};
  await t.test('nonowner SQL session with actual service_role execution can call the exact three protected names',async()=>{
    assert.equal((await client.rpc('load_generation_request_v2',args)).error,null);
    const bytes=Buffer.from('{"unicode":"Привет","literal":"$1; DROP TABLE x; --"}').toString('hex');
    assert.equal((await client.rpc('record_generated_week_gateway_v2',{...args,p_generated_week_plan_canonical:'\\x'+bytes})).error,null);
    assert.equal((await client.rpc('activate_generated_week_gateway_v2',args)).error,null);
    assert.equal(ok("SELECT encode(payload,'hex') FROM potok_nutrition.transport_events WHERE operation='record';"),bytes);
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.transport_events;'),'3');
  });
  await t.test('owner and owner SET ROLE cannot turn owner credentials into an admitted gateway',async()=>{
    for(const identity of ['', 'SET ROLE service_role;']){prefix=identity;
      assert.notEqual((await client.rpc('activate_generated_week_gateway_v2',args)).error,null);
    }
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.transport_events;'),'3');
  });
  await t.test('JWT/GUC claims and current role without the real execution role cannot grant access',async()=>{
    for(const identity of ['SET SESSION AUTHORIZATION authenticated;', 'SET SESSION AUTHORIZATION transport_backend_fixture;']){
      prefix=identity+"SET request.jwt.claim.role='service_role';SET request.jwt.claims='{\"role\":\"service_role\"}';";
      assert.notEqual((await client.rpc('activate_generated_week_gateway_v2',args)).error,null);
    }
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.transport_events;'),'3');
  });
  await t.test('BYPASSRLS session identity is rejected even when the effective role is service_role',async()=>{
    for(const identity of ['SET SESSION AUTHORIZATION service_role;','SET SESSION AUTHORIZATION transport_admin_fixture;SET ROLE service_role;']){
      prefix=identity;assert.notEqual((await client.rpc('activate_generated_week_gateway_v2',args)).error,null);
    }
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.transport_events;'),'3');
  });
  await t.test('unknown operations never enter the driver and no internal table grant is needed',async()=>{
    const before=executed;await assert.rejects(client.rpc('record_generated_week_v2',args));assert.equal(executed,before);
    assert.equal(ok("SELECT has_table_privilege('service_role','potok_nutrition.transport_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');"),'f');
  });
});
