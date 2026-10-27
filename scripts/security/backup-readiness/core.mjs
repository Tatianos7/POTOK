import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const id='(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)';
const header=new RegExp('^COPY\\s+('+id+')\\.('+id+')\\s+\\((.*)\\)\\s+FROM stdin;\\s*$','i');
const decode=s=>s.startsWith('"')?s.slice(1,-1).replace(/""/g,'"'):s;
const key=t=>JSON.stringify([t.schema,t.name]);
export const quote=s=>'"'+s.replace(/"/g,'""')+'"';
const literal=s=>"'"+s.replace(/'/g,"''")+"'";
function columns(text){
 const re=new RegExp('\\s*('+id+')\\s*(,|$)','y');let at=0;const cols=[];
 while(at<text.length){re.lastIndex=at;const m=re.exec(text);assert(m,'Unsupported COPY columns');cols.push(decode(m[1]));at=re.lastIndex;if(!m[2])break;assert(at<text.length,'Trailing COPY column separator');}
 assert(cols.length>0&&new Set(cols).size===cols.length&&at===text.length,'Invalid COPY columns');return cols;
}
export async function parseCopy(lines){
 const result=[];let current=null;
 for await(const raw of lines){const line=raw.replace(/\r$/,'');
  if(current){if(line==='\\.'){result.push(current);current=null;}else{assert.equal(line.split('\t').length,current.columns.length,'COPY field count mismatch');current.rows=(BigInt(current.rows)+1n).toString();}continue;}
  if(/^COPY\s/i.test(line)){const m=line.match(header);assert(m,'Unsupported COPY syntax');current={schema:decode(m[1]),name:decode(m[2]),columns:columns(m[3]),rows:'0'};continue;}
  assert(!/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i.test(line),'Non-COPY data mutation requires review');
  assert(!/^\s*\\/.test(line)||/^\\(?:un)?restrict\s+[A-Za-z0-9]+\s*$/.test(line),'Unexpected psql metacommand');
 }
 assert(!current,'Truncated COPY block');assert(result.length>0&&result.length<=1000,'No supported COPY scope');assert.equal(new Set(result.map(key)).size,result.length,'Duplicate COPY target');return result;
}
export function assessScope(tables,inventory){
 assert.equal(inventory.protocol,'potok-backup-scope-inventory-v1');
 const allowedExclusions=new Set([JSON.stringify(['auth','schema_migrations']),JSON.stringify(['storage','migrations']),JSON.stringify(['storage','buckets_vectors']),JSON.stringify(['storage','vector_indexes'])]);
 assert(inventory.exclusions.every(t=>allowedExclusions.has(key(t))),'Unreviewed exclusion');
 const excluded=new Set(inventory.exclusions.map(key));assert.equal(excluded.size,inventory.exclusions.length);
 assert.equal(new Set(inventory.tables.map(key)).size,inventory.tables.length,'Duplicate inventory target');
 assert(inventory.tables.every(t=>['auth','public','storage'].includes(t.schema)&&t.kind==='r'&&!t.partition),'Partitioned or unknown scope needs review');
 const required=inventory.tables.filter(t=>!excluded.has(key(t)));
 assert.equal(new Set(tables.map(key)).size,tables.length,'Duplicate COPY target');
 assert.deepEqual(tables.map(key).sort(),required.map(key).sort(),'COPY table scope differs from reviewed inventory');
 for(const t of tables){const actual=required.find(r=>key(r)===key(t));assert.deepEqual(t.columns,actual.columns.filter(c=>c.generated==='').map(c=>c.name),'COPY columns differ from reviewed inventory');assert(/^\d+$/.test(t.rows));}
 return {tables:tables.length,rows:tables.reduce((n,t)=>n+BigInt(t.rows),0n).toString(),inventoryObservedAt:inventory.observedAt,exclusions:inventory.exclusions,mayApply:false,releaseReady:false};
}
export function contentSQL(tables,binding){
 assert(tables.length>0&&tables.length<=1000);assert.equal(new Set(tables.map(key)).size,tables.length);assert.match(binding,/^[a-f0-9]{64}$/);
 for(const t of tables){assert(['auth','public','storage'].includes(t.schema));assert(t.columns.length>0&&new Set(t.columns).size===t.columns.length);}
 const queries=tables.map(t=>{const table=quote(t.schema)+'.'+quote(t.name);return `SELECT ${literal(t.schema)}::text AS schema,${literal(t.name)}::text AS name,count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(digest,'' ORDER BY digest),''),'UTF8')),'hex') AS hash FROM (SELECT encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') AS digest FROM (SELECT ${t.columns.map(quote).join(',')} FROM ${table}) r) h`;});
 return `-- PRIVATE evidence only. Run independently on the original restored backup and current target.
-- Produces counts and aggregate hashes, never source records. Not a dump or restore/apply script.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
SET LOCAL datestyle='ISO,YMD';
SET LOCAL row_security=off;
SET LOCAL extra_float_digits=3;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='3s';
SELECT jsonb_build_object('protocol','potok-backup-content-observation-v1','binding',${literal(binding)},'observedAt',transaction_timestamp(),'serverVersionNum',current_setting('server_version_num')::integer,'readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),'inventory',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'partition',c.relispartition,'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind IN('r','p')),'tables',(SELECT jsonb_agg(to_jsonb(q) ORDER BY schema,name) FROM (${queries.join('\nUNION ALL\n')}) q)) AS evidence;
ROLLBACK;
`;
}
export function compareContent(tables,restored,target,binding,{now=Date.now()}={}){
 const exclusions=[['auth','schema_migrations'],['storage','migrations'],['storage','buckets_vectors'],['storage','vector_indexes']].map(([schema,name])=>({schema,name}));
 assert.notEqual(restored.observedAt,target.observedAt,'Independent observation timestamps required');
 for(const r of [restored,target]){assert.equal(r.readOnly,'on');assert.equal(r.isolation,'repeatable read');assert(Number.isInteger(r.serverVersionNum)&&r.serverVersionNum>=170000&&r.serverVersionNum<180000);const time=Date.parse(r.observedAt);assert(Number.isFinite(time)&&time<=now+60000&&now-time<=15*60*1000,'Observation expired or clock mismatch');assessScope(tables,{protocol:'potok-backup-scope-inventory-v1',tables:r.inventory,exclusions});assert.equal(r.protocol,'potok-backup-content-observation-v1');assert.equal(r.binding,binding);assert.equal(new Set(r.tables.map(key)).size,r.tables.length);assert.deepEqual(r.tables.map(key).sort(),tables.map(key).sort());for(const t of r.tables){assert(/^\d+$/.test(t.rows));assert.match(t.hash,/^[a-f0-9]{64}$/);}}
 const mismatches=[];for(const t of tables){
 const shapeA=restored.inventory.find(r=>key(r)===key(t)),shapeB=target.inventory.find(r=>key(r)===key(t));
 const shape=columns=>columns.map(c=>[c.name,c.type,c.generated]);
 const columnsChanged=JSON.stringify(shape(shapeA.columns))!==JSON.stringify(shape(shapeB.columns));const a=restored.tables.find(r=>key(r)===key(t)),b=target.tables.find(r=>key(r)===key(t));if(columnsChanged||a.rows!==t.rows||a.rows!==b.rows||a.hash!==b.hash)mismatches.push({schema:t.schema,name:t.name});}
 return {status:mismatches.length?'CONTENT_MISMATCH_STOP':'LOGICAL_SCOPE_CONTENT_MATCH_AT_OBSERVATIONS',tablesChecked:tables.length,mismatches,releaseReady:false,mayApply:false,storageBinariesVerified:false,schemaAndConfigVerified:false,sequenceStateVerified:false,note:'Requires independently trusted capture provenance and fresh schema/Storage/config checks; observations are not simultaneous and do not authorize a release.'};
}
