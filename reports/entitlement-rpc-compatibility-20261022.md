# Entitlement RPC compatibility review — 2026-10-22

Status: REVIEW ONLY. No database changes.

## Verified client call site
The checked `src/services/entitlementService.ts` resolves the authenticated user through `auth.getUser()`, rejects a different supplied user ID, and calls `get_entitlements` and `get_paywall_state` using that session user ID.

The proposed SQL guard in `supabase/migration_drafts/premium_rpc_authority_hardening_review_20261021.sql` retains those RPC parameters and permits authenticated own-account calls. This checked client service is compatible; other callers have not yet been fully inventoried.

## Existing acceptance tests
`scripts/contracts/supabase-auth-postgrest-acceptance.mjs` tests own-account entitlement reads, cross-account and anonymous denial, paywall compatibility, and privilege forgery. It requires a disposable Supabase instance with seeded test users and refuses known production and staging hostnames.

## Remaining gates
- Review all client and server RPC callers before rollout.
- Run real Auth/PostgREST acceptance on an approved disposable instance.
- Split the review-only SQL draft into separately reviewed entitlement, purchase, and explainability changes.
- Confirm rollback and permissions before requesting deployment approval.

No disposable integration suite was executed in this review. Production, staging and master were not modified.
