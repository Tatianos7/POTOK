import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const targetProjectId='ozidryfvhkcbtpnulakq';
const sourceCommit='56e14043863504d93d2d8281f7c6b63bf22c5837';
const root=new URL('../../../',import.meta.url);
const expected=[
  ['docs/premium/drafts/generation_source_commit_fence_v1.sql','c571ad2219902275c8f598274a083196de7a2e998c0e0984f308a2e6751f4332',288],
  ['docs/premium/drafts/generation_graph_recipe_identity_v1.sql','81cdecf09a8b1578778e9770cbccebfa548b47d902d692cb49754eda89a77e8b',290],
];
const modifiedSignatures=[
  'potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)',
  'potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)',
  'potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)',
  'potok_nutrition.activate_generated_week_gateway_v2(uuid)',
];
const snapshot=`SELECT jsonb_object_agg(p.oid::text,CASE WHEN p.oid IN(
 ${modifiedSignatures.map(s=>`to_regprocedure('${s}')`).join(',')}) THEN to_jsonb(p)-'prosrc' ELSE to_jsonb(p) END)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','potok_nutrition','potok_control')
 AND p.oid IS DISTINCT FROM to_regprocedure('potok_nutrition.assert_generation_source_current_v1(uuid,bytea)')::oid`;

/** Offline review artifact only. No connection, password, apply flag or COMMIT output. */
export function buildGenerationPatchPackageV1({manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url),'utf8')),
  read=path=>readFileSync(new URL(path,root))}={}){
  if(!manifest||manifest.contract!=='potok-generation-patch-package-v1'||manifest.targetProjectId!==targetProjectId
    ||manifest.sourceCommit!==sourceCommit||!Array.isArray(manifest.sources)||manifest.sources.length!==expected.length)
    throw Error('GENERATION_PATCH_MANIFEST_MISMATCH');
  const bodies=expected.map(([path,sha256,pr],i)=>{
    const entry=manifest.sources[i];
    if(!entry||entry.path!==path||entry.sha256!==sha256||entry.pr!==pr)throw Error('GENERATION_PATCH_SOURCE_IDENTITY_MISMATCH');
    const bytes=read(path);
    if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('GENERATION_PATCH_SOURCE_DRIFT');
    const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const match=/^((?:--[^\n]*\n|\s)*?)BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/.exec(source);
    if(!match)throw Error('GENERATION_PATCH_TRANSACTION_SHAPE');
    return `-- Pinned source: ${path}\nEXECUTE $generation_candidate_${i}$\n${match[1]}${match[2]}\n$generation_candidate_${i}$;`;
  });
  const inventory=readFileSync(new URL('inventory.readonly.sql',import.meta.url),'utf8').trim().replace(/;$/,'');
  const inspect=`SELECT readiness INTO observation FROM (\n${inventory}\n) AS inventory`;
  const rollbackSql=`-- REVIEW REHEARSAL ONLY; not permission to apply. Target must be verified externally.\n-- Target label: ${targetProjectId}\nBEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $generation_patch_package$
DECLARE before_functions jsonb; after_functions jsonb; observation jsonb;
BEGIN
 ${inspect};
 IF observation->>'baselineReady' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'GENERATION_PATCH_BASELINE_REQUIRED'; END IF;
 ${snapshot.replace('\n FROM pg_proc',' INTO before_functions\n FROM pg_proc')};
 ${bodies.join('\n')}
 ${snapshot.replace('\n FROM pg_proc',' INTO after_functions\n FROM pg_proc')};
 IF before_functions IS DISTINCT FROM after_functions THEN RAISE EXCEPTION 'GENERATION_PATCH_UNEXPECTED_FUNCTION_CHANGE'; END IF;
 ${inspect};
 IF observation->>'installedReady' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'GENERATION_PATCH_POSTCHECK_FAILED'; END IF;
END $generation_patch_package$;
ROLLBACK;
`;
  return Object.freeze({contract:'potok-generation-patch-package-v1',targetProjectId,sourceCommit,sourceCount:2,
    mayApply:false,mayActivate:false,rollbackSql,rollbackSha256:createHash('sha256').update(rollbackSql).digest('hex')});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length>3||(process.argv[2]!==undefined&&process.argv[2]!=='--rollback-sql'))throw Error('GENERATION_PATCH_UNSUPPORTED_OPERATION');
  const result=buildGenerationPatchPackageV1();
  console.log(process.argv[2]==='--rollback-sql'?result.rollbackSql:JSON.stringify({...result,rollbackSql:undefined}));
}
