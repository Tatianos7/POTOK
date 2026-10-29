// Real PostgreSQL JSON/trigger-definition integration in disposable CI only.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {observationSQL} from './program-auth-metadata-review.mjs';
import {assertOriginalAuthObservation,triggerOidKey} from './program-auth-continuity.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const r=spawnSync('docker',['exec','-i','supabase_db_potok-photo-http-acceptance','sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /run/postgresql -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:observationSQL,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
assert.equal(r.status,0);const live=JSON.parse(r.stdout.trim());
const expected=live.logical.triggers.filter(t=>t[2].includes('FROM potok_control.access_attestations'));
assert.equal(expected.length,2);assert(expected.every(t=>typeof t[0]==='string'));for(const t of expected)triggerOidKey(t[0]);
// Simulate only the reviewed pre-install boundary using actual pg_get_triggerdef
// rows; this is not a reconstruction or claim about private owner evidence.
const original=structuredClone(live);original.logical.triggers=original.logical.triggers.filter(t=>!expected.some(x=>x[0]===t[0]));
assertOriginalAuthObservation(original,live.logical);
for(const alteration of [t=>{t[1]='D';},t=>{t[2]=t[2].replace('access_attestations','unknown_table');},t=>{t[2]+=' WHEN (true)';}]){
 const b=structuredClone(live.logical);alteration(b.triggers.find(t=>t[0]===expected[0][0]));assert.throws(()=>assertOriginalAuthObservation(original,b));
}
console.log('AUTH_TRIGGER_NATIVE_JSON_OK: actual PostgreSQL oid strings and full FK trigger definitions verified; unexpected trigger changes rejected; read-only disposable CI.');
