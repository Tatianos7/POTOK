import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {X509Certificate} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {Client, type Pool} from 'pg';
import test from 'node:test';
import {adaptGenerationNodePgPoolV1, createStagingGenerationNodePgPoolsV1, generationStagingPgConfigV1} from '../generationNodePgPoolV1';
import {createGenerationTransactionClientV1} from '../generationTransactionClientV1';

const bounds = {acquireMs: 25, queryMs: 25, closeMs: 25};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
}
class Session extends EventEmitter {
  releases: boolean[] = [];
  queries: {text: string; values: string[]; queryMode: string}[] = [];
  work = async () => ({rows: [{value: 'ok'}]});
  async query(query: {text: string; values: string[]; queryMode: string}) {
    this.queries.push(query); return this.work();
  }
  release(discard: boolean) {
    this.releases.push(discard);
    if (discard) queueMicrotask(() => this.emit('end'));
  }
}
function fixture() {
  const client = new Session();
  const pool = Object.assign(new EventEmitter(), {
    connects: 0, ends: 0,
    async connect() {this.connects++; return client;},
    async end() {this.ends++;},
  });
  return {client, pool, adapter: (enabled = () => true) => adaptGenerationNodePgPoolV1<{value: string}>(pool as unknown as Pool, enabled, bounds)};
}

test('disabled adapter never checks out a pg client', async () => {
  const f = fixture(); await assert.rejects(f.adapter(() => false).acquire(), /GENERATION_PG_DISABLED/);
  assert.equal(f.pool.connects, 0);
});
test('real transaction wrapper binds values, preserves a session and releases it once', async () => {
  const f = fixture(), adapter = f.adapter();
  const values = ["x'); DROP TABLE forbidden; --\\\n💧"];
  await createGenerationTransactionClientV1(adapter, () => true).query('SELECT $1::text', values);
  assert.deepEqual(f.client.queries.map(q => q.text), ['BEGIN', 'SELECT $1::text', 'COMMIT']);
  assert.deepEqual(f.client.queries[1].values, values);
  assert.equal(f.client.queries[1].queryMode, 'extended');
  assert.deepEqual(f.client.releases, [false]); await adapter.close();
});
test('parameter array is copied before driver awaits', async () => {
  const f = fixture(), a = f.adapter(), lease = await a.acquire();
  const done = deferred<{rows: {value: string}[]}>(); f.client.work = () => done.promise;
  const values = ['before'], query = lease.query('SELECT $1', values); values[0] = 'after';
  done.resolve({rows: [{value: 'ok'}]}); await query;
  assert.deepEqual(f.client.queries[0].values, ['before']); await lease.release(false); await a.close();
});
test('query timeout destroys a session and late data cannot make it reusable', async () => {
  const f = fixture(), a = f.adapter(), lease = await a.acquire();
  const done = deferred<{rows: {value: string}[]}>(); f.client.work = () => done.promise;
  await assert.rejects(lease.query('SELECT fixed', []), /^Error: GENERATION_PG_QUERY_FAILED$/);
  done.resolve({rows: [{value: 'late'}]});
  await lease.release(false); await assert.rejects(lease.query('COMMIT', []));
  assert.deepEqual(f.client.releases, [true]); await a.close();
});
test('late acquisition is destroyed after timeout without exposing a lease', async () => {
  const f = fixture(), a = f.adapter(), done = deferred<Session>(); f.pool.connect = () => done.promise;
  await assert.rejects(a.acquire(), /GENERATION_PG_ACQUIRE_FAILED/);
  done.resolve(f.client); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.client.releases, [true]); await a.close();
});
test('closing the gate during acquire destroys the acquired session', async () => {
  const f = fixture(); let enabled = true; const a = f.adapter(() => enabled);
  f.pool.connect = async () => {enabled = false; return f.client;};
  await assert.rejects(a.acquire(), /GENERATION_PG_ACQUIRE_FAILED/);
  assert.deepEqual(f.client.releases, [true]); await a.close();
});
test('query/connection errors are sanitized and checked-out client errors are handled', async () => {
  const f = fixture(), a = f.adapter(), lease = await a.acquire();
  f.client.emit('error', Error('private credentials and SQL'));
  await assert.rejects(lease.query('SELECT fixed', []), /^Error: GENERATION_PG_UNAVAILABLE$/);
  await lease.release(false); assert.deepEqual(f.client.releases, [true]);
  assert.doesNotThrow(() => f.pool.emit('error', Error('private idle details'))); await a.close();
});
test('shutdown destroys an active lease, blocks acquisitions and is idempotent', async () => {
  const f = fixture(), a = f.adapter(), lease = await a.acquire();
  await Promise.all([a.close(), a.close()]);
  await assert.rejects(a.acquire(), /GENERATION_PG_DISABLED/);
  await assert.rejects(lease.query('SELECT fixed', []));
  await lease.release(false); assert.deepEqual(f.client.releases, [true]); assert.equal(f.pool.ends, 1);
});
test('unacknowledged close fails within its bound; client is never returned to idle', async () => {
  const f = fixture(), a = f.adapter(), lease = await a.acquire();
  f.client.release = discard => {f.client.releases.push(discard);};
  await assert.rejects(lease.release(true), /^Error: GENERATION_PG_CLOSE_FAILED$/);
  await assert.rejects(lease.release(false), /GENERATION_PG_CLOSE_FAILED/);
  assert.deepEqual(f.client.releases, [true]); await a.close();
});
test('waiting acquisition count is bounded', async () => {
  const f = fixture(), a = f.adapter(); f.pool.connect = () => new Promise(() => {});
  const one = a.acquire(), two = a.acquire();
  await assert.rejects(a.acquire(), /GENERATION_PG_BUSY/);
  await Promise.all([assert.rejects(one), assert.rejects(two)]); await a.close();
});
test('lost COMMIT reply stays unknown in the transaction wrapper and is never retried', async () => {
  const f = fixture(), a = f.adapter();
  f.client.work = async () => {
    if (f.client.queries[f.client.queries.length - 1]?.text === 'COMMIT') throw Error('private lost reply');
    return {rows: [{value: 'ok'}]};
  };
  await assert.rejects(createGenerationTransactionClientV1(a, () => true).query('SELECT fixed', []), /GENERATION_SQL_COMMIT_UNKNOWN/);
  assert.deepEqual(f.client.queries.map(q => q.text), ['BEGIN', 'SELECT fixed', 'COMMIT']);
  assert.deepEqual(f.client.releases, [true]); assert.equal(f.pool.connects, 1); await a.close();
});

const ca = rootCertificates.find(pem => {
  const root = new X509Certificate(pem);
  return root.ca && root.checkIssued(root) && root.verify(root.publicKey) &&
    Date.now() >= Date.parse(root.validFrom) && Date.now() < Date.parse(root.validTo);
});
assert.ok(ca);
const secrets = {ca, readerPassword: 'fixture-reader', gatewayPassword: 'fixture-gateway'};
test('fixed Staging config pins host, roles, verified TLS, timeouts and pool size', () => {
  for (const channel of ['reader', 'gateway'] as const) {
    const c = generationStagingPgConfigV1(channel, secrets);
    assert.equal(c.host, 'db.ozidryfvhkcbtpnulakq.supabase.co');
    assert.equal(c.user, `potok_generation_${channel}_v1`);
    assert.equal(c.database, 'postgres'); assert.equal(c.port, 5432); assert.equal(c.max, 2);
    assert.equal(c.connectionString, undefined); assert.equal(c.connectionTimeoutMillis, 5000);
    assert.equal(c.statement_timeout, 30000); assert.equal(c.lock_timeout, 5000);
    assert.equal(c.idle_in_transaction_session_timeout, 10000);
    assert.equal(typeof c.ssl, 'object');
    assert.equal((c.ssl as {rejectUnauthorized: boolean}).rejectUnauthorized, true);
    assert.equal((c.ssl as {servername: string}).servername, c.host);
  }
});
test('explicit driver selectors resist inherited PG environment without connecting', () => {
  const names = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD', 'PGSSLMODE', 'PGOPTIONS', 'PGREPLICATION', 'PGSSLNEGOTIATION'];
  const saved = names.map(name => process.env[name]);
  try {
    for (const name of names) process.env[name] = 'untrusted-inherited';
    const config = generationStagingPgConfigV1('reader', secrets);
    const client = new Client(config);
    // Inspect pg's actual parsed selectors offline, never print the object.
    const parsed = (client as unknown as {connectionParameters: Record<string, unknown>}).connectionParameters;
    for (const name of ['host', 'port', 'user', 'database', 'password', 'ssl', 'options', 'replication', 'sslnegotiation'])
      assert.deepEqual(parsed[name], config[name as keyof typeof config]);
  } finally {names.forEach((name, i) => {if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i];});}
});
test('configuration rejects invalid CA, identical or absent secrets; factory stays disabled', async () => {
  for (const change of [{ca: 'invalid'}, {ca: ca + ca}, {readerPassword: ''}, {gatewayPassword: secrets.readerPassword}])
    assert.throws(() => createStagingGenerationNodePgPoolsV1({...secrets, ...change}), /^Error: GENERATION_PG_CONFIGURATION_INVALID$/);
  const pools = createStagingGenerationNodePgPoolsV1(secrets);
  assert.notEqual(pools.sourcesPool, pools.gatewayPool);
  await assert.rejects(pools.sourcesPool.acquire(), /GENERATION_PG_DISABLED/);
  await assert.rejects(pools.gatewayPool.acquire(), /GENERATION_PG_DISABLED/); await pools.close();
});
