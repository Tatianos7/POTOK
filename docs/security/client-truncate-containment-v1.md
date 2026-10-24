# Client TRUNCATE containment: review candidate

Client TRUNCATE can empty a table despite row-level security. This candidate revokes only TRUNCATE on existing ordinary and partitioned tables in `public` from `PUBLIC`, `anon` and `authenticated`, and from `postgres` defaults in `public`. SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, RLS policies and service-role grants are outside its mutation scope.

The file is deliberately in `supabase/migration_drafts`, outside automatic migration discovery. Merging this PR does not apply it. Hosted apply requires explicit owner approval under AGENTS.md.

## Preconditions and transaction behavior

- Effective role must be `postgres`; all existing public ordinary/partitioned tables must be owned by that role. There must be at least one table.
- Client roles must exist and must not have CREATE on public. Unsafe global postgres TRUNCATE defaults abort before mutation: schema defaults cannot subtract global defaults, and this patch does not change other schemas.
- The candidate revokes direct and PUBLIC grants, then checks effective table/default privileges, including inherited roles. An unresolved inherited grant aborts the entire transaction; it does not alter role memberships.
- All changes are in one transaction, with a 5-second lock timeout and 60-second statement timeout. Failure rolls back the transaction. The operator must stop on errors and must not attempt to continue individual statements.
- Coordinate a DDL freeze during apply and the subsequent read-only check. This script does not serialize concurrent table creation or concurrent privilege changes across sessions.

## Remaining authority boundary

Default ACLs belong to the role creating the object. Non-superuser postgres cannot modify supabase_admin defaults without membership. The candidate never tries to grant that membership or impersonate a platform administrator. It reports residual client TRUNCATE defaults belonging to other creators and can commit existing-table containment while that separate risk remains.

Consequently, a new table created by supabase_admin can still inherit client TRUNCATE. Arrange a supported privileged/platform procedure to remove those defaults, or require an explicit client TRUNCATE revoke and verification before exposing each new table. Until the other-owner defaults are remediated and verified, **do not claim future-table closure**. The regression suite deliberately reproduces this residual.

Foreign tables, other schemas, SECURITY DEFINER code, privileged service actions, RPC authorization, premium/admin profile flags, and billing authority are not fixed by this candidate. Do not interpret zero table TRUNCATE grants as a complete security clearance.

## Review and rehearsal

1. Keep the verified SQL/Storage backup and a separate copy. Save private pre-apply ACL and default-ACL snapshots, including grantors and grant options, for an exact reviewed reversal; do not publish them in this repository.
2. Run `scripts/security/client-truncate/readiness.sql` read-only against the intended target. Review actor, ownership, effective table grants and creator-specific defaults.
3. Rehearse the candidate on an isolated restored database as effective postgres, with stop-on-error enabled. A superuser-only rehearsal is insufficient. Compare row counts, RLS and grants before/after. Confirm existing-table counts drop to zero and postgres public defaults have no client TRUNCATE; classify other creators separately.
4. Obtain explicit approval naming the hosted project and this exact candidate revision. Only then arrange the DDL freeze and apply with stop-on-error. Never run the destructive fixture suite against any hosted or restored user database.
5. Repeat readiness queries immediately after apply, retain the private evidence, and smoke-test normal application reads/writes with representative client roles.

For a failed transaction, disconnect or issue ROLLBACK; do not regrant privileges. For reversal after commit, use the captured pre-apply ACLs in a separately reviewed transaction. There is intentionally no blanket GRANT ALL rollback.

## Disposable automated regression suite

Use a fresh local PostgreSQL 17 cluster whose initial superuser is `test_admin` and database name is `potok_privilege_test`. The suite creates cluster roles and destroys the public schema. It rejects remote hosts and any other database name. It assumes a fresh cluster and is not designed to share roles with another test run.

```sh
npm install --prefix /tmp/potok-sql-driver --no-save --ignore-scripts --no-audit --no-fund pg@8.16.3
SQL_TEST_PG_MODULE=/tmp/potok-sql-driver/node_modules/pg/lib/index.js \
TEST_DATABASE_URL=postgres://test_admin@127.0.0.1:5432/potok_privilege_test \
node scripts/security/client-truncate/test.mjs
```

The dedicated GitHub Actions workflow provisions that disposable PostgreSQL 17 service without Supabase credentials. Ten scenarios cover actual baseline TRUNCATE, denied client TRUNCATE after apply, DML/RLS preservation, partition grants, postgres future defaults, replay, inherited table/default grants, global defaults, owner drift, client CREATE, wrong actor, and the unmodified other-owner default boundary. The optional `SQL_TEST_PGLITE_MODULE` runs the same suite against a supplied PostgreSQL 17 PGlite module for local feedback; the CI service is the native PostgreSQL check.

## Primary references

- [PostgreSQL 17 TRUNCATE](https://www.postgresql.org/docs/17/sql-truncate.html)
- [PostgreSQL 17 default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
- [Supabase: supabase_admin default privilege restrictions](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema)
