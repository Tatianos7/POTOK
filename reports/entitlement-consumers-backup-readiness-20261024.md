# Production RPC consumers and backup readiness — 2026-10-24

Status: **NO-GO / incomplete evidence**. Read-only audit; no Production/Staging writes.

## Verified
- Supabase Production project `dtsdnhbcwpbfrhcazqkb` returned `ACTIVE_HEALTHY` (Postgres 17).
- `src/services/entitlementService.ts` on branch `audit/supabase-public-grants-20261021` uses `auth.getUser()`, checks the optional requested user ID against the authenticated user, and calls `get_entitlements` / `get_paywall_state` with the current session user ID.
- Other direct consumers within this service: `canRealtimePose`, `canGenerateProgram`, `canAdaptProgram`, `canExplain`, `load`, `refresh`, `revalidate`, `recover`, `explain`.
- Previous Production read-only audit verified vulnerable legacy SECURITY DEFINER function bodies and broad EXECUTE grants.

## Not verified; do not mark complete
- GitHub code search returned no results for `get_entitlements`, `get_paywall_state`, `entitlementService`, or `paywall`, despite the known file containing these names. This search is **not reliable evidence of zero additional callers**, and searches the default branch, not necessarily this PR branch. Full repository and background-job caller inventory remains outstanding.
- Supabase connector provides project metadata, SQL, migrations and logs, but no Dashboard Backups listing or backup-restore status. `ACTIVE_HEALTHY` does not establish backup availability or restore readiness.
- Backup timestamp, retention, PITR availability, latest completed backup, and tested restore are unverified.

## Required operator evidence
1. Open https://supabase.com/dashboard/project/dtsdnhbcwpbfrhcazqkb/database/backups and confirm backup type, most recent successful backup time, retention, PITR status (if available), and restore options. Do not trigger restore on Production.
2. Confirm documented restore procedure, restore destination/isolation, responsible operator and maintenance window. Prefer testing restore in an isolated project before migration; redact secrets and user data in evidence.
3. Run full repository branch-aware code search including `src`, `supabase`, scripts, Edge Functions, SQL, migrations, scheduled/background jobs, and indirect wrappers. Inspect `rpc('get_entitlements'` and `rpc('get_paywall_state'` call sites; check `service_role` dependencies.
4. Review forward candidate and fail-closed recovery; obtain separate explicit owner approval for any Production migration.

## Decision
**NO-GO** until full branch-aware caller inventory and backup/restore evidence are complete. No Production migration authorized or applied.
