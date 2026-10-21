# POTOK public grants — production read-only dependency audit (2026-10-21)

Status: REVIEW ONLY. No Staging/Production mutations. Draft PR #184.

## Verified from live Production catalog (read-only SQL)
- `public.user_profiles` has all 13 columns expected by proposed ordinary write allowlist: `id_user,first_name,last_name,middle_name,birth_date,age,height,goal,email,phone,avatar_url,coach_settings,voice_settings`.
- `authenticated` has table-level INSERT/SELECT/UPDATE on `user_profiles`; column restrictions cannot protect Premium/admin while broad table privileges remain.
- `anon` and `authenticated` have INSERT/UPDATE/DELETE/SELECT/TRUNCATE/TRIGGER/REFERENCES on `subscriptions`, `entitlements`, `billing_events`.
- Those three financial tables each have an RLS FOR ALL owner policy using `auth.uid() = user_id`, with both USING and WITH CHECK. Thus owner writes are not excluded by RLS alone.
- `user_profiles` has separate authenticated owner SELECT, INSERT, UPDATE policies.
- Trigger on `user_profiles`: `update_user_profiles_updated_at` calling `update_updated_at_column`.
- Public SECURITY DEFINER functions whose definitions mention target tables include `get_entitlements`, `get_paywall_state`, `restore_purchase`, `start_purchase`, plus `apply_admin_approved_food_alias`, `apply_owner_approved_missing_food_draft`, `recompute_food_entries_for_food_ids`. This is a text-based dependency discovery, NOT a verified call graph.

## Open blockers before executable migration
1. Audit definitions, owners, EXECUTE grants and call sites for financial/security-definer functions, including privilege boundaries and purchase flows.
2. Verify column-level grants and role inheritance; `information_schema.role_table_grants` alone is insufficient for effective privilege proof.
3. Verify all app/API writers to the affected tables and impact of revoking anonymous SELECT on finance (if considered).
4. Replay proposed SQL against a disposable schema cloned from actual Production DDL, with real Auth/PostgREST checks and rollback/forward acceptance.
5. Audit other public tables and new-table default privileges separately; October 30 behavior is not solved merely by this targeted patch.
6. Staging requires separate explicit approval; Production requires its own separate approval.

## Rollout rule
Review SQL is BEGIN/ROLLBACK only. Do not rename/copy into `supabase/migrations` or apply automatically. Fail closed on schema drift; verify post-grant effective permissions, RLS, and ordinary profile writes.

## SECURITY DEFINER inspection (production, read-only)
All four public functions `get_entitlements(p_user_id)`, `get_paywall_state(p_feature,p_user_id)`, `start_purchase(p_user_id,p_provider,p_plan,p_idempotency_key)`, and `restore_purchase(p_user_id,p_provider,p_receipt,p_idempotency_key)` are owned by `postgres`, SECURITY DEFINER, and effectively executable by `anon`, `authenticated`, and `service_role`. They set `search_path=public, pg_temp`.
- `get_entitlements` uses `coalesce(p_user_id,auth.uid())` and selects another user's entitlement without comparing to the caller; cross-account disclosure possible.
- `get_paywall_state` delegates to `get_entitlements(p_user_id)`, inheriting its cross-account issue.
- `start_purchase` inserts `billing_events` for caller-supplied `p_user_id` without checking `auth.uid()`.
- `restore_purchase` does the same, storing caller-supplied receipt; the returned `restored` status does not prove payment validation or Premium grant.
- Revoking direct table INSERT alone will not prevent writes through SECURITY DEFINER functions. Function authorization/EXECUTE grants require a separate patch and acceptance tests.
- `update_updated_at_column` is SECURITY INVOKER, owned by postgres, and has effective EXECUTE grants to anon/authenticated/service_role; it is attached as a trigger on `user_profiles`.

**STOP/NO-GO:** do not deploy table-grant hardening in isolation. First design and test RPC authorization and caller ownership, check client call sites, and verify legitimate purchase flows. No cloud modifications were made.
