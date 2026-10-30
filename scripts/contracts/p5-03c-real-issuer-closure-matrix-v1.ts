/** Disposable-only acceptance over REAL issuer SQL and trusted-entitlement prerequisites.
 * The caller owns a Unix-socket-only cluster; there is no remote connection option.
 * Auth claims are fixtures, not a claim of live JWT verification or account erasure.
 */
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { approved, id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
import { definitionRequest, nutritionRequest } from '../../src/server/__tests__/nonFoodEvidenceFixturesV1';
import { foodReviewProposalDigestV1 } from '../../src/server/foodEvidenceReviewRequestV1';
import { verifyFoodEvidenceReceiptV1 } from '../../src/server/foodEvidenceReviewGatewayV1';
import { verifyNonFoodReceiptV1 } from '../../src/server/nonFoodEvidenceV1';
import { transformIssuer } from './p5-03c-build-disposable-issuers';

interface DB {
  sql(statement: string): Promise<string>;
  asUser(statement: string, user?: string, claims?: Record<string, unknown>): Promise<string>;
}
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;
const specs = [
  ['food_reviewed_evidence_v1_phase2b.sql', 'public.food_evidence_review_v1(', '  attestation:=potok_food_evidence.authority_v1();'],
  ['nonfood_reviewed_evidence_v1.sql', 'public.nonfood_evidence_review_v1(', ' att:=potok_food_evidence.authority_v1();'],
] as const;
const tables = [
  ...['retained_sources', 'canonical_revisions', 'nutrition_revisions', 'review_events', 'review_requests', 'current_heads']
    .map(n => `potok_food_evidence.${n}_v1`),
  ...['roots', 'sources', 'events', 'definitions', 'nutrition', 'heads', 'receipts'].map(n => `potok_nonfood.${n}_v1`),
];
function reviewFunction(sql: string, signature: string): string {
  const start = sql.indexOf('CREATE FUNCTION ' + signature);
  assert.ok(start >= 0 && sql.indexOf('CREATE FUNCTION ' + signature, start + 1) < 0);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start));
  assert.ok(end > start);
  return sql.slice(start, end + 3).replace('CREATE FUNCTION ', 'CREATE OR REPLACE FUNCTION ');
}

export async function runRealIssuerClosureMatrixV1(t: TestContext, db: DB) {
  const { sql, asUser } = db;
  let key = 700000;
  const inventory = () => sql(`SELECT jsonb_build_array(${tables.map(n => `(SELECT count(*) FROM ${n})`).join(',')})`);
  const provision = async (n: number, active = true) => {
    const who = id(n);
    await sql(`INSERT INTO auth.users VALUES(${quote(who)},false);
      INSERT INTO auth.sessions VALUES(${quote(id(n + 100))},${quote(who)},NULL);
      INSERT INTO public.user_profiles(user_id) VALUES(${quote(who)});
      SELECT potok_control.grant_entitlement_v2(${quote(who)},'admin',NULL,'synthetic-local-test','closure matrix fixture');`);
    if (active) await sql(`INSERT INTO potok_closure_candidate.accounts_v1(account_id,state) VALUES(${quote(who)},'ACTIVE')`);
    return who;
  };
  const close = (who: string, suffix = '') => sql(`BEGIN; ${suffix}
    SELECT potok_closure_candidate.begin_closure_v1(${quote(who)},${quote(id(++key))}); COMMIT;`);
  const prepare = async (kind: 'food' | 'nonfood') => {
    const n = ++key;
    if (kind === 'food') {
      const req = await approved(n);
      if (req.proposal.contract !== 'potok-canonical-food-review-proposal-v1') throw new Error('CANONICAL_FIXTURE_REQUIRED');
      const root = id(n + 1000000), stable = `synthetic_closure_${n}`;
      await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,is_searchable,needs_review,name,normalized_name,aliases)
        VALUES(${quote(root)},${quote(root)},${quote(stable)},'core',true,false,'Synthetic food','synthetic food','{}')`);
      req.proposal.canonicalFoodId = root; req.proposal.foodStableId = stable;
      req.proposalDigest = await foodReviewProposalDigestV1(req.proposal);
      const raw = JSON.stringify(req);
      const changed = JSON.stringify({ ...req, retainedSource: { ...req.retainedSource, locator: 'https://fixture.invalid/changed' } });
      return { call: `SELECT public.food_evidence_review_v1(${quote(raw)})`,
        changedCall: `SELECT public.food_evidence_review_v1(${quote(changed)})`, key: req.idempotencyReference,
        verify: (who: string, receipt: unknown) => verifyFoodEvidenceReceiptV1(req, who, receipt) };
    }
    const req = definitionRequest(n);
    assert.equal(req.proposal.kind, 'DEFINITION');
    if (req.proposal.kind !== 'DEFINITION') throw new Error('DEFINITION_FIXTURE_REQUIRED');
    req.proposal.stableKey = `synthetic_closure_${n}`;
    const raw = JSON.stringify(req);
    return { call: `SELECT public.nonfood_evidence_review_v1(${quote(raw)})`,
      changedCall: `SELECT public.nonfood_evidence_review_v1(${quote(' ' + raw)})`, key: req.idempotencyReference,
      verify: (who: string, receipt: unknown) => verifyNonFoodReceiptV1(raw, who, receipt) };
  };
  // Poll observed PostgreSQL state rather than assuming a scheduled session ran.
  const waitFor = async (application: string, waitType: 'sleep' | 'lock') => {
    const until = Date.now() + 2500;
    while (Date.now() < until) {
      const where = waitType === 'sleep' ? "wait_event='PgSleep'" : "wait_event_type='Lock'";
      if (await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${quote(application)} AND ${where})`) === 't') return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail(`Did not observe ${waitType} in actual PostgreSQL session ${application}`);
  };

  await t.test('real issuer matrix: unchanged installed issuers and authority match source definitions', async () => {
    for (const [file, signature] of specs) {
      const source = await readFile(`supabase/migration_drafts/${file}`, 'utf8');
      const original = await sql(`SELECT pg_get_functiondef(${quote(signature + 'text)')}::regprocedure)`);
      // Install the same source definition, then compare PostgreSQL-normalized bytes.
      await sql(reviewFunction(source, signature));
      assert.equal(await sql(`SELECT pg_get_functiondef(${quote(signature + 'text)')}::regprocedure)`), original);
    }
    const before = await sql("SELECT pg_get_functiondef('potok_food_evidence.authority_v1()'::regprocedure)");
    assert.match(before, /is_effective_entitlement_v2/);
    assert.match(before, /auth\.sessions/);
    await sql("SET potok_closure.test_target='disposable-postgresql-only';" +
      await readFile('scripts/contracts/p5-03c-closure-admission-disposable-candidate.sql', 'utf8'));
  });

  await t.test('real issuer matrix: baseline reproduces missing closure admission without claiming a fix', async () => {
    const who = await provision(30); await close(who);
    for (const kind of ['food', 'nonfood'] as const) {
      const req = await prepare(kind);
      await req.verify(who, JSON.parse(await asUser(req.call, who)));
    }
  });

  const authorityBefore = await sql("SELECT pg_get_functiondef('potok_food_evidence.authority_v1()'::regprocedure)");
  await t.test('real issuer matrix: mount strict candidate after entry authority, preserving trusted authority bytes', async () => {
    for (const [file, signature, anchor] of specs) {
      const original = await readFile(`supabase/migration_drafts/${file}`, 'utf8');
      await sql(reviewFunction(transformIssuer(original, signature, anchor), signature));
    }
    assert.equal(await sql("SELECT pg_get_functiondef('potok_food_evidence.authority_v1()'::regprocedure)"), authorityBefore);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await assert.rejects(sql(`SET ROLE ${role}; SELECT potok_closure_candidate.assert_active_v1(${quote(id(30))})`), /permission denied/);
      await assert.rejects(sql(`SET ROLE ${role}; SELECT potok_closure_candidate.begin_closure_v1(${quote(id(30))},${quote(id(700))})`), /permission denied/);
    }
  });

  for (const [index, kind] of (['food', 'nonfood'] as const).entries()) {
    await t.test(`real ${kind} issuer: missing account and CLOSING fail before any evidence mutation`, async () => {
      const missing = await provision(31 + index * 5, false), closing = await provision(32 + index * 5);
      await close(closing);
      const req = await prepare(kind), before = await inventory();
      for (const who of [missing, closing]) await assert.rejects(asUser(req.call, who), /ACCOUNT_NOT_ACTIVE/);
      await assert.rejects(asUser(req.call, missing, { exp: 0 }), /JWT_EXPIRED/);
      assert.equal(await inventory(), before);
    });
    await t.test(`real ${kind} issuer: exact replay, bytes conflict and actor-scoped UNKNOWN recovery`, async () => {
      const who = await provision(33 + index * 5), req = await prepare(kind);
      const issued = JSON.parse(await asUser(req.call, who)); await req.verify(who, issued);
      const replayed = JSON.parse(await asUser(req.call, who));
      assert.equal(replayed.replayed, true); assert.equal(replayed.event.eventId, issued.event.eventId);
      await req.verify(who, replayed);
      const receiptCall = `SELECT public.${kind === 'food' ? 'food' : 'nonfood'}_evidence_receipt_v1(${quote(req.key)})`;
      await req.verify(who, JSON.parse(await asUser(receiptCall, who)));
      await assert.rejects(asUser(receiptCall, id(1)), /REQUEST_NOT_FOUND/);
      // Food compares canonical payloads; Nonfood additionally preserves exact request bytes.
      await assert.rejects(asUser(req.changedCall, who), /IDEMPOTENCY.*CONFLICT/);
      await close(who);
      const before = await inventory();
      await assert.rejects(asUser(req.call, who), /ACCOUNT_NOT_ACTIVE/);
      assert.equal(await inventory(), before);
    });
    await t.test(`real ${kind} issuer: actual issuance-first session blocks closure until COMMIT`, async () => {
      const who = await provision(34 + index * 5), req = await prepare(kind);
      const app = `closure_issuance_${kind}`, closingApp = `closure_wait_${kind}`;
      const issuance = asUser(`SET LOCAL application_name=${quote(app)}; ${req.call}; SELECT pg_sleep(4)`, who);
      // Attach settlement handlers immediately; always await both sessions below.
      const issued = issuance.then(value => ({ value }), error => ({ error }));
      let closure: Promise<unknown> | undefined;
      try {
        await waitFor(app, 'sleep');
        closure = close(who, `SET LOCAL application_name=${quote(closingApp)};`);
        await waitFor(closingApp, 'lock');
        assert.equal(await sql(`SELECT state FROM potok_closure_candidate.accounts_v1 WHERE account_id=${quote(who)}`), 'ACTIVE');
      } finally {
        const result = await issued; if ('error' in result) throw result.error;
        await req.verify(who, JSON.parse(result.value));
        if (closure) await closure;
      }
      assert.equal(await sql(`SELECT state FROM potok_closure_candidate.accounts_v1 WHERE account_id=${quote(who)}`), 'CLOSING');
      await assert.rejects(asUser(req.call, who), /ACCOUNT_NOT_ACTIVE/);
    });
    await t.test(`real ${kind} issuer: closure-first session blocks issuance then rejects with zero artifacts`, async () => {
      const who = await provision(35 + index * 5), req = await prepare(kind), before = await inventory();
      const app = `closure_first_${kind}`, waitingApp = `issuer_wait_${kind}`;
      const holder = sql(`BEGIN; SET LOCAL application_name=${quote(app)};
        SELECT potok_closure_candidate.begin_closure_v1(${quote(who)},${quote(id(++key))}); SELECT pg_sleep(4); COMMIT;`);
      let attempted: Promise<void> | undefined;
      try {
        await waitFor(app, 'sleep');
        attempted = assert.rejects(asUser(`SET LOCAL application_name=${quote(waitingApp)}; ${req.call}`, who), /ACCOUNT_NOT_ACTIVE/);
        await waitFor(waitingApp, 'lock');
      } finally { await holder; if (attempted) await attempted; }
      assert.equal(await inventory(), before);
    });
  }
  await t.test('real nonfood nutrition: definition-bound zero vector issued only while reviewer ACTIVE', async () => {
    const who = await provision(41), req = await prepare('nonfood');
    const d = JSON.parse(await asUser(req.call, who)); await req.verify(who, d);
    const nutrition = nutritionRequest(d.revision.definitionId, d.revision.revisionId, d.revision.digest, ++key);
    const raw = JSON.stringify(nutrition), call = `SELECT public.nonfood_evidence_review_v1(${quote(raw)})`;
    await verifyNonFoodReceiptV1(raw, who, JSON.parse(await asUser(call, who)));
    await close(who); const before = await inventory();
    await assert.rejects(asUser(call, who), /ACCOUNT_NOT_ACTIVE/);
    assert.equal(await inventory(), before);
  });
  await t.test('real issuer candidate: explicit rollback leaves all source/revision/event/head/receipt tables unchanged', async () => {
    const who = await provision(42);
    for (const kind of ['food', 'nonfood'] as const) {
      const req = await prepare(kind), before = await inventory();
      await assert.rejects(asUser(`${req.call}; DO $$ BEGIN RAISE EXCEPTION 'MATRIX_FORCED_ROLLBACK'; END $$`, who), /MATRIX_FORCED_ROLLBACK/);
      assert.equal(await inventory(), before);
    }
  });
  await t.test('real issuers: parallel verified reviewers of distinct roots retain independent receipts', async () => {
    const a = await provision(43), b = await provision(44);
    for (const kind of ['food', 'nonfood'] as const) {
      const first = await prepare(kind), second = await prepare(kind);
      const [ra, rb] = await Promise.all([asUser(first.call, a), asUser(second.call, b)]);
      await first.verify(a, JSON.parse(ra)); await second.verify(b, JSON.parse(rb));
      assert.notEqual(JSON.parse(ra).event.eventId, JSON.parse(rb).event.eventId);
    }
  });
}
