import {X509Certificate} from 'node:crypto';
import {Pool, type PoolClient, type PoolConfig} from 'pg';
import type {GenerationTransactionConnectionV1, GenerationTransactionPoolV1} from './generationTransactionClientV1';
import {assertGenerationRootCaV1} from './generationRootCaV1';

export const generationStagingPgHostV1 = 'db.ozidryfvhkcbtpnulakq.supabase.co';
const host = generationStagingPgHostV1;
const roles = ['potok_generation_reader_v1', 'potok_generation_gateway_v1'] as const;
const defaults = Object.freeze({acquireMs: 5000, queryMs: 35000, closeMs: 2000});
type Bounds = {readonly acquireMs: number; readonly queryMs: number; readonly closeMs: number};
// These startup selectors are supported by pinned pg 8.23.1 but are not yet
// declared by @types/pg. Explicit values exclude inherited PG environment.
type StagingPgConfig = PoolConfig & {replication: 'false'; sslnegotiation: 'postgres'; binary: false};

function bounded<T>(work: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(code)), ms);
    work.then(value => {clearTimeout(timer); resolve(value);}, () => {
      clearTimeout(timer); reject(Error(code));
    });
  });
}

export interface GenerationNodePgPoolV1<Row> extends GenerationTransactionPoolV1<Row> {
  close(): Promise<void>;
}

/** Trusted backend adapter, not a connection-admission authority. The supplied
 * pg pool is exclusive to this adapter. Fixture pools may use loopback without
 * TLS; hosted callers must use the fixed Staging factory below. No SQL retry.
 */
export function adaptGenerationNodePgPoolV1<Row>(
  pool: Pool, enabled: () => boolean = () => false, bounds: Bounds = defaults,
): GenerationNodePgPoolV1<Row> {
  const limits = {...bounds};
  if (!Object.keys(defaults).every(key => {
    const k = key as keyof Bounds;
    return Number.isSafeInteger(limits[k]) && limits[k] > 0 && limits[k] <= defaults[k];
  })) throw Error('GENERATION_PG_INVALID_BOUNDS');
  let closed = false, acquiring = 0;
  let closing: Promise<void> | undefined;
  const active = new Set<(discard: boolean) => Promise<void>>();
  // pg emits pool errors for idle clients. Never log the raw Error/client.
  pool.on('error', () => {});
  const allowed = () => !closed && enabled() === true;

  function lease(client: PoolClient): GenerationTransactionConnectionV1<Row> {
    let released = false, busy = false, failed = false, ended = false;
    let releaseResult: Promise<void> | undefined;
    let end!: () => void;
    const endSignal = new Promise<void>(resolve => {end = resolve;});
    const onEnd = () => {ended = true; end();};
    const onError = () => {failed = true;};
    client.once('end', onEnd);
    client.on('error', onError);
    const release = (discard: boolean): Promise<void> => {
      if (releaseResult) return releaseResult;
      released = true;
      active.delete(release);
      const destroy = discard || failed || closed || busy;
      releaseResult = (async () => {
        try {
          // release(true) removes the client from pg-pool before closing it.
          // Wait for the actual end event, with a bounded acknowledgement.
          client.release(destroy);
          if (destroy && !ended) await bounded(endSignal, limits.closeMs, 'GENERATION_PG_CLOSE_FAILED');
        } catch {throw Error('GENERATION_PG_CLOSE_FAILED');}
        finally {
          client.removeListener('end', onEnd);
          client.removeListener('error', onError);
        }
      })();
      return releaseResult;
    };
    active.add(release);
    return Object.freeze({
      async query(statement: string, parameters: readonly string[]) {
        if (released || failed || busy || !allowed()) throw Error('GENERATION_PG_UNAVAILABLE');
        const values = [...parameters];
        busy = true;
        try {
          // Extended protocol binds values; never interpolate request data.
          const query = {text: statement, values, queryMode: 'extended', binary: false};
          const result = await bounded(
            client.query(query),
            limits.queryMs, 'GENERATION_PG_QUERY_FAILED',
          );
          if (released || failed || !allowed()) throw Error('GENERATION_PG_QUERY_FAILED');
          return {rows: result.rows as Row[]};
        } catch {
          failed = true;
          // In-flight/uncertain work must never re-enter the idle pool. Closing
          // aborts uncommitted work; a dispatched COMMIT may still have succeeded.
          await release(true).catch(() => {});
          throw Error('GENERATION_PG_QUERY_FAILED');
        } finally {busy = false;}
      },
      release,
    });
  }

  return Object.freeze({
    async acquire() {
      if (!allowed()) throw Error('GENERATION_PG_DISABLED');
      if (acquiring >= 2) throw Error('GENERATION_PG_BUSY');
      acquiring++;
      let accepted = true;
      try {
        const pending = pool.connect();
        // A driver that resolves after our timeout/close must not leak a lease.
        pending.then(client => {
          if (!accepted) void lease(client).release(true).catch(() => {});
        }, () => {});
        const client = await bounded(pending, limits.acquireMs, 'GENERATION_PG_ACQUIRE_FAILED');
        const connection = lease(client);
        if (!allowed()) {
          await connection.release(true).catch(() => {});
          throw Error('GENERATION_PG_DISABLED');
        }
        return connection;
      } catch {accepted = false; throw Error('GENERATION_PG_ACQUIRE_FAILED');}
      finally {acquiring--;}
    },
    close() {
      if (closing) return closing;
      closed = true;
      closing = (async () => {
        const results = await Promise.allSettled([...active].map(release => release(true)));
        await bounded(pool.end(), limits.closeMs, 'GENERATION_PG_CLOSE_FAILED');
        if (results.some(result => result.status === 'rejected')) throw Error('GENERATION_PG_CLOSE_FAILED');
      })();
      return closing;
    },
  });
}

export interface GenerationNodePgSecretsV1 {
  readonly ca: string;
  readonly readerPassword: string;
  readonly gatewayPassword: string;
}

/** Fixed Staging only. Secrets come from trusted server configuration, never
 * browser/request arguments. Construction opens no socket, default gate is off.
 * Local CA validation is not proof of the root's provenance or live admission.
 */
export function generationStagingPgConfigV1(channel: 'reader' | 'gateway', secrets: GenerationNodePgSecretsV1): StagingPgConfig {
  const {ca, readerPassword, gatewayPassword} = secrets ?? ({} as GenerationNodePgSecretsV1);
  try {
    if (typeof ca !== 'string' || Buffer.byteLength(ca) > 65536 ||
      !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(ca)) throw Error();
    const root = new X509Certificate(ca);
    if (!root.ca || !root.checkIssued(root) || !root.verify(root.publicKey) ||
      Date.now() < Date.parse(root.validFrom) || Date.now() >= Date.parse(root.validTo)) throw Error();
    if (!['reader', 'gateway'].includes(channel) ||
      ![readerPassword, gatewayPassword].every(p => typeof p === 'string' && p.length > 0 && !p.includes('\0')) ||
      readerPassword === gatewayPassword) throw Error();
  } catch {throw Error('GENERATION_PG_CONFIGURATION_INVALID');}
  return stagingConfig(channel, secrets);
}

// Both explicit validation paths use these exact connection/TLS settings.
function stagingConfig(channel: 'reader' | 'gateway', secrets: GenerationNodePgSecretsV1): StagingPgConfig {
  const {ca, readerPassword, gatewayPassword} = secrets;
  const user = channel === 'reader' ? roles[0] : roles[1];
  const password = channel === 'reader' ? readerPassword : gatewayPassword;
  return {
    host, port: 5432, database: 'postgres', user, password,
    ssl: {ca, rejectUnauthorized: true, servername: host, minVersion: 'TLSv1.2'},
    sslnegotiation: 'postgres', enableChannelBinding: true,
    application_name: 'potok-generation-restricted-v1', client_encoding: 'UTF8',
    // A nonempty explicit options value also excludes inherited PGOPTIONS.
    options: '-c search_path=pg_catalog -c default_transaction_read_only=off',
    replication: 'false', binary: false,
    statement_timeout: 30000, lock_timeout: 5000, idle_in_transaction_session_timeout: 10000,
    connectionTimeoutMillis: defaults.acquireMs, query_timeout: defaults.queryMs,
    max: 2, idleTimeoutMillis: 10000, maxLifetimeSeconds: 300, keepAlive: true,
  };
}

export function createStagingGenerationNodePgPoolsV1(
  secrets: GenerationNodePgSecretsV1, enabled: () => boolean = () => false,
) {
  return poolPair(generationStagingPgConfigV1('reader', secrets), generationStagingPgConfigV1('gateway', secrets), enabled);
}

/** Explicit portable path: validate before returning a lazy, gate-aware pool factory.
 * It never calls/skips the legacy Node X509 checks based on runtime detection.
 */
export async function preparePortableStagingGenerationNodePgPoolsV1(secrets: GenerationNodePgSecretsV1) {
  const owned = {ca: secrets?.ca, readerPassword: secrets?.readerPassword, gatewayPassword: secrets?.gatewayPassword};
  let validity: Awaited<ReturnType<typeof assertGenerationRootCaV1>>;
  try {
    if (![owned.readerPassword, owned.gatewayPassword].every(p => typeof p === 'string' && p.length > 0 && !p.includes('\0'))
      || owned.readerPassword === owned.gatewayPassword) throw Error();
    validity = await assertGenerationRootCaV1(owned.ca);
  } catch {throw Error('GENERATION_PG_CONFIGURATION_INVALID');}
  const reader = stagingConfig('reader', owned), gateway = stagingConfig('gateway', owned);
  return (enabled: () => boolean = () => false) => {
    if (Date.now() < validity.notBefore || Date.now() >= validity.notAfter) throw Error('GENERATION_PG_CONFIGURATION_INVALID');
    return poolPair(reader, gateway, enabled);
  };
}

function poolPair(reader: StagingPgConfig, gateway: StagingPgConfig, enabled: () => boolean) {
  const sourcesPool = adaptGenerationNodePgPoolV1<{source_raw: string | null}>(new Pool(reader), enabled);
  const gatewayPool = adaptGenerationNodePgPoolV1<{result_raw: unknown}>(new Pool(gateway), enabled);
  return Object.freeze({sourcesPool, gatewayPool, async close() {
    const results = await Promise.allSettled([sourcesPool.close(), gatewayPool.close()]);
    if (results.some(result => result.status === 'rejected')) throw Error('GENERATION_PG_CLOSE_FAILED');
  }});
}
