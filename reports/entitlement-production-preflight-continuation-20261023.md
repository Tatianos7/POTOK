# Entitlement RPC Production preflight continuation — 2026-10-23

Status: PARTIAL PASS / PRODUCTION NO-GO. Read-only investigation; no cloud mutations.

## Verified against live Production dtsdnhbcwpbfrhcazqkb
- public.entitlements has id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; RLS enabled, entitlements_owner policy uses auth.uid()=user_id.
- Both public RPCs are postgres-owned SECURITY DEFINER with public,pg_temp search_path; anon/authenticated/service_role currently have effective EXECUTE. Vulnerability persists.
- Live get_entitlements resolves coalesce(p_user_id,auth.uid()) without enforcing own account. Live get_paywall_state delegates to get_entitlements.
- PostgreSQL pg_depend scan returned no registered dependent routines. Additional public pg_proc.prosrc textual scan found no other public function mentioning either RPC. This does not prove absence of dynamic calls or other-schema consumers.

## GitHub client consumer review
- Branch audit/supabase-public-grants-20261021, src/services/entitlementService.ts: getSessionUserId calls auth.getUser and rejects mismatched supplied userId; both RPC methods pass current session userId. Methods canRealtimePose/canGenerateProgram/canAdaptProgram/canExplain/load/refresh/explain call via these wrappers.
- This is positive client evidence, NOT a complete repository-wide call-site inventory. GitHub default-branch code search returned no matches for RPC names; therefore cannot claim full coverage or absence of server/background consumers.
- Forward candidate supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql preserves function signatures and paywall body, guards auth.role/auth.uid and restricts EXECUTE to authenticated; review-only transaction ends in ROLLBACK.
- Recovery candidate supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes EXECUTE for both functions; review-only ROLLBACK. Recovery is fail-closed and will interrupt Premium client functionality. Not executed or verified on disposable database in this session.

## Remaining mandatory gates
1. Exhaustive call-site inventory on exact deploy SHA (including server, jobs, edge functions and dynamic RPC calls); document any service_role consumer and required migration path.
2. Verify recovery candidate on disposable local Supabase and rehearse failure/restore with operator and backup procedure. Do NOT use legacy rollback which reopens cross-account access.
3. Confirm staging schema drift strategy: staging lacks legacy RPCs; no automatic creation of legacy entitlement authority.
4. Freeze deployment SHA, confirm deployment window, monitoring and authorized operator; obtain separate explicit owner authorization before any Production write.
5. Execute production acceptance through actual authenticated/anon/service_role API after approved deployment; confirm SQLSTATE 42501 cross-account, own account, missing-row free fallback and paywall semantics.

## Decision
NO-GO for Production deployment today. Local GitHub 4/4 PASS is not production rollout approval.
