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

## Deployed Edge Functions and runtime caller verification (2026-10-21)

Read-only Supabase Edge Function listing returned **zero functions** for both POTOK Production (`dtsdnhbcwpbfrhcazqkb`) and Staging (`ozidryfvhkcbtpnulakq`) through the connected management API. This does **not** exclude external servers, scheduled jobs, other cloud accounts or SQL-triggered writers. Repository file `supabase/functions/adaptive-nutrition-generate-v2/index.ts` exists but its presence does not establish deployment; its generic RPC wrapper does not by itself prove a payment integration.

Direct PR-branch source inspection:
- `src/services/adminAccessService.ts` calls `has_verified_entitlement_v1` (not a payment event writer).
- `src/services/adaptiveNutritionPersistenceService.ts` calls `adaptive_nutrition_lookup_v1`, `adaptive_nutrition_read_v1`, `adaptive_nutrition_mutate_v1` (no purchase/restore call in these named sites).
- `src/services/programDeliveryService.ts` calls program RPCs and has a **separate legacy client-side tier path**: `resolveTier(userId, override?)` trusts a supplied `override`, otherwise maps `profile.is_admin` to `coach` and `profile.has_premium` to `pro`. `getActiveProgram` then allows all tiers (`free`, `pro`, `coach`, `vision_pro`), so this check is not an effective Premium authorization barrier. Treat this as a **security/compatibility review finding**, not proof of actual privilege escalation; inspect downstream program RPC server-side authorization and all `entitlementOverride` callers before changing behavior.
- `src/context/AuthContext.tsx` and `src/services/uiRuntimeAdapter.ts` contain entitlement references, but the inspected matches do not establish a purchase writer.

**Conclusion:** No deployed Supabase Edge Functions were listed and no verified provider receipt-validation backend was identified in the inspected surfaces. This is a **verification gap**, not proof that a backend does not exist. Before any deployment: review `get_active_program` and other program RPC permissions, replace legacy profile-derived Premium authorization with verified server-side entitlements where applicable, inventory external backend writers, and design provider verification/account binding. No cloud writes, paid services or merges authorized. **NO-GO.**

## Program RPC authority review — 2026-10-21

Production catalog read-only query confirmed six `public` functions (`get_active_program`, `get_program_day_details`, `get_program_days`, `get_program_explainability`, `get_program_phases`, `get_program_status`) have `prosecdef=false` (SECURITY INVOKER). This does not prove RLS or ownership checks. Further attempts to read their definitions and EXECUTE grants through the connector were blocked; **no claim of body/grant verification is made**.

Direct PR-branch `src/services/programDeliveryService.ts` review: `resolveTier` accepts an unverified `override` and otherwise maps `profile.is_admin` to coach and `profile.has_premium` to pro; `getActiveProgram` permits all listed tiers, so the client assertion there does not enforce Premium. `submitFeedback` relies on the legacy tier path for its pro/coach/vision_pro gate. `getProgramExplainability` fetches the same RPC regardless of `canExplain`, reducing fields client-side for disallowed users: **this is not server-side data minimization**. `getProgramDayDetails` can return cached program data after RPC errors, so cache account scoping and offline policy also need review. Other program mutations use client table writes; verify RLS ownership and permission boundaries separately.

**Remediation order (proposed, not deployed):** (1) inspect exact SQL function bodies, EXECUTE grants, and underlying table RLS; (2) inventory `getActiveProgram` override callers and existing Free behavior; (3) replace client Premium decisions with verified server entitlements while retaining intended Free reads; (4) enforce explainability and feedback authorization at server/database boundary; (5) test cross-account access, stale caches, Free/Pro/coach cases on disposable Supabase before Staging. Do not remove legitimate Free access by blanket-denying all program reads. **NO-GO.**
