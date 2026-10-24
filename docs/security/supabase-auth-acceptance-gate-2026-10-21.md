# Supabase security acceptance gate — 2026-10-21

Status: REVIEW ONLY. No Supabase mutation authorized.

## Verified facts

- Production PostgreSQL reports 17.6.
- information_schema.column_privileges reports authenticated INSERT and UPDATE on both user_profiles.has_premium and user_profiles.is_admin.
- CI at commit 0df98ebe3b5e60f6766c47784ff1721173a9797b completed SUCCESS for both Supabase grants review guards and POTOK PR Checks.
- CI runs only static checks and an isolated PostgreSQL fixture. It does not prove Supabase Auth or PostgREST integration.

## Required gates before staging

1. Enumerate table- and column-level INSERT/UPDATE privileges, including PUBLIC/inherited roles; review RLS policies and all privileged server writers.
2. Remove client INSERT **and** UPDATE capability for has_premium and is_admin. Ensure INSERT default values cannot be overridden by client roles. Test upsert onConflict id_user and ordinary field updates, including coach_settings, voice_settings and avatar_url.
3. Deny client writes to entitlements, subscriptions and billing_events; preserve trusted server-authorized writes.
4. Exercise real Supabase Auth JWT identities via PostgREST: own profile create/update allowed; cross-user writes denied; privileged columns and payment/subscription mutations denied; test both INSERT and UPDATE, including upsert and RPC paths.
5. Run tests in a disposable isolated environment with equivalent schema, roles, grants, RLS, triggers, RPCs and PostgREST behavior. CI must report green. Then request explicit owner approval for staging apply and acceptance.
6. Prepare tested rollback, backups and controlled production rollout, with separate owner approval.

## Current blockers

- Review SQL is deliberately BEGIN/ROLLBACK and not deployable.
- Disposable CI fixture uses a simplified table, not real Supabase Auth and app schema.
- Client profile upsert compatibility under column INSERT/UPDATE allowlists is unverified.
- A successful CI result does not close this gate.

## October 30 default grant change

Track separately: audit future migrations and require explicit least-privilege grants and RLS for each new public API table, with disposable migration tests.
