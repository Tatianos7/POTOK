# Owner-approved Staging installation — 1 November 2026

Installed the exact four-source package from [PR278](https://github.com/Tatianos7/POTOK/pull/278), immutable commit `94c9051cd9fd9d1fa894434efdf0b9f9081519f9`, in Staging `ozidryfvhkcbtpnulakq` after the owner's explicit “Разрешаю” to that bounded installation. This authorization does not extend to activation or Production.

Before installation, the project inventory identified POTOK Staging; all 18 fresh installation-baseline checks passed and all four original SQL SHA-256 values matched the approved manifest. The guarded transaction used migration name `generation_staging_approved_package_v1`, preserved every source definition and guard, checked the baseline again inside the transaction and asserted postconditions before commit. Only outer per-file transaction envelopes were combined. The Supabase apply result was success; a separate subsequent query confirmed committed objects.

Independent observation at 2026-11-01T12:24:57.14468+00:00:

- Seven new function body MD5 values match the approved source bodies; postgres ownership and fixed pg_catalog search_path are preserved.
- Exactly four private readers are granted to the existing NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT reader role. No new login or connection identity was provisioned.
- Both new private tables are empty, forced-RLS protected, and have three protection triggers each. Direct table privilege checks across seven privileges and anon/authenticated/service_role/reader found zero grants.
- Own-request menu readback permits authenticated execution, denies anon and service_role, and a read-only authenticated-role call without a JWT user returned the required denial (transaction rolled back). This is a negative SQL/Auth-boundary probe, not a real signed-in user or HTTP acceptance test.
- Original input/warning/binding/revocation counts remain zero; new preparation/revocation counts and published-manifest count are also zero. No business row or catalog source was inserted by the package.
- Edge function inventory remains empty, as before installation. No Edge deployment, generator activation, source publication, entitlement grant, app rollout, master merge or Production operation was performed.

The exact sanitized metadata/count receipt is `scripts/security/generation-staging-package/install-observation-20261101.json`. It contains no user records, account IDs, JWTs, OTPs or credentials. It is a dated observation, not blanket future authorization or a backup/restore guarantee. Existing package/preflight files and the pre-install observation remain unchanged as historical evidence.

## Security advisor delta

The before/after difference consists only of expected design notices: two [RLS enabled/no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) informational findings for the new ungranted private tables, and one [authenticated SECURITY DEFINER executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) notice for the approved own-request menu reader. Tables intentionally have no direct client policy; readback explicitly checks Auth, current Premium, ownership, current selection and accepted canonical records. Those notices do not justify adding blanket policies/grants or changing the reviewed function security mode. Pre-existing unrelated findings remain unchanged and outside this installation.

## Remaining work

Installation is complete; the earlier “unapplied/absent” notes no longer describe current Staging. The catalog is still unpublished, producer policy/warning provenance and commit-time currentness must be accepted, and reviewed runtime SQL/gateway/client mounting is still needed. After those steps, test a real ordinary-account request through stored-plan/menu readback before a separately approved activation. No completed owner terminal/OTP tests need repeating merely to regenerate a receipt. Cooking remains deferred; unknown measured yield/grams remain null and PLAN does not create FACT.
