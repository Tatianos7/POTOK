# Premium RPC call-site audit — 2026-10-21

Status: PARTIAL / NO-GO. GitHub default-branch code search returned zero results for each exact name `get_entitlements`, `get_paywall_state`, `start_purchase`, `restore_purchase`, `billing_events`, `user_profiles`. **This is not proof of absence:** search indexing/permissions/coverage are not independently validated. Do not treat as complete repository-wide audit.

Verified by direct file reads:
- `src/lib/supabaseClient.ts` initializes a frontend Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; it is not a trusted purchase authority.
- `src/services/profileService.ts` explicitly separates ordinary profile write fields and quarantines protected Premium/admin fields. It normalizes legacy `has_premium` and `is_admin` to false instead of treating profile booleans as authorization.
- `supabase/migration_drafts/premium_rpc_authority_hardening_review_20261021.sql` proposes authenticated own-user reads and service_role-only purchase/restore. The SQL is review-only and ends with ROLLBACK.
- Direct fetch attempts for `src/services/premiumService.ts`, `src/services/subscriptionService.ts`, `src/services/premiumEntitlementsService.ts`, `src/server/premiumEntitlementGateway.ts` returned NOT_FOUND; this does not exclude differently named callers.

Blockers before migration:
1. Obtain a complete recursive source inventory on the exact PR HEAD (not GitHub default-branch search alone), inspect all `.rpc(`, `functions.invoke(`, `get_entitlements`, `get_paywall_state`, `start_purchase`, `restore_purchase`, `subscriptions`, `entitlements`, `billing_events`, `has_premium`, `is_admin`, and edge/backend routes.
2. Determine whether frontend directly calls purchase/restore, and identify verified server-side provider receipt validation and authority source. **Do not infer absence from search returning no hits.**
3. Validate user_profiles ordinary-write callers against column allowlist; coach_settings/voice_settings are present in live Production **and are explicitly included in the current review SQL column-scoped INSERT/UPDATE allowlist and disposable fixture**. Their grant coverage is verified in `supabase-local-grants-assertions.sql`; still inspect actual client writers and payloads before rollout.
4. Build and run a disposable production-shape RPC acceptance suite before Staging.

No cloud mutations were performed for this audit.

## Verified PR-head tracked-source inventory (GitHub Actions artifact, 2026-10-21)

Inspected generated artifact `premium-rpc-callsite-inventory.json` from [run 39630686318](https://github.com/Tatianos7/POTOK/actions/runs/39630686318/artifacts/12358752759). It reports commit `905e80d7b014aa7cacc5a4d37e165dd6103064da` (workflow checked-out merge commit), 516 tracked source files in the inventory scope.

- `get_entitlements`: `src/services/entitlementService.ts:33` plus disposable acceptance and two read-only SQL scripts.
- `get_paywall_state`: `src/services/entitlementService.ts:45` plus disposable acceptance and two read-only SQL scripts.
- `start_purchase`: only `scripts/contracts/supabase-auth-postgrest-acceptance.mjs` and `scripts/sql/premium-security-read-only-audit.sql` (five textual matches).
- `restore_purchase`: only the same two files (three textual matches).
- Generic `.rpc(`: 11 files / 22 matches; includes `src/services/adminAccessService.ts`, `src/services/adaptiveNutritionPersistenceService.ts`, `src/services/programDeliveryService.ts`, and `supabase/functions/adaptive-nutrition-generate-v2/index.ts`. `functions.invoke(`: zero matches in scanned files.
- Finance table name matches: 8 files / 38 matches, including `src/context/AuthContext.tsx` and `src/services/uiRuntimeAdapter.ts`. Profile references: 12 files / 69 matches.

**Interpretation:** no direct purchase/restore RPC caller was identified in the scanned runtime TypeScript/JavaScript sources. This is **not** proof that no trusted payment writer exists outside the tracked inventory (deployed edge functions, external backend, scheduled tasks, dashboards or other repos). The inventory does not establish provider receipt verification. Production purchase/restore RPCs currently record events without verifying receipts; do not treat `started`/`restored` as paid entitlement.

**Required next:** inspect the named generic RPC and finance references, compare deployed server functions and external writers with source control, establish payment-provider verification and account binding, and prove idempotency conflict handling. NO-GO; no cloud writes authorized.
