import process from 'node:process';
import {Pool, type PoolConfig} from 'pg';
import {readPrivateGenerationJsonV1} from './generationPrivateConfigurationV1';
import {generationStagingPgConfigV1, adaptGenerationNodePgPoolV1, type GenerationNodePgPoolV1} from './generationNodePgPoolV1';
import {generationNodeConnectionProbeSqlV1} from './generationNodeConnectionProbeSqlV1';

export const generationNodeConnectionConfigContractV1 = 'potok-staging-node-connection-config-v1' as const;
const labels = ['session_identity','role_attributes','memberships','function_allowlist','table_access','ownership','schema_access','tls','timeouts','read_only_probe'];
type Row = {jsonb_build_object: unknown};
type Factory = (config: PoolConfig, enabled: () => boolean) => GenerationNodePgPoolV1<Row>;
const defaultFactory: Factory = (config, enabled) => adaptGenerationNodePgPoolV1<Row>(new Pool(config), enabled);
function object(v: unknown, keys: string[]): Record<string,unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype
    || Object.keys(v).length !== keys.length || !keys.every(k=>Object.prototype.hasOwnProperty.call(v,k))) throw Error('INVALID_CONFIG');
  return v as Record<string,unknown>;
}
/** Connection-only: fixed read-only metadata SQL, no generator import/dispatch,
 * request UUID, business-row read, function invocation or source-lock acquisition.
 */
export async function checkGenerationNodeConnectionsV1(options: {enabled?: boolean; configPath: string; signal: AbortSignal}, factory: Factory = defaultFactory) {
  const checks: {role: string; passed: boolean; failedChecks: string[]}[] = [];
  let outcome: 'DISABLED'|'PASS'|'FAILED'|'STOPPED' = 'DISABLED';
  const report = () => ({contract: 'potok-node-connection-check-result-v1', outcome, mayActivate: false, checks});
  if (options.enabled !== true) return report();
  const enabled = () => !options.signal.aborted;
  let pool: GenerationNodePgPoolV1<Row> | undefined;
  const stop = () => {void pool?.close().catch(()=>{});};
  try {
    if ('Deno' in globalThis || process.release.name !== 'node' || process.versions.node.split('.')[0] !== '24'
      || !['linux','darwin'].includes(process.platform) || typeof process.getuid !== 'function') throw Error('UNSUPPORTED_HOST');
    if (!enabled()) {outcome='STOPPED';return report();}
    const config = object(await readPrivateGenerationJsonV1(options.configPath),['contract','secrets']);
    if (config.contract !== generationNodeConnectionConfigContractV1) throw Error('INVALID_CONFIG');
    const s=object(config.secrets,['ca','readerPassword','gatewayPassword']);
    if (![s.ca,s.readerPassword,s.gatewayPassword].every(v=>typeof v==='string')) throw Error('INVALID_CONFIG');
    const secrets={ca:s.ca as string,readerPassword:s.readerPassword as string,gatewayPassword:s.gatewayPassword as string};
    // Admit both configurations before opening either socket. Reuse the worker's
    // exact fixed host/role/TLS/driver selectors; only reduce max and force read-only.
    const configs=(['reader','gateway'] as const).map(channel=>({...generationStagingPgConfigV1(channel,secrets),
      options:'-c search_path=pg_catalog -c default_transaction_read_only=on',max:1}));
    options.signal.addEventListener('abort',stop,{once:true});
    for (const settings of configs) {
      if (!enabled()) throw Error('STOPPED');
      pool=factory(settings,enabled);
      try {
        const lease=await pool.acquire();
        try {
          await lease.query('BEGIN READ ONLY',[]);
          const result=await lease.query(generationNodeConnectionProbeSqlV1,[]);
          if (!enabled() || result.rows.length!==1) throw Error('INVALID_OBSERVATION');
          const r=object(result.rows[0].jsonb_build_object,['contract','role','checks','connectionChecksPassed','mayActivate']);
          const flags=object(r.checks,labels);
          if(r.contract!=='potok-generation-connection-observation-v1'||r.role!==settings.user||r.mayActivate!==false
            || !labels.every(k=>typeof flags[k]==='boolean'))throw Error('INVALID_OBSERVATION');
          const failedChecks=labels.filter(k=>flags[k]!==true);
          if(r.connectionChecksPassed!==(failedChecks.length===0))throw Error('INVALID_OBSERVATION');
          checks.push({role:settings.user!,passed:failedChecks.length===0,failedChecks});
          await lease.query('ROLLBACK',[]);
        } finally {await lease.release(true);}
      } finally {const owned=pool;pool=undefined;await owned.close();}
      if(checks.some(c=>!c.passed))break;
    }
    outcome=checks.length===2&&checks.every(c=>c.passed)?'PASS':'FAILED';
  } catch {outcome=enabled()?'FAILED':'STOPPED';}
  finally {
    options.signal.removeEventListener('abort',stop);
    if(pool){try{await pool.close();}catch{outcome='FAILED';}}
  }
  if(!enabled()&&outcome!=='FAILED')outcome='STOPPED';
  return report();
}
