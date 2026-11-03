# Generation patch package — Staging installation receipt, 2026-11-03

## Authorization and exact scope

The owner explicitly approved applying PR291 only to POTOK Staging and checking
the result, with the generator remaining inactive. Source review head:
`a4032bb6eb164091b9a56a336b52960fd046137b`.

The offline builder reproduced the exact reviewed COMMIT artifact SHA-256:
`b68452293e48b998358a5cdc4fb4caeea8fba01f1dd6f817f8405b6624b20100`.
It contains the PR288 source-commit fence followed by PR290's nested recipe-ID
correction: one new private helper and four intended function-body changes.
The original source-byte pins, order and bounded package wrapper were unchanged.

## Execution and independent postcheck

Before execution, the connected Supabase project was independently identified as
POTOK Staging with the expected project ID/host and ACTIVE_HEALTHY status. A fresh
SELECT-only inventory reported baselineReady=true, installedReady=false,
helperAbsent=true and all eleven common metadata checks true.

The exact approved transaction was executed once through the connected SQL
interface and returned without an error. The transaction itself required
baseline admission, preserved existing function metadata/ACLs and all unrelated
existing function bodies, and required installed-phase admission before COMMIT.

A subsequent independent read-only query reported installedReady=true,
baselineReady=false, installedFunctions=true, helperValid=true and all eleven
common checks true. The transition to baselineReady=false is expected: the old
function bodies have been replaced and the helper is now present. The project
was again reported ACTIVE_HEALTHY.

The checks cover function body/security/configuration pins, private writer/helper
permissions, narrow reader/gateway LOGIN attributes and exact four/three function
allowlists, client gateway denials, worker table/sequence denials, private source
RLS, revocation insert guards, graph/operation constraints and immutable-history
triggers. No raw hosted metadata dump, application records or credentials are
retained in this receipt.

## Remaining boundaries

This is successful installation and metadata admission, not hosted menu E2E.
No generation request, graph write, recipe-source publication, FACT write or
historical recalculation was invoked. No runtime/Edge deployment, secret-store
provisioning, pool connection, master merge or Production action was performed.
The generator remains inactive. PLAN != FACT.

The previously recorded owner password/TLS probes and the isolated native graph
roundtrip are separate evidence. They do not establish an ordinary-account
request-to-menu flow on the installed Staging package. Real catalog readiness,
backend secret binding, actual worker execution, account/Auth/UI acceptance and
separate activation approval remain open. Unknown recipe portions and cooked
yields remain unknown.

Do not rerun the original pre-installers or package against the installed state:
their old-body/absent-helper baseline is intentionally no longer satisfied.
Further changes require a fresh bounded review rather than restoring old pins.
