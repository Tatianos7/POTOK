import {GenerationEdgeErrorV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createStagingGenerationNodePgPoolsV1, preparePortableStagingGenerationNodePgPoolsV1, prepareAaaaStagingGenerationNodePgPoolsV1, type GenerationNodePgSecretsV1} from './generationNodePgPoolV1';
import {resolveGenerationStagingIpv6V1} from './generationStagingDnsV1';
import {createPooledRestrictedGenerationWorkerV1, type PooledRestrictedGenerationWorkerDependenciesV1} from './generationSqlTransportWorkerV1';

type Policies = Omit<PooledRestrictedGenerationWorkerDependenciesV1, 'sourcesPool' | 'gatewayPool' | 'enabled'>;
export interface GenerationRuntimePoolsV1 {
  readonly sourcesPool: PooledRestrictedGenerationWorkerDependenciesV1['sourcesPool'];
  readonly gatewayPool: PooledRestrictedGenerationWorkerDependenciesV1['gatewayPool'];
  close(): Promise<void>;
}
export interface ManagedGenerationRuntimeDependenciesV1 extends Policies {
  /** Trusted backend factory only; not request input or a source of admission. */
  readonly openPools: (enabled: () => boolean) => GenerationRuntimePoolsV1;
  readonly enabled?: () => boolean;
}

/** One worker attempt at a time, no queue/retry, and shutdown shared with both pools.
 * Construction is not activation, connection admission or source publication.
 */
export async function createManagedGenerationRuntimeV1(dependencies: ManagedGenerationRuntimeDependenciesV1) {
  const {openPools, enabled = () => false, ...policies} = dependencies;
  let closed = false, busy = false;
  let closing: Promise<void> | undefined;
  const allowed = () => !closed && enabled() === true;
  let pools: GenerationRuntimePoolsV1 | undefined;
  let worker: ReturnType<typeof createPooledRestrictedGenerationWorkerV1>;
  try {
    pools = openPools(allowed);
    worker = createPooledRestrictedGenerationWorkerV1({...policies, sourcesPool: pools.sourcesPool, gatewayPool: pools.gatewayPool, enabled: allowed});
  } catch {
    closed = true;
    try {await pools?.close();}
    catch {throw Error('GENERATION_RUNTIME_CONFIGURATION_CLEANUP_FAILED');}
    throw Error('GENERATION_RUNTIME_CONFIGURATION_INVALID');
  }
  const ownedPools = pools;
  return Object.freeze({
    async continue(requestOperationId: string) {
      if (!allowed()) throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED', 503);
      if (busy) throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_BUSY', 503);
      busy = true;
      try {
        const result = await worker.continue(requestOperationId);
        if (!allowed()) throw new GenerationEdgeErrorV2('GENERATION_RUNTIME_DISABLED', 503);
        return result;
      } finally {busy = false;}
    },
    close(): Promise<void> {
      if (closing) return closing;
      // Close the shared gate before any await: even failed shutdown cannot reopen it.
      closed = true;
      closing = (async () => {
        try {await ownedPools.close();}
        catch {throw Error('GENERATION_RUNTIME_CLOSE_FAILED');}
      })();
      return closing;
    },
  });
}

export interface StagingGenerationRuntimeDependenciesV1 extends Policies {
  readonly secrets: GenerationNodePgSecretsV1;
  readonly enabled?: () => boolean;
}
/** Fixed Staging pg/TLS factory + restricted transaction/worker assembly.
 * Secrets and policies must come from independently admitted backend configuration.
 * No environment scan, endpoint, timer or deployment is installed here.
 */
export function createStagingGenerationRuntimeV1(dependencies: StagingGenerationRuntimeDependenciesV1) {
  const {secrets, ...policies} = dependencies;
  const owned = {ca: secrets?.ca, readerPassword: secrets?.readerPassword, gatewayPassword: secrets?.gatewayPassword};
  return createManagedGenerationRuntimeV1({...policies, openPools: gate => createStagingGenerationNodePgPoolsV1(owned, gate)});
}

/** Separately selected Node transport; never a fallback from system DNS/Edge. */
export async function createAaaaStagingGenerationRuntimeV1(dependencies:StagingGenerationRuntimeDependenciesV1,signal:AbortSignal,
  resolveAddress:(signal:AbortSignal)=>Promise<string>=resolveGenerationStagingIpv6V1){
  const {secrets,enabled=()=>false,...policies}=dependencies;
  let openPools:Awaited<ReturnType<typeof prepareAaaaStagingGenerationNodePgPoolsV1>>;
  try{openPools=await prepareAaaaStagingGenerationNodePgPoolsV1(secrets,signal,resolveAddress);}
  catch{throw Error('GENERATION_RUNTIME_CONFIGURATION_INVALID');}
  return createManagedGenerationRuntimeV1({...policies,enabled:()=>!signal.aborted&&enabled()===true,openPools});
}

/** Explicit async WebCrypto/X509 path; never selected as an error fallback. */
export async function createPortableStagingGenerationRuntimeV1(dependencies: StagingGenerationRuntimeDependenciesV1) {
  const {secrets, ...policies} = dependencies;
  let openPools: Awaited<ReturnType<typeof preparePortableStagingGenerationNodePgPoolsV1>>;
  try {openPools = await preparePortableStagingGenerationNodePgPoolsV1(secrets);}
  catch {throw Error('GENERATION_RUNTIME_CONFIGURATION_INVALID');}
  return createManagedGenerationRuntimeV1({...policies, openPools});
}
