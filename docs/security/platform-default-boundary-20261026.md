# Platform default privileges: conditional SQL boundary, 2026-10-26

This corrects the earlier requirement to delete the two `supabase_admin`/public/TRUNCATE default ACL entries before release. The narrow gate is control of affected application objects, not a forced zero platform-default count. It is not satisfied merely because the entries are platform owned.

Official basis: [Supabase Knowledge Base](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema). Project `postgres` cannot modify reserved `supabase_admin` defaults. Supabase recommends controlling customer-owned defaults and relocating extensions out of public; unassociated platform-owned public objects require Support review. Moving an extension preserves its grants, so API schema exposure is a separate check. Never grant platform-role membership, SET ROLE into it, edit system catalogs or use a local superuser to claim a managed-platform fix.

## Authored read-only checker

`scripts/security/platform-defaults/check.sql` runs BEGIN READ ONLY, catalog SELECT and ROLLBACK. It emits counts and a bounded verdict, no user rows, object definitions or catalog snapshot. No DDL, role change or remediation runs. `SQL_BOUNDARY_VERIFIED` requires all of the following:

- No table TRUNCATE defaults for new postgres-owned objects in public or globally, reaching PUBLIC/API roles directly or through inherited roles.
- No effective anon/authenticated TRUNCATE on any existing ordinary/partitioned public table, even with RLS.
- No extension declared in public and no platform-owned public table/view/materialized view/foreign table/sequence/function.
- No client CREATE in public or extensions, including inherited access.

The residual platform public TRUNCATE default count is reported; it is not silently zeroed and it alone cannot produce a pass. Any unexpected platform object or public extension produces NEEDS_REVIEW. Missing required schemas/roles fail rather than claiming safety.

This checker concerns only the public application SQL boundary above. It does not audit all schemas, future function EXECUTE defaults, sequence privileges, privileged wrappers, arbitrary migration roles, SQL session issuance, application authorization or global security. Storage/GraphQL platform schemas must not be rewritten with blanket revokes to satisfy a public-schema gate. Data API `extensions` exposure and future extension installation policy require separate validation. This classification is not permission to apply the release.

## Integration with the reviewed group

The existing pg_trgm move is already the eighth pinned candidate. No thirteenth write migration is introduced; all original eight inputs, all four follow-up hashes and the owner's portable runner bytes remain unchanged. The read-only checker is additionally tested inside the same twelve-candidate transaction on synthetic fixtures, then the original metadata/content rollback is verified. Platform defaults deliberately remain present. The owner already supplied TWELVE_RESTORED_REHEARSAL_OK for the earlier exact runner (112 tables / 14888 rows); that does not claim execution of this additional checker or full-copy application acceptance.

An approved release needs explicit extension placement outside public, customer-default containment, successful post-apply SQL checks and evidence that extensions is not exposed over the target Data API. The disposable real API harness now tests an extensions Content-Profile request receives 406/PGRST106; this proves only that fixture's configuration. Read-only target discovery is private audit context, never a public hosted ACL/function snapshot. Nothing has been applied to Production/Staging here.

## Tests and next gate

Ten checker tests exercise clean-with-residual defaults, own/global/PUBLIC/inherited default leaks, current table TRUNCATE despite RLS, inherited schema CREATE, public extension and relocation, unassociated platform table/function and read-only preservation of data/roles/memberships/platform defaults. Native PG17 plus the existing combined-runner/real API/root checks validate the authored sources; CI is distinct from managed Supabase ownership/hook behavior.

Next remains persistent full-copy application/API acceptance and exact release drift/recovery approval. Retain the original restored baseline, create a separately named disposable copy and validate all selected writes there before approval. Never turn the rollback-only owner runner into a hosted COMMIT script. This work neither activates Graph/Edge/generation nor implements receipt verification; payments remain #198 after meal-plan generation.

The native combined fixture preinstalls its pgcrypto dependency explicitly in extensions before the historical photo source's schema-less IF NOT EXISTS statement. Embedded fixtures omit that unsupported extension. The original pinned sources are unchanged. This prevents the fixture itself from introducing an unrelated public extension; the standalone negative extension case still requires NEEDS_REVIEW when any public extension exists. The checker detected this fixture placement issue in the first native run, rather than exempting it.
