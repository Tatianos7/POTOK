import assert from 'node:assert/strict';
import test from 'node:test';
import {Pool} from 'pg';
import {adaptGenerationNodePgPoolV1} from '../../src/server/generationNodePgPoolV1';
import {createGenerationTransactionClientV1} from '../../src/server/generationTransactionClientV1';

const native = process.env.POTOK_GENERATION_STORE_NATIVE === '1';
const database = 'potok_generation_store_disposable';
const insert = 'INSERT INTO nodepg_fixture.events(value) VALUES ($1::text) RETURNING value, pg_backend_pid() AS pid';
type Row = {value: string; pid: number};
// Deliberately loopback/non-TLS. This tests the real pinned pg driver, not managed
// credentials, source/gateway admission, production TLS or a real recipe/menu.
test('actual node-postgres exclusive leases on disposable PostgreSQL', {skip: !native}, async t => {
  const owner = new Pool({host: '127.0.0.1', port: 5432, database, user: 'postgres',
    password: 'disposable-generation-only', ssl: false, connectionTimeoutMillis: 2000});
  const pools: ReturnType<typeof adaptGenerationNodePgPoolV1<Row>>[] = [];
  const rawPools: Pool[] = [];
  const create = (max = 2, acquireMs = 1000, queryMs = 2000) => {
    const raw = new Pool({host: '127.0.0.1', port: 5432, database, user: 'nodepg_fixture_login',
      password: 'nodepg-disposable-only', ssl: false, max, connectionTimeoutMillis: acquireMs,
      statement_timeout: 1000, application_name: 'potok-nodepg-fixture',
      options: '-c search_path=pg_catalog -c default_transaction_read_only=off', replication: 'false'});
    const adapter = adaptGenerationNodePgPoolV1<Row>(raw, () => true, {acquireMs, queryMs, closeMs: 1000});
    pools.push(adapter); rawPools.push(raw); return {raw, adapter};
  };
  try {
    assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name, database);
    await owner.query("CREATE SCHEMA nodepg_fixture; CREATE TABLE nodepg_fixture.events(value text PRIMARY KEY);" +
      "CREATE ROLE nodepg_fixture_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'nodepg-disposable-only';" +
      'GRANT USAGE ON SCHEMA nodepg_fixture TO nodepg_fixture_login;' +
      'GRANT SELECT, INSERT ON nodepg_fixture.events TO nodepg_fixture_login;');
    await t.test('extended protocol binds quotes, backslashes, newlines and Unicode verbatim', async () => {
      const {adapter} = create();
      const value = "x'); DROP TABLE nodepg_fixture.events; --\\\n💧";
      const r = await createGenerationTransactionClientV1(adapter, () => true).query(insert, [value]);
      assert.equal(r.rows[0].value, value);
      assert.equal((await owner.query('SELECT value FROM nodepg_fixture.events WHERE value=$1', [value])).rows[0].value, value);
      await adapter.close();
    });
    await t.test('parallel transactions have distinct actual backend sessions', async () => {
      const {adapter} = create(), c = createGenerationTransactionClientV1(adapter, () => true);
      const [a, b] = await Promise.all([c.query(insert, ['parallel-a']), c.query(insert, ['parallel-b'])]);
      assert.notEqual(a.rows[0].pid, b.rows[0].pid); await adapter.close();
    });
    await t.test('pool saturation times out, then releasing the lease permits a new acquisition', async () => {
      const {adapter, raw} = create(1, 100);
      const lease = await adapter.acquire();
      await assert.rejects(adapter.acquire(), /GENERATION_PG_ACQUIRE_FAILED/);
      await lease.release(false);
      const second = await adapter.acquire(); await second.release(false);
      assert.equal(raw.totalCount, 1); await adapter.close();
    });
    await t.test('client query deadline destroys the actual client and cannot reuse its lease', async () => {
      const {adapter, raw} = create(1, 1000, 50), lease = await adapter.acquire();
      await assert.rejects(lease.query('SELECT pg_sleep(5)', []), /GENERATION_PG_QUERY_FAILED/);
      await lease.release(false); assert.equal(raw.totalCount, 0);
      await assert.rejects(lease.query('COMMIT', [])); await adapter.close();
    });
    await t.test('SQL error discards the client and the next real transaction succeeds', async () => {
      const {adapter} = create(), c = createGenerationTransactionClientV1(adapter, () => true);
      await assert.rejects(c.query('SELECT 1/0', []), /GENERATION_SQL_UNAVAILABLE/);
      assert.equal((await c.query(insert, ['after-error'])).rows[0].value, 'after-error'); await adapter.close();
    });
    await t.test('extended protocol rejects multiple statements', async () => {
      const {adapter} = create(), c = createGenerationTransactionClientV1(adapter, () => true);
      await assert.rejects(c.query('SELECT $1::text; SELECT 2', ['a']), /GENERATION_SQL_UNAVAILABLE/); await adapter.close();
    });
    await t.test('actual COMMIT followed by dropped reply remains unknown with exactly one write', async () => {
      const {adapter} = create(); let acquisitions = 0;
      const lostReplyPool = {async acquire() {
        acquisitions++; const lease = await adapter.acquire();
        return {release: lease.release, async query(sql: string, values: readonly string[]) {
          const result = await lease.query(sql, values);
          if (sql === 'COMMIT') throw Error('DISPOSABLE_REPLY_DROPPED');
          return result;
        }};
      }};
      await assert.rejects(createGenerationTransactionClientV1(lostReplyPool, () => true).query(insert, ['commit-unknown']), /GENERATION_SQL_COMMIT_UNKNOWN/);
      assert.equal(acquisitions, 1);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM nodepg_fixture.events WHERE value='commit-unknown'")).rows[0].n, 1);
      await adapter.close();
    });
    await t.test('shutdown interrupts active work and closes every checked-out client', async () => {
      const {adapter, raw} = create(), lease = await adapter.acquire();
      const rejected = assert.rejects(lease.query('SELECT pg_sleep(5)', []), /GENERATION_PG_QUERY_FAILED/);
      await adapter.close(); await rejected; assert.equal(raw.totalCount, 0);
      await assert.rejects(adapter.acquire(), /GENERATION_PG_DISABLED/);
    });
    assert.ok(rawPools.every(pool => pool.totalCount === 0));
    // A local socket end is not remote cancellation: pg_sleep may continue until
    // the fixture's 1s statement_timeout. Require server cleanup within that
    // explicit bound plus 2s scheduling/observation allowance, not immediately.
    for (let attempt = 0; attempt < 150; attempt++) {
      const count = (await owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='potok-nodepg-fixture'")).rows[0].n;
      if (count === 0) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='potok-nodepg-fixture'")).rows[0].n, 0);
  } finally {
    await Promise.allSettled(pools.map(pool => pool.close())); await owner.end();
  }
});
