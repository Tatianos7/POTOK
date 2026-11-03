import process from 'node:process';
import {readPrivateGenerationJsonV1} from './generationPrivateConfigurationV1';
import {createStagingGenerationRuntimeV1, type StagingGenerationRuntimeDependenciesV1} from './generationRuntimeV1';

export const generationNodeWorkerConfigContractV1 = 'potok-staging-node-worker-config-v1' as const;
export const generationNodeWorkerResultContractV1 = 'potok-node-worker-attempt-result-v1' as const;
type Runtime = Awaited<ReturnType<typeof createStagingGenerationRuntimeV1>>;
type RuntimeFactory = (config: StagingGenerationRuntimeDependenciesV1) => Promise<Runtime>;
export interface GenerationNodeWorkerAttemptResultV1 {
  readonly contract: typeof generationNodeWorkerResultContractV1;
  readonly outcome: 'DISABLED' | 'RESPONSE' | 'STOPPED' | 'FAILED';
  readonly status: string | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const statuses = new Set(['REQUESTED','GENERATING','GENERATED','ACTIVATING','ACTIVE','REJECTED','CONFLICT','UNKNOWN_RETRYABLE']);
const result = (outcome: GenerationNodeWorkerAttemptResultV1['outcome'], status: string | null = null): GenerationNodeWorkerAttemptResultV1 =>
  Object.freeze({contract: generationNodeWorkerResultContractV1, outcome, status});
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(value, k))) throw Error('INVALID_CONFIG');
  return value as Record<string, unknown>;
}
async function readConfiguration(path: string): Promise<Omit<StagingGenerationRuntimeDependenciesV1, 'enabled'>> {
  const config = record(await readPrivateGenerationJsonV1(path), ['contract','secrets','optimizationPolicyRaw','metricPolicyRaw','comparison','limitsRaw']);
  if (config.contract !== generationNodeWorkerConfigContractV1 || config.comparison !== 'ROBUST_CONVENIENCE_BOUNDS'
    || typeof config.optimizationPolicyRaw !== 'string' || typeof config.metricPolicyRaw !== 'string'
    || (config.limitsRaw !== null && typeof config.limitsRaw !== 'string')) throw Error('INVALID_CONFIG');
  const secrets = record(config.secrets, ['ca','readerPassword','gatewayPassword']);
  if (![secrets.ca,secrets.readerPassword,secrets.gatewayPassword].every(v => typeof v === 'string')) throw Error('INVALID_CONFIG');
  return {secrets: {ca: secrets.ca as string, readerPassword: secrets.readerPassword as string, gatewayPassword: secrets.gatewayPassword as string},
    optimizationPolicyRaw: config.optimizationPolicyRaw, metricPolicyRaw: config.metricPolicyRaw,
    comparison: 'ROBUST_CONVENIENCE_BOUNDS', convenience: null, ...(config.limitsRaw === null ? {} : {limitsRaw: config.limitsRaw})};
}

/** Trusted operator process boundary. No HTTP, scanning/polling queue, retry or
 * dynamic host/role selector. Never invoke against Staging without scoped approval.
 * The optional factory is a trusted composition seam, never request input.
 */
export async function runGenerationNodeWorkerOnceV1(options: {
  readonly enabled?: boolean; readonly configPath: string; readonly requestOperationId: string; readonly signal: AbortSignal;
}, factory: RuntimeFactory = createStagingGenerationRuntimeV1): Promise<GenerationNodeWorkerAttemptResultV1> {
  if (options.enabled !== true) return result('DISABLED');
  const allowed = () => !options.signal.aborted;
  let runtime: Runtime | undefined, closing: Promise<void> | undefined;
  const close = () => {closing ??= Promise.resolve().then(() => runtime?.close());void closing.catch(() => {});return closing;};
  const stop = () => {void close();};
  let outcome = result('FAILED');
  try {
    if ('Deno' in globalThis || process.release.name !== 'node' || process.versions.node.split('.')[0] !== '24'
      || !['linux','darwin'].includes(process.platform) || typeof process.getuid !== 'function'
      || typeof options.requestOperationId !== 'string' || !uuid.test(options.requestOperationId)) throw Error('UNSUPPORTED_HOST_OR_REQUEST');
    if (!allowed()) return result('STOPPED');
    const config = await readConfiguration(options.configPath);
    if (!allowed()) return result('STOPPED');
    runtime = await factory({...config, enabled: allowed});
    options.signal.addEventListener('abort', stop, {once: true});
    if (!allowed()) stop();
    else {
      const response = await runtime.continue(options.requestOperationId);
      if (typeof response.status !== 'string' || !statuses.has(response.status)) throw Error('INVALID_RESPONSE');
      outcome = result('RESPONSE', response.status);
    }
    if (!allowed()) outcome = result('STOPPED');
  } catch {outcome = result(allowed() ? 'FAILED' : 'STOPPED');}
  finally {
    options.signal.removeEventListener('abort', stop);
    if (runtime) {try {await close();} catch {outcome = result('FAILED');}}
  }
  if (!allowed() && outcome.outcome !== 'FAILED') outcome = result('STOPPED');
  return outcome;
}
