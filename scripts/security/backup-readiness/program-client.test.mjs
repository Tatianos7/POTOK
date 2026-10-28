import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {makeProgramManifest} from './program-fixture-sql.mjs';
import {seedProgramSQL,fixtureTables,fixtureObservationSQL,validateFixtureObservation,cleanupProgramSQL} from './program-client-sql.mjs';
const m=makeProgramManifest(['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']);
test('committed seed has exactly 24 inserts and no SQL role test writes, grants, schema change or trigger bypass',()=>{const sql=seedProgramSQL(m);assert.equal((sql.match(/^INSERT INTO public\./gm)||[]).length,24);assert(sql.endsWith('COMMIT;'));assert(!/SET LOCAL ROLE|ROLLBACK|\bUPDATE\b|\bDELETE\b|\bGRANT\b|\bREVOKE\b|ALTER TABLE|DISABLE TRIGGER|replication_role/.test(sql));assert(sql.includes('Fixture id collision'));assert.equal(fixtureTables(m).reduce((n,t)=>n+t.ids.length,0),24);});
test('cleanup requires complete observed seeded graph, refuses missing/foreign/modified identity before SQL generation',()=>{assert.throws(()=>cleanupProgramSQL(m,{}));const rows=Object.fromEntries(fixtureTables(m).map(t=>[t.name,t.ids.map(id=>({id}))]));assert.throws(()=>validateFixtureObservation(m,rows));assert.throws(()=>cleanupProgramSQL(m,rows));assert(fixtureObservationSQL(m).includes('WHERE id IN('));assert(!fixtureObservationSQL(m).includes('auth.users'));});
test('private entry refuses arbitrary commit target before Docker and does not expose input',()=>{const r=spawnSync(process.execPath,[new URL('program-client.mjs',import.meta.url).pathname,'--apply','https://example.invalid'],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/phase=admission/);assert(!r.stderr.includes('example.invalid'));});
