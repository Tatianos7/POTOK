import assert from 'node:assert/strict';
import {cleanupProgramSQL} from './program-client-sql.mjs';
export function programUICleanupSQL(manifest,seeded){
 const expected=structuredClone(seeded);for(const name of ['nutrition_programs','training_programs'])for(const row of expected[name])delete row.updated_at;
 const sql=cleanupProgramSQL(manifest,expected),anchor="IF actual IS DISTINCT FROM ";assert.equal(sql.split(anchor).length,2);
 const normalize=['nutrition_programs','training_programs'].map(name=>`IF EXISTS(SELECT FROM jsonb_array_elements(actual->'${name}') v WHERE v->>'status' NOT IN('active','paused')) THEN RAISE EXCEPTION 'Unexpected fixture status';END IF;
actual:=jsonb_set(actual,'{${name}}',(SELECT jsonb_agg(jsonb_set(v-'updated_at','{status}','"active"'::jsonb) ORDER BY v->>'id') FROM jsonb_array_elements(actual->'${name}') v));`).join('\n');
 return sql.replace(anchor,normalize+'\n'+anchor);
}
