# Premium authority source review — 2026-10-25

Status: review-only candidate and disposable acceptance. Not a release approval.
This document contains public-source analysis and synthetic test design only.
No hosted function definitions, catalog/grant snapshots or user data are included.

## Public source and caller boundaries

`supabase/phase7_3_2_monetization.sql` on master
555d3263ce20e70ae59576e9dd3e2d2c4a97240e is the exact fixture source. It creates
owner-scoped ALL policies on entitlements, subscriptions and billing_events.
If clients have DML privileges, ownership does not prevent an own-account tier
upgrade. Tests deliberately grant broad legacy table and column privileges to
reproduce that threat model; those grants are synthetic, not a hosted snapshot.

The same public file defines get_entitlements(uuid) with an arbitrary supplied
user ID, get_paywall_state(text,uuid) delegating to it, and two purchase-event
writers without caller ownership or receipt verification. Tests replay their
complete original bodies. Baseline MD5 guards in the candidate are computed from
these tracked source bodies, not from a private database export.

The existing exact-tree/AST inventory in Draft #185 covers master 555d326 and
audit branch 97ba981. Its report identifies only entitlementService.ts direct
app callers for the two read RPCs, no literal runtime start/restore-purchase
calls, and dynamic wrappers requiring review. It does not establish external
caller absence, installed Android/deployed-build identity or hosted readiness.
The current master entitlementService supplies the authenticated session ID and
rejects a mismatched requested account. This client guard cannot replace server
authorization. Tracked Edge http.ts restricts its dynamic wrapper to two adaptive
request/status names; neither is a purchase/entitlement endpoint. Generator
activation is unchanged and unauthorized by this review.

## Narrow candidate

`premium_finance_authority_review_v1.sql` requires PostgreSQL 17, postgres actor,
expected finance table ownership/RLS, owner policy semantics, unique entitlement
owner index and exact public legacy RPC body hashes.
Unknown function bodies abort before privilege changes. It is deliberately a
one-time source-baseline candidate: reapplying after the body has changed rejects
the baseline rather than silently accepting unreviewed drift.

- Remove PUBLIC/anon/authenticated finance table mutation and column-level write
  grants, including inherited-effective checks. Do not change role memberships.
- Preserve SELECT capabilities and existing service-role table DML; unexpected
  service capability loss aborts the transaction rather than adding new grants.
- Keep the existing get_entitlements signature/default argument and JSON DTO,
  require auth.uid plus the signed top-level JWT role, and reject a foreign ID.
  user_metadata/profile flags are not authorization inputs. Use an empty pinned
  search_path and qualified table/Auth references; deprecated auth.role is absent.
- Preserve get_paywall_state body/DTO, delegating through the guarded reader.
  Both read endpoints are authenticated-only, including service-role denial,
  matching the prior read-endpoint review contract.
- Deny client EXECUTE on start/restore purchase; preserve existing service
  execution only where explicitly available. No new service grant or receipt
  verification is introduced. Existing purchase-event behavior is not billing
  authority: logging a start event never grants Premium.
- Always ROLLBACK in the tracked file. Only disposable tests replace that final
  terminator with COMMIT. No migration history or hosted settings are changed.

This preserves an existing public SECURITY DEFINER endpoint for compatibility;
it does not introduce a new exposed privileged API. A future dedicated API/private
schema design is a separate contract. Existing entitlement values are preserved,
not retroactively attested as genuine payments. No anonymous-sign-in policy is
added: an authenticated anonymous user, if enabled, can only read their own row;
anonymous API role and missing identity are denied.

## Acceptance

Twelve embedded PostgreSQL 17.5 cases pass: source exploit reproductions; data,
policies, other function bodies, own reads and server DML preservation; column
write revocation; own free/paid/fallback/paywall DTOs; cross-account denial;
missing role/identity and user-metadata manipulation; endpoint role boundaries;
unknown-body and inherited-grant rollback; full review-wrapper rollback; and
service capability inherited only from PUBLIC aborting safely, plus broad extra
policy and missing unique owner index rejection before changes.

Native PostgreSQL 17 repeats the twelve cases. A separate real CLI 2.122.0 local
Auth/Mailpit/PostgREST job first reruns the prior measurement-photo API acceptance
after extracting its unchanged Auth helpers into local-auth.mjs. It then obtains
two additional real OTP sessions and reproduces own upgrade, foreign disclosure
and anonymous event forgery. It applies the exact candidate in that fixed fixture
and checks own/free/paid/default-argument/paywall behavior, cross-account denial,
all three finance mutation paths, anon/service read-endpoint denial, client
purchase denial and preserved local service event/DML capability. Final state is
checked on a fresh SQL connection. CI results must be verified before claiming
native/API acceptance. No tokens, receipts or message bodies are published.

## Release blockers still separate

- Combine exact profile/TRUNCATE/anonymous-RPC/pg_trgm/photo/Premium candidate
  versions on a restored complete schema; these source fixtures are not parity.
- Review historical finance rows and trusted payment/receipt/event authority.
  An existing service-only stub is not a verified payment provider integration.
- Review admin food mutation RPCs' legacy is_admin trust and every retained
  privileged caller. Profile-write containment does not attest old admin flags.
- Close historical-food recomputation/server caller scope; coordinate with
  PR #186 client changes before revoking a still-used endpoint.
- Review other Premium endpoints, views, SQL helper chains and archived client
  builds; static literal-call absence does not prove universal absence.
- Resolve Staging divergence, establish fail-closed recovery, fresh hosted drift
  checks and post-apply monitoring, then obtain exact Production authorization.

Agreed sequence remains security stage, celebration, then plan generation.
PLAN != FACT, Graph v1 and inactive trusted generator/Edge constraints persist.

References reviewed 2026-10-25:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
