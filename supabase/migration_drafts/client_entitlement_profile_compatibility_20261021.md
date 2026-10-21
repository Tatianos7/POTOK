# Verified client call-site compatibility — 2026-10-21

Status: PARTIAL / NO-GO. Directly inspected files on PR branch `audit/supabase-public-grants-20261021`.

## Entitlement RPC client
`src/services/entitlementService.ts`:
- `getSessionUserId(userId?)` calls `client.auth.getUser()`, rejects missing session, and rejects an explicitly supplied ID that differs from the authenticated account.
- `getEntitlements` invokes `get_entitlements` with `p_user_id=sessionUserId`; `getPaywallState` invokes `get_paywall_state` with `p_user_id=sessionUserId`. Both propagate RPC errors. This call shape is compatible with proposed own-account authenticated RPC authorization.
- `load`, `refresh`, `revalidate`, `recover` call entitlement reads without a supplied ID; `getSessionUserId` still requires a real authenticated user.
- **Product authorization mismatch for owner review:** `canRealtimePose` returns allowed when `can_spatial || can_voice || tier === 'pro' || tier === 'vision_pro'`. The production paywall `spatial` branch checks `can_spatial` only and otherwise requires `vision_pro`. Consequently a `pro` tier with `can_spatial=false` can pass the client pose check while failing spatial paywall. Do not change either contract without product owner decision.
- `canGenerateProgram` defaults `can_view_plan` to true if missing; confirm intended fail-closed behavior before relying on this for paid capabilities.
- `EntitlementStatus.plan` excludes live database tier `coach`; `canRealtimePose` casts raw tier to that union. Assess separately.

## Profile client
`src/services/profileService.ts`:
- `fetch` uses `user_profiles.select('*')` scoped to session account and inserts `id_user` when missing.
- Ordinary writes use session-account-scoped `SELECT -> UPDATE/INSERT`, not broad upsert, with `23505` race recovery.
- Avatar updates use `avatar_url`; coach and voice settings update `coach_settings` and `voice_settings` respectively. All three are present in the **current** reviewed SQL column-grant allowlist and disposable assertions.
- Legacy privileged `has_premium`/`is_admin` values are not used as verified access and are excluded from ordinary profile writes.
- **Potential issue:** profile code still has `id_user`/`user_id` schema fallback; live Production `user_profiles` exposes `id_user` only. Confirm fallback does not hide unrelated schema errors.

## Remaining blockers
1. Check actual consumers of `canRealtimePose`, `canGenerateProgram`, and entitlement exceptions; establish intended authorization for `pro`/spatial and `coach` tier.
2. Verify production-shape local RPC execution (not only table-grant replay).
3. Confirm every backend purchase/restore route verifies provider receipts and uses trusted service role; repository-wide inventory is available as workflow artifact but zero GitHub search hits alone cannot prove absence.
4. Validate remaining profile callers and PostgREST response handling, especially profile insert/update and setting writes.

No cloud changes, no merge, no Staging approval implied.
