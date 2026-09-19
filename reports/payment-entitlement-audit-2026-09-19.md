# Payment and entitlement architecture checkpoint

Status: **AUDITED IN SOURCE; LIVE SECURITY UNVERIFIED; NO INTEGRATION OR DB APPLY**.
This report proposes decisions, not authorization to change server policy.

## Existing implementation and risks

- Web runs on GitHub Pages; Android uses Capacitor, application ID
  `com.potok.fitness`. No billing client dependency or verified purchase backend
  was found. Paywall purchase controls remain disabled.
- `AuthContext` obtains UI Premium from `user_profiles.has_premium`.
  `entitlementService` separately calls `get_entitlements` / `get_paywall_state`.
  Local demo is a UI preview and must never activate a paid server account.
- `supabase/phase7_3_2_monetization.sql` grants owner-row `FOR ALL` policies on
  subscriptions, entitlements and billing events. If deployed with ordinary
  client write grants and no further protection, owners can alter their own
  paid tier. Row ownership alone does not secure privileged fields.
- The same SQL defines SECURITY DEFINER entitlement RPCs with a caller-supplied
  user ID and no exact `auth.uid()` restriction. Purchase/restore RPCs also accept
  a user ID without verifying its owner or a provider receipt. They only insert
  events; their success response is not evidence of payment or restored access.
- The 20260311 hardening migration sets function search paths but does not add
  these missing ownership/provider checks. Its profile table grants allow
  authenticated INSERT/UPDATE; row policies do not restrict privileged columns.
- `profileService` includes cached `has_premium` and `is_admin` in profile upserts
  and exposes setters. Client changes alone cannot prevent a crafted API request.
  Existing triggers, grants, deployed definitions and real actors must be audited
  before claiming either a production exploit or effective protection.
- Premium catalog migrations allow authenticated reads. The client route gate
  cannot enforce a paid-data boundary. Owner must decide which recipe/plan data
  may be public, Free-authenticated, paid, or strictly private.
- The accepted Premium read catalog currently lacks canonical food references in
  its ingredient graph. Billing must not create a parallel recipe truth.

These source findings are launch blockers for a claimed secure paid launch.
No live exploit, mutation, purchase, privilege activation or policy fix was run.

## Platform decision

Google Play normally requires Play Billing for paid digital features distributed
through Play, subject to its stated exceptions and eligible regional programs.
An external checkout in a Capacitor WebView is not a generally valid substitute.
See the [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

| Option | Client/provider route | Decision and constraints |
| --- | --- | --- |
| Play Android subscription | Native Play Billing bridge + secure backend verification | Preferred proposal for a Play release; requires merchant/market eligibility, native integration, product configuration and sandbox proof |
| Separate web subscription | Selected web payment provider + secure webhook/backend | Merchant legal country, target markets, currencies and provider availability must be supplied before selecting a provider; cross-platform access and Play messaging reviewed separately |
| First stage without payment | Purchase stays disabled; demo remains explicit | Only valid launch scope if owner explicitly excludes payment for this stage; does not remove account/RLS or other launch gates |

No provider has been selected. No products, credentials or webhook deployment
have been created. iOS/App Store billing is outside the inspected Android scope.

## Proposed lifecycle contract for owner review

This is a design proposal; reconcile it with actual deployed schemas before a SQL
draft. Ordinary clients read their permitted entitlement and request verification;
only a trusted provider-verification path grants/revokes paid access. Never trust
`has_premium`, localStorage, client price, receipt text or an RPC status alone.

For Play, verify purchases on the backend. Real-time notifications trigger an
authoritative API lookup; the notification alone does not contain complete state.
See [backend integration](https://developer.android.com/google/play/billing/backend),
[notification reference](https://developer.android.com/google/play/billing/rtdn-reference)
and [subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

| Flow | Proposed behavior and required proof |
| --- | --- |
| Product catalog | One Premium scope; monthly/yearly pricing and trial require owner choice. Tentative Play subscription ID `potok_premium`, base plans `monthly` / `yearly`; proposals only, verify availability before creation |
| Purchase | Authenticated account binds to verified provider purchase; pending/canceled/unverified purchase never enables Premium; acknowledge according to provider requirements |
| Restore | Re-query provider and validate binding; prevent the same purchase being assigned to two accounts; explicit support policy for account transfer |
| Renewal | Refresh verified paid-through/state; duplicate or delayed notifications cannot double-grant or roll back a newer state |
| Cancellation | Disable future renewal; retain only provider-confirmed access until its expiry; UI distinguishes cancel from immediate revoke |
| Grace / hold | Apply documented provider state and owner-approved grace policy; do not extend access from a client clock |
| Refund / revoke | Reconcile provider's actual entitlement state; remove access when revoked, preserving billing audit and completed diary facts |
| Idempotency | Provider transaction/purchase identity and event ID uniquely deduplicate; verify current state before applying out-of-order events; transactionally update entitlement plus audit |
| Propagation | One server authority; reconcile profile flag and RPC contract, refresh after verification/account change, no demo-to-paid propagation |
| Failure | Pending verification state with retry; no false purchase success or free access from backend errors; cached access only within an explicit server-issued validity policy |
| Sandbox | Dedicated test accounts/products; purchase, pending, restore, renew, cancel, refund, hold, duplicate/out-of-order delivery, offline/recovery and A/B-account tests |
| Production | Separate approved credentials setup, webhook authentication, retry/monitoring, reconciliation and rollback runbook after staging proof |

## Immediate read-only evidence package

`scripts/sql/premium-security-read-only-audit.sql` selects catalog metadata only:
RLS policies, table/column grants, relevant RPC definitions and protection triggers.
It does not query personal rows, receipts or tokens and is not a migration.
It has not been executed. Select the project through the existing secure tooling;
do not send passwords, JWTs, service keys or purchase tokens into chat.

Metadata is necessary but insufficient. A reviewed staging actor-test package
must subsequently prove: Free cannot grant itself Premium/admin; A cannot read
or change B; anonymous calls fail as specified; direct paid-data reads obey the
approved policy; restore cannot steal a purchase. Write probes need explicit
staging authorization, disposable fixtures and cleanup instructions first.

## Exact checkpoints and consequences

1. **Scope/platform decision now:** payment mandatory for first launch, or explicitly
   excluded? For integration, confirm Play distribution, merchant legal country,
   target markets, whether web checkout is required, monthly/yearly and trial intent.
   Prices/product IDs remain proposals until the merchant/provider constraints are known.
2. **Server contract next:** after live read-only evidence, prepare exact SQL/code
   diff for privileged-field protection, own-account RPC scope and authoritative
   entitlement writes. Review paid-data visibility. No blanket approval requested
   for unspecified schema changes.
3. **Integration/apply later:** approve provider and exact reviewed implementation,
   staging apply/test package, then separate production deployment/products/webhook.

Affected areas if approved: billing client adapter, secure verification endpoint,
provider event handler, subscription/entitlement/billing tables and policies,
profile privileged fields, RPCs, Premium catalog policy and Paywall/auth refresh.
Risks include accidental paid-user lockout, duplicate entitlement, purchase/account
misbinding and mismatched profile/RPC access. Staging fixtures and reconciliation
must precede production. Rollback must restore the reviewed previous deployment
and safe policy state while retaining purchase/event audit; never disable RLS or
erase billing records. Exact rollback SQL depends on the inspected live schema.

Alternative: explicitly exclude payments and retain disabled purchase controls.
Deferring a decision blocks billing integration and a paid-launch claim. Deferring
the server security audit also leaves Free/account security unverified; hiding
Paywall alone does not establish safe server authorization.
