// Review fragments: caller must supply the approved outer transaction and locks.
// Only temporary evidence is written; no persistent function or application DML.
import assert from 'node:assert/strict';
function scopeJSON(tables){assert(Array.isArray(tables)&&tables.length>0&&tables.length<=116);const seen=new Set();for(const t of tables){assert(['auth','public','storage'].includes(t.schema));assert.match(t.name,/^[a-z_][a-z0-9_]*$/);const k=t.schema+'.'+t.name;assert(!seen.has(k));seen.add(k);}return JSON.stringify(tables.map(({schema,name})=>({schema,name})));}
const digest=`SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(to_jsonb(row_data)::text,'UTF8')),'hex') h FROM (SELECT %s FROM %I.%I) row_data) fingerprints`;
export function beforeRowsSQL(tables){const scope=scopeJSON(tables);return `-- REVIEW FRAGMENT: requires approved outer BEGIN and all named table locks.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
CREATE TEMP TABLE potok_release_rows_v1(table_schema text,table_name text,column_sql text NOT NULL,n bigint NOT NULL,h text NOT NULL,PRIMARY KEY(table_schema,table_name)) ON COMMIT DROP;
DO $row_before$ DECLARE r record;cols text;total bigint;digest text;BEGIN
 FOR r IN SELECT * FROM jsonb_to_recordset($scope$${scope}$scope$::jsonb) AS x(schema text,name text) LOOP
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum) INTO cols FROM pg_attribute a WHERE a.attrelid=to_regclass(format('%I.%I',r.schema,r.name)) AND a.attnum>0 AND NOT a.attisdropped;
  IF cols IS NULL THEN RAISE EXCEPTION 'RELEASE_ROW_SCOPE_STOPPED';END IF;
  EXECUTE format($digest$${digest}$digest$,cols,r.schema,r.name) INTO total,digest;
  INSERT INTO pg_temp.potok_release_rows_v1 VALUES(r.schema,r.name,cols,total,digest);
 END LOOP;
END $row_before$;
`;}
export function afterRowsSQL(tables){const scope=scopeJSON(tables);return `-- REVIEW FRAGMENT: preserve old columns; approved nullable additions do not rewrite old data.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
DO $row_after$ DECLARE r record;total bigint;digest text;BEGIN
 IF (SELECT count(*) FROM pg_temp.potok_release_rows_v1)<>${tables.length} OR EXISTS(
 SELECT schema,name FROM jsonb_to_recordset($scope$${scope}$scope$::jsonb) AS x(schema text,name text)
 EXCEPT SELECT table_schema,table_name FROM pg_temp.potok_release_rows_v1)
 THEN RAISE EXCEPTION 'RELEASE_ROW_SCOPE_STOPPED';END IF;
 FOR r IN SELECT * FROM pg_temp.potok_release_rows_v1 ORDER BY table_schema,table_name LOOP
  EXECUTE format($digest$${digest}$digest$,r.column_sql,r.table_schema,r.table_name) INTO total,digest;
  IF total IS DISTINCT FROM r.n OR digest IS DISTINCT FROM r.h THEN RAISE EXCEPTION 'RELEASE_ROW_CONTENT_STOPPED';END IF;
 END LOOP;
 RAISE NOTICE 'TARGET_ROWS_PRESERVED_OK';
END $row_after$;
`;}
