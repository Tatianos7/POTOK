# Adaptive Nutrition retained STAGING smoke v1

Status: **SETUP APPLIED / BROWSER SMOKE COMPLETE / V1.1 RETIREMENT REVIEW READY**.
The owner reports that the retained setup and browser smoke completed on Supabase
STAGING project `ozidryfvhkcbtpnulakq`. Codex did not execute or independently query
the setup or smoke. The owner-provided SELECT-only evidence records two complete
SKIPPED/UNDO pairs, zero live annotations and no FACT/diary/replacement effects.
Supabase Branching is not used because the current project is on the Free plan and
preview branches require an upgrade. Production is excluded.

This fixture is intentionally retained. Applied operation receipts, graph revisions,
events and entitlement audit remain append-only. Retirement appends a protected
Premium revoke and moves the exact fixture selection to `archived`; it performs no
row cleanup.

## Exact identity

- account: `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`
- selection: `7e710000-0000-4000-8000-000000000001`
- plan revision: `7e710000-0000-4000-8000-000000000011`
- history revision: `7e710000-0000-4000-8000-000000000012`
- diary revision: `7e710000-0000-4000-8000-000000000013`
- bootstrap operation: `7e710000-0000-4000-8000-000000000014`
- seven slot/snapshot/portion identities: retained `7e71…0021–0047` namespace
- lineage source: `potok-retained-staging-smoke-v1`
- Goal marker: `potok_retained_staging_smoke_v1`
- bootstrap idempotency key: `potok-retained-staging-smoke-v1/bootstrap`
- grant/revoke evidence refs: `potok-retained-staging-smoke-v1/grant` and `/revoke`

No disposable `9a22…` identity is reused.

## Artifacts and SHA-256

- SELECT-only preflight:
  `docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.preflight.sql`
  — `a776fae4843c46898652e4fb548422eba4582c49c0637e63b362fc6a93162a8f`
- one-time setup:
  `docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.setup.sql`
  — `b935cf9ec1aa40a0b0e34bc05bf3d899db98251b9683c4f756ff442bf56314b0`
- SELECT-only post-smoke check:
  `docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-smoke.sql`
  — `5ae171d262ecd77f0caa2bf5e975da03572f3bfa7f609bc9aebdd52e6f9fc38d`
- retirement, not cleanup:
  `docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.retirement.sql`
  — `9f5bd64325f65afe11b6bf42f769452d0050cc46b8d544f9f8c249d163d8208f`
- SELECT-only post-retirement check:
  `docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-retirement.sql`
  — `90c6ac1baa87af1c56b6087c9e2fa81f396a209b2f21edf0e2beb61ce6e0f084`
- inert build-config example:
  `docs/premium/drafts/adaptive-nutrition-retained-staging-smoke-v1.env.example`

## Setup admission and effects

The preflight returns one `ready_for_retained_fixture_setup` verdict. The owner must
also visually verify the Dashboard project ref because `current_database()` cannot
attest the Supabase project ref.

Setup repeats the material checks under one owner transaction and fails before
COMMIT unless:

- the exact Auth account and exactly one existing profile are present;
- Premium/admin flags and provenance are the expected clean false/null baseline;
- the account has no Goal, plan selection, runtime row, diary row, attestation or
  replacement offer;
- the retained lineage, marker, fixed IDs and evidence/idempotency namespaces are
  globally unused;
- the applied entitlement, persistence and runtime functions exist.

A successful setup creates only one synthetic Goal, one 24-hour protected Premium
grant, one active generated contract-v1 Monday–Sunday selection, one settled
bootstrap receipt and one immutable graph revision containing seven synthetic
dated slots. Every `recipeRevision` is null. It creates no food, recipe, legacy meal
selection, event, FACT, diary row or replacement offer.

The fixture declares `discoveryPolicy=explicit-smoke-selection-only`. Existing
runtime Today receives the selection only through exact build-time configuration.
Any future normal plan discovery must exclude
`origin_lineage.source='potok-retained-staging-smoke-v1'` regardless of status, and
must also exclude `status='archived'`. This retained row is never a normal generated
or user-created plan candidate.

## Local smoke configuration

Copy the inert example to gitignored `.env.adaptive-smoke.local`, use only the
existing STAGING public anon/publishable key, and launch locally with
`vite --mode adaptive-smoke`. The client requires all of these exact values:

- `VITE_ADAPTIVE_NUTRITION_RUNTIME_V1=true`
- `VITE_ADAPTIVE_NUTRITION_READ_V1=true`
- `VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1=true`
- project ref and URL exactly `ozidryfvhkcbtpnulakq`
- authenticated account exactly `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`
- selection exactly `7e710000-0000-4000-8000-000000000001`

There is no query-param, localStorage or manual runtime UUID override. Default and
production environments remain OFF.

## Browser checklist

The exact owner-run local/browser procedure is
`docs/premium/adaptive-nutrition-retained-staging-browser-smoke-runbook-v1.md`.

1. Login as the exact STAGING test account and open Today.
2. Load the authoritative current Monday–Sunday week.
3. Choose **Не ел(а)** on today's or an earlier synthetic slot.
4. Wait for receipt-bound exact reconciliation; then refresh and verify the annotation.
5. Choose **Отменить отметку**, wait for exact reconciliation, and refresh.
6. Logout/login as the same account and verify the authoritative final state.
7. Confirm FACT controls are absent. Do not test REPLACE.

The smoke must finish before the 24-hour grant expires. Do not extend/regrant by
editing or rerunning setup; return for a separately reviewed action if it expires.

## Retirement semantics

Retirement v1.1 requires one exact bootstrap plus `N >= 1` accepted SKIPPED receipts,
the same number of accepted UNDO receipts and exactly `2N` annotation/retraction
events. Every annotation must have exactly one same-fixture retraction; no live,
orphaned, second-successor or unexpected event/receipt is accepted. Digests, graph,
Goal, account, selection and retained lineage remain exact. FACT/PLAN_REPLACED,
diary, meal-selection, replacement-offer and foreign-fixture rows must remain zero.
It then calls the protected owner-only revoke routine with the exact fixture evidence
ref and changes only the exact active fixture selection to `archived`. Both changes
share one transaction. Any later failure rolls back both.

Re-running retirement after exact completion is an idempotent no-op. A partial,
foreign or later entitlement lineage fails closed. Receipt, graph, events, Goal,
grant and revoke audit rows remain permanently. After revoke, new paid effects and
current Premium read are denied by the applied entitlement boundary; exact replay,
lookup and operation-bound historical read retain their underlying receipt/graph/
event material.

The postchecks return foreign-fixture-row counts. The mutation SQL itself scopes
every direct row change to the exact account, selection and lineage. The package
does not scan, export or hash unrelated user data to manufacture a global equality
claim.

## Owner checkpoints in exact order

1. **OWNER-REPORTED COMPLETE:** preflight and retained setup ran on STAGING
   `ozidryfvhkcbtpnulakq`; exact retained account and selection are present.
2. **OWNER-REPORTED COMPLETE:** the browser smoke produced two complete SKIPPED/UNDO
   pairs; the original exact-one-pair postcheck therefore returned false while all
   safety measurements were clean.
3. Run the revised SELECT-only post-smoke hash and require
   `retained_smoke_acceptance_pass=true`.
4. Separately approve the exact v1.1 retirement hash. Run it only after that revised
   post-smoke pass. It is retirement, not cleanup.
5. Run the exact SELECT-only post-retirement check and require
   `retained_fixture_retirement_pass=true`.
6. Remove the local env file, logout and clear local site data. Leave all retained
   server history intact.

No step authorizes production, push/deploy, FACT/diary projection, canonical data,
replacement offers, payment, service-role provisioning or changes to applied SQL.
