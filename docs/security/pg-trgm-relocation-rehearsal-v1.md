# pg_trgm relocation: local rehearsal only

The service defaults of supabase_admin cannot be changed by hosted postgres. Supabase's supported approach is to keep extension objects out of public and control defaults for application-owned objects. This package prepares that boundary without changing any hosted database.

## What the rehearsal does

`scripts/security/pg-trgm/rehearsal.sql` starts a transaction, requires effective postgres, checks extension location/relocatability and target schema access, snapshots extension object identities and function grants, snapshots public index identities/readiness/physical files, and counts public table rows. It then relocates pg_trgm to extensions, checks those invariants and a similarity call, and **always ends with ROLLBACK**. Table contents, privileges and final extension location are unchanged after a successful run. Use psql with `ON_ERROR_STOP=1`; on error, disconnect/ROLLBACK and stop.

This file is deliberately outside supabase/migrations. It is not an apply candidate. Do not change its ROLLBACK to COMMIT for a hosted project. A later apply needs the restored Supabase rehearsal, reviewed application smoke results and explicit approval under AGENTS.md.

The catalog queries read public table row counts but do not export user records or routine bodies. A conservative source scan blocks explicit public extension references and likely extension calls/operators in routines whose configured search_path omits extensions. It can produce false positives and is not a complete parser: computed dynamic SQL, quoted identifiers, external clients, extension operators and unusual routine languages require separate review. The scan removes only simple line-start RAISE message literals before checking dependencies, so their percent formatting placeholders do not masquerade as pg_trgm operators. RAISE argument expressions remain checked. Other literal/comment forms still receive conservative review; this is not a full PL/pgSQL lexer. No routine search_path or grant is changed automatically.

## Required restored Supabase acceptance

1. Run only on the existing isolated restored Docker database, as postgres without superuser privileges. The container name and files must be checked before execution. Keep the SQL/Storage archive outside the container.
2. Expect `TRGM_REHEARSAL_OK` followed by ROLLBACK. The extension must finish in its original schema, and the already performed client TRUNCATE containment must remain in place.
3. Verify public index validity, extension member identity and table counts (built into the SQL). Run the earlier 112-table count verification after the rehearsal too.
4. Before a hosted apply, exercise the real search API with an authenticated fixture user, including exact/partial/Russian text, no matches and foreign-user food invisibility. Do this against an isolated copy with the extension actually moved; the rollback SQL and synthetic CI tests do not prove full application compatibility.
5. A non-owner permission error is a hard stop, not permission to elevate. Hosted Supabase has platform-specific extension rules that native PostgreSQL does not emulate. Do not grant supabase_admin membership, use its local superuser password to claim a postgres success, or drop/recreate the extension to bypass the failure. Resolve through the supported platform/extension procedure first.

The script fails if anon/authenticated can CREATE in extensions, or if expected USAGE is absent. Those require a separate schema access review. It intentionally does not manufacture grants or change the Data API exposure configuration.

## Automated coverage

The dedicated workflow uses a fresh native PostgreSQL 17 service, with no Supabase/app secrets. Thirteen native scenarios (twelve in PGlite) cover rollback and temporary evidence cleanup; fixture commit preserving similarity, index use and client RLS; replay on an already moved extension; explicit public calls; restricted search_path; target CREATE/USAGE; unexpected actor; non-owner refusal and the trusted-extension/bootstrap-owner split. Additional regressions distinguish RAISE formatting placeholders from real percent operators and extension calls in RAISE arguments. Index planner use is checked as table owner, while authenticated filtering/results are checked separately because RLS can affect planner choices.

The test runner destroys public/extensions schemas and creates fixture roles, so it accepts only a loopback host and database named potok_trgm_test. Never point it at the restored user database. The temporary fixture-only commit is generated only inside that guarded test runner; the reviewed operator file stays rollback-only.

For optional PGlite PostgreSQL 17 feedback, provide SQL_TEST_PGLITE_MODULE and SQL_TEST_TRGM_MODULE. Both engines bootstrap the positive fixture by temporarily promoting postgres only while installing the extension, then demote it before executing any rehearsal. This makes postgres own all fixture extension objects. Installing a trusted extension as an ordinary role on native PostgreSQL can leave its internal functions owned by the bootstrap superuser; owning the extension alone is insufficient to relocate those functions. The separate non-owner refusal scenario covers the permission boundary. Neither fixture engine simulates Supabase's managed-role hooks or proves that hosted postgres can move admin-owned objects.

## Prevention and remaining work

- Install new relocatable extensions using an explicit schema, for example `CREATE EXTENSION ... WITH SCHEMA extensions`. Review legacy install scripts before running them; IF NOT EXISTS does not move an existing extension.
- Recheck admin-owned public objects and effective client privileges after extension changes, restores and upgrades.
- Existing extension ACLs remain on the moved objects; hiding a schema from Data API is distinct from revoking SQL access.
- This work does not resolve profile admin/Premium authority, client billing writes, cross-account SECURITY DEFINER RPCs or nutrition history mutation. Those remain release blockers and need their own role/caller tests.

Primary references: [Supabase managed defaults and extension relocation](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema), [PostgreSQL 17 ALTER EXTENSION](https://www.postgresql.org/docs/17/sql-alterextension.html).
