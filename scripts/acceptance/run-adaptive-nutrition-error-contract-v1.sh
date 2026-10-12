#!/usr/bin/env bash
set -euo pipefail

readonly pg_image='postgres:17.11-bookworm'
readonly postgrest_image='postgrest/postgrest:v13.0.7'
readonly suffix="$$"
readonly network="p5-02-network-${suffix}"
readonly pg_container="p5-02-postgres-${suffix}"
readonly postgrest_container="p5-02-postgrest-${suffix}"
readonly fixture="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.acceptance.sql"
body_file="$(mktemp)"

cleanup() {
  rm -f "${body_file}"
  docker rm -f "${postgrest_container}" "${pg_container}" >/dev/null 2>&1 || true
  docker network rm "${network}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "${network}" >/dev/null
docker run --detach --name "${pg_container}" --network "${network}" \
  --env POSTGRES_PASSWORD=p5_02_disposable \
  "${pg_image}" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "${pg_container}" pg_isready --username postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "${pg_container}" pg_isready --username postgres >/dev/null
docker exec --interactive "${pg_container}" psql \
  --username postgres --dbname postgres --set ON_ERROR_STOP=1 < "${fixture}"

docker run --detach --name "${postgrest_container}" --network "${network}" \
  --publish 127.0.0.1::3000 \
  --env PGRST_DB_URI="postgres://postgres:p5_02_disposable@${pg_container}:5432/postgres" \
  --env PGRST_DB_SCHEMAS=public \
  --env PGRST_DB_ANON_ROLE=anon \
  "${postgrest_image}" >/dev/null
readonly port="$(docker port "${postgrest_container}" 3000/tcp | sed 's/.*://')"
readonly endpoint="http://127.0.0.1:${port}/rpc/p5_02_error_contract_probe"
for _ in $(seq 1 60); do
  if curl --silent --output /dev/null "http://127.0.0.1:${port}/"; then break; fi
  sleep 1
done

reset_probe() {
  docker exec "${pg_container}" psql --username postgres --dbname postgres --tuples-only --no-align \
    --command "TRUNCATE public.p5_02_probe_effects, public.p5_02_probe_receipts; SELECT setval('public.p5_02_probe_invocations', 1, false);" >/dev/null
}

assert_rollback_once() {
  local actual
  actual="$(docker exec "${pg_container}" psql --username postgres --dbname postgres --tuples-only --no-align \
    --command "SELECT last_value::text || ':' || is_called::text || ':' || (SELECT count(*) FROM public.p5_02_probe_effects)::text || ':' || (SELECT count(*) FROM public.p5_02_probe_receipts)::text FROM public.p5_02_probe_invocations;")"
  test "${actual}" = '1:true:0:0'
}

reset_probe
status="$(curl --silent --output "${body_file}" --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{"mode":"business_conflict","operation_id":"00000000-0000-4000-8000-000000000011"}' \
  "${endpoint}")"
test "${status}" = '409'
rg --fixed-strings '"code":"PT409"' "${body_file}" >/dev/null
rg --fixed-strings '"details":"POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1"' "${body_file}" >/dev/null
assert_rollback_once

reset_probe
status="$(curl --silent --output "${body_file}" --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{"mode":"server_integrity","operation_id":"00000000-0000-4000-8000-000000000012"}' \
  "${endpoint}")"
test "${status}" = '500'
rg --fixed-strings '"code":"PT500"' "${body_file}" >/dev/null
rg --fixed-strings '"details":"POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1"' "${body_file}" >/dev/null
assert_rollback_once

reset_probe
status="$(curl --silent --output "${body_file}" --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{"mode":"engine_serialization","operation_id":"00000000-0000-4000-8000-000000000013"}' \
  "${endpoint}")"
test "${status}" = '500'
rg --fixed-strings '"code":"40001"' "${body_file}" >/dev/null
rollback_counts="$(docker exec "${pg_container}" psql --username postgres --dbname postgres --tuples-only --no-align \
  --command "SELECT (SELECT count(*) FROM public.p5_02_probe_effects)::text || ':' || (SELECT count(*) FROM public.p5_02_probe_receipts)::text;")"
test "${rollback_counts}" = '0:0'

printf 'PostgreSQL: '
docker exec "${pg_container}" psql --username postgres --dbname postgres --tuples-only --no-align \
  --command 'SHOW server_version;'
printf 'PostgREST: '
docker exec "${postgrest_container}" postgrest --version
printf 'P5-02 disposable transport acceptance: PASS\n'
