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
