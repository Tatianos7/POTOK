#!/usr/bin/env bash
set -euo pipefail

for required_command in docker node curl timeout sed grep seq mktemp; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "required command is unavailable: ${required_command}" >&2
    exit 127
  fi
done

readonly pg_image='postgres:17.11-bookworm'
readonly postgrest_image='postgrest/postgrest:v13.0.7'
readonly suffix="$$"
readonly network="p5-02-network-${suffix}"
readonly pg_container="p5-02-postgres-${suffix}"
readonly postgrest_container="p5-02-postgrest-${suffix}"
readonly root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly wire_fixture="${root}/docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.acceptance.sql"
readonly effective_fixture="${root}/docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.effective-fixture.sql"
readonly effective_postcheck="${root}/docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.effective-postcheck.sql"
readonly repair="${root}/docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.repair.sql"
body_file="$(mktemp)"
engine_output="$(mktemp)"

docker_limited() { timeout 30s docker "$@"; }
psql_db() {
  local database="$1"
  shift
  docker_limited exec --interactive "${pg_container}" psql \
    --username postgres --dbname "${database}" --set ON_ERROR_STOP=1 "$@"
}
cleanup() {
  rm -f "${body_file}" "${engine_output}"
  timeout 15s docker rm -f "${postgrest_container}" "${pg_container}" >/dev/null 2>&1 || true
  timeout 15s docker network rm "${network}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker_limited network create "${network}" >/dev/null
docker_limited run --detach --name "${pg_container}" --network "${network}" \
  --env POSTGRES_PASSWORD=p5_02_disposable "${pg_image}" >/dev/null
for _ in $(seq 1 45); do
  if docker_limited exec "${pg_container}" pg_isready --username postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker_limited exec "${pg_container}" pg_isready --username postgres >/dev/null

# Layer 1: exact effective definitions, target repair, 11 replacements, metadata.
psql_db postgres < "${effective_fixture}"
node "${root}/scripts/acceptance/extract-adaptive-nutrition-effective-functions-v1.mjs" \
  | psql_db postgres
psql_db postgres <<'SQL'
ALTER FUNCTION public.adaptive_nutrition_mutate_v1(text) OWNER TO p5_02_function_owner;
ALTER FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb) OWNER TO p5_02_function_owner;
REVOKE ALL ON FUNCTION public.adaptive_nutrition_mutate_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_mutate_v1(text) TO authenticated, p5_02_observer;
INSERT INTO public.p5_02_function_metadata_before
SELECT p.oid::regprocedure::text, p.proowner, p.prosecdef, p.proconfig, p.proacl
  FROM pg_proc p
 WHERE p.oid IN (
   'public.adaptive_nutrition_mutate_v1(text)'::regprocedure,
   'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::regprocedure
 );
SQL
psql_db postgres < "${repair}"
psql_db postgres < "${effective_postcheck}"

# A late source-drift failure must roll back the earlier function replacement.
docker_limited exec "${pg_container}" createdb --username postgres p5_02_drift
psql_db p5_02_drift < "${effective_fixture}"
node "${root}/scripts/acceptance/extract-adaptive-nutrition-effective-functions-v1.mjs" --drift-internal \
  | psql_db p5_02_drift
if psql_db p5_02_drift < "${repair}" >/dev/null 2>&1; then
  echo 'source-drift repair unexpectedly succeeded' >&2
  exit 1
fi
drift_counts="$(psql_db p5_02_drift --tuples-only --no-align --command \
  "SELECT regexp_count(pg_get_functiondef('public.adaptive_nutrition_mutate_v1(text)'::regprocedure), 'ERRCODE\\s*=\\s*''40001''')::text || ':' || regexp_count(pg_get_functiondef('potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::regprocedure), 'ERRCODE\\s*=\\s*''40001''')::text;")"
test "${drift_counts}" = '6:5'

# Layer 2: a real native 40001 from two concurrent SERIALIZABLE transactions.
set +e
psql_db postgres --set VERBOSITY=verbose --command \
  "BEGIN ISOLATION LEVEL SERIALIZABLE; SELECT value FROM public.p5_02_serializable_counter WHERE id=1; SELECT pg_sleep(2); UPDATE public.p5_02_serializable_counter SET value=value+1 WHERE id=1; COMMIT;" \
  >"${engine_output}" 2>&1 &
engine_pid=$!
set -e
sleep 0.5
psql_db postgres --command \
  "BEGIN ISOLATION LEVEL SERIALIZABLE; SELECT value FROM public.p5_02_serializable_counter WHERE id=1; UPDATE public.p5_02_serializable_counter SET value=value+1 WHERE id=1; COMMIT;" >/dev/null
if wait "${engine_pid}"; then
  echo 'concurrent transaction unexpectedly committed' >&2
  exit 1
fi
grep -F -- '40001' "${engine_output}" >/dev/null
test "$(psql_db postgres --tuples-only --no-align --command 'SELECT value FROM public.p5_02_serializable_counter WHERE id=1;')" = '1'

# Layer 3: synthetic wire mapping and rollback probe through PostgREST only.
psql_db postgres < "${wire_fixture}"
docker_limited run --detach --name "${postgrest_container}" --network "${network}" \
  --publish 127.0.0.1::3000 \
  --env PGRST_DB_URI="postgres://postgres:p5_02_disposable@${pg_container}:5432/postgres" \
  --env PGRST_DB_SCHEMAS=public --env PGRST_DB_ANON_ROLE=anon \
  "${postgrest_image}" >/dev/null
readonly port="$(docker_limited port "${postgrest_container}" 3000/tcp | sed 's/.*://')"
readonly endpoint="http://127.0.0.1:${port}/rpc/p5_02_error_contract_probe"
for _ in $(seq 1 45); do
  if curl --silent --connect-timeout 2 --max-time 3 --output /dev/null "http://127.0.0.1:${port}/"; then break; fi
  sleep 1
done

reset_probe() {
  psql_db postgres --command "TRUNCATE public.p5_02_probe_effects, public.p5_02_probe_receipts; SELECT setval('public.p5_02_probe_invocations', 1, false);" >/dev/null
}
assert_rollback_once() {
  local actual
  actual="$(psql_db postgres --tuples-only --no-align --command \
    "SELECT last_value::text || ':' || is_called::text || ':' || (SELECT count(*) FROM public.p5_02_probe_effects)::text || ':' || (SELECT count(*) FROM public.p5_02_probe_receipts)::text FROM public.p5_02_probe_invocations;")"
  test "${actual}" = '1:true:0:0'
}
post_probe() {
  curl --silent --show-error --connect-timeout 3 --max-time 10 \
    --output "${body_file}" --write-out '%{http_code}' \
    --header 'Content-Type: application/json' --data "$1" "${endpoint}"
}

reset_probe
test "$(post_probe '{"mode":"business_conflict","operation_id":"00000000-0000-4000-8000-000000000011"}')" = '409'
grep -F -- '"code":"PT409"' "${body_file}" >/dev/null
grep -F -- '"details":"POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1"' "${body_file}" >/dev/null
assert_rollback_once

reset_probe
test "$(post_probe '{"mode":"server_integrity","operation_id":"00000000-0000-4000-8000-000000000012"}')" = '500'
grep -F -- '"code":"PT500"' "${body_file}" >/dev/null
grep -F -- '"details":"POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1"' "${body_file}" >/dev/null
assert_rollback_once

printf 'PostgreSQL: '
psql_db postgres --tuples-only --no-align --command 'SHOW server_version;'
printf 'PostgREST: '
docker_limited exec "${postgrest_container}" postgrest --version
printf 'P5-02 target repair, native concurrency, and wire acceptance: PASS\n'
