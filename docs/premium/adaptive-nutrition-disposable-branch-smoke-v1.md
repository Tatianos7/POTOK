# Adaptive Nutrition disposable branch smoke v1

Status: **SUPERSEDED / NOT EXECUTED**. The owner rejected Supabase Branching because
the current Free plan requires a Pro upgrade. Do not use these disposable artifacts;
use the separately reviewed retained STAGING smoke package instead. This package was only for an isolated,
data-less Supabase branch created from STAGING project
`ozidryfvhkcbtpnulakq`. It is not approved for main STAGING or production.

## Why a disposable branch is required

The applied Adaptive Nutrition contract intentionally makes operation receipts,
graph revisions and nutrition events immutable. Selection heads also have
restricting foreign keys. A committed browser fixture therefore cannot be safely
removed row by row, while a rollback-only transaction cannot survive browser
refresh or logout/login. The only teardown for this package is deletion of the
entire disposable branch.

Supabase branches are separate environments with their own database, API/Auth and
credentials. Dashboard branches are data-less unless **Include data** is enabled.
They incur branch compute/storage/egress charges and require a plan that supports
Branching. Current official pricing lists Branching on Pro/Team and separate branch
compute starting at `$0.01344/hour` for Micro; actual organization billing remains
the owner's authority. Delete the branch immediately after the smoke.

Official references:

- <https://supabase.com/docs/guides/deployment/branching>
- <https://supabase.com/docs/guides/deployment/branching/dashboard>
- <https://supabase.com/docs/guides/deployment/branching/working-with-branches>
- <https://supabase.com/docs/guides/platform/manage-your-usage/branching>
- <https://supabase.com/pricing>

## Files and fixed fixture identity

- `docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.preflight.sql`
- `docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.fixture.sql`
- `docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.postcheck.sql`
- `docs/premium/drafts/adaptive-nutrition-disposable-smoke-v1.env.example`
- fixed selection ID: `9a220000-0000-4000-8000-000000000001`
- fixture lineage: `potok-disposable-branch-smoke-v1`
- fixture timezone: `Europe/Moscow`

Exact SQL SHA-256 values:

- preflight: `c711bc760cbf8d277dffc3450aab83b96303d982f938a7afcef6dfc5123f12d1`
- fixture: `4dc1657cfeaea883de0ff71a41d132b33c3dbcc7fdea12b95cc549675bca57e4`
- post-smoke check: `8ed5a7313718a7dd4e7448af7e9e9a927a865a28fd323b4b9af3a26ff3817d78`

Local repair on 2026-09-22: the separate `$verify_fixture$` block now declares
its exact selection and plan-revision constants inside its own PL/pgSQL scope.
No fixture behavior, identity, transaction boundary or teardown rule changed.

The fixture derives its account from the branch's sole `auth.users` row. It does
not contain an email, password or copied user data. It creates no canonical food,
recipe, meal-selection or diary/FACT row.

## Exact owner workflow and checkpoints

Each numbered checkpoint requires a separate owner action. None has been run by
Codex.

1. **Branch approval and billing check.** In the Supabase Dashboard for
   `ozidryfvhkcbtpnulakq`, confirm Branching is available, the owner/admin has
   permission to enable it, the temporary cost is acceptable, and create one
   disposable branch. Leave **Include data OFF**. Never merge this branch.
2. **Schema evidence.** Open the disposable branch's SQL Editor and run only the
   preflight artifact. At first, the isolated-account section may report zero Auth
   users; all required-object, grant, repair/runtime-marker and immutable-guard
   booleans must already be true. Do not run the fixture.
3. **Migration fallback, only if needed.** If all five applied packages are absent
   but the expected legacy STAGING schema exists, apply the exact reviewed files in
   this order to the disposable branch only:

   1. `20260921_trusted_entitlement_v2.sql` —
      `ffef9a7de1b1540a4511751614c170a1269bc16dc97c5e663c0475dda0065029`
   2. `20260921_trusted_entitlement_v2_1_repair.sql` —
      `949a155479c002c37b54a733ac7e16c21b1cb3c10ebc5cdb06afcf460f69f47c`
   3. `20260921_trusted_entitlement_v2_2_repair.sql` —
      `38781cda4f22e7b6c341fb32e9829b9e04e1eacd1f893bfac9e0a066ec951a77`
   4. `20260921_adaptive_nutrition_persistence_v1.sql` —
      `2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4`
   5. `20260921_adaptive_nutrition_runtime_activation_v1.sql` —
      `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`

   If preflight shows a partial or different state, stop. Do not re-run installers
   over existing objects or reconstruct the wider STAGING baseline from guesses.
   Delete/reset the disposable branch and review its branch/migration source. If
   preflight already passes, apply none of these files.
4. **Branch-local Auth user.** In the disposable branch Dashboard, create exactly
   one new test user under Authentication > Users with unique temporary credentials.
   Do not copy a real STAGING/production account and do not insert directly into
   `auth.users`. Keep the credentials outside the repository and chat. Re-run the
   full preflight; record the emitted test account UUID locally. `data_ready` and
   all security/object booleans must be true.
5. **Fixture approval.** Verify the repaired fixture SHA-256 against this package, then run
   it once in the disposable branch SQL Editor as the owner session. It fails closed
   unless the branch has exactly one Auth user and all relevant application,
   entitlement and adaptive runtime surfaces are empty. A successful run commits a
   synthetic Goal, a 24-hour verified Premium attestation, one active generated
   Monday–Sunday selection, one bootstrap receipt and one immutable seven-day graph.
6. **Local smoke config.** Copy the checked-in example to ignored
   `.env.adaptive-smoke.local`, fill only the disposable branch URL, its public
   anon/publishable key, branch ref and the preflight account UUID, then run the app
   locally with `vite --mode adaptive-smoke`. The branch ref must differ from the
   base STAGING ref; the URL must exactly match that branch ref; both runtime and
   smoke gates must be true; authenticated account and configured account must
   match. Production builds without this explicit mode/config stay OFF.
7. **Browser smoke approval.** Use a browser configured for `Europe/Moscow` so the
   local active-week shell and branch fixture use the same calendar. Run the exact
   checklist below. Do not test REPLACE and do not introduce an offer producer.
8. **Read-only evidence.** Run the post-smoke SELECT-only artifact. Save the output
   without credentials or session tokens. All listed expected counts must match.
9. **Teardown approval.** Logout, stop the local smoke build, remove the ignored env
   file, clear the disposable branch's site data, and delete the entire disposable
   branch from the Dashboard. Do not merge it and do not attempt row cleanup. Verify
   the branch and its credentials are gone so billing stops.

## Browser checklist

1. Sign in as the sole branch-local test user and open Today.
2. Confirm the authoritative current week loads and contains seven synthetic slots.
3. On today's or an earlier slot, choose **Не ел(а)**. Confirm success appears only
   after the receipt-bound exact read.
4. Refresh and confirm the annotation remains authoritative.
5. Choose **Отменить отметку**, wait for receipt-bound reconciliation, refresh, and
   confirm the annotation is retracted.
6. Logout and login again as the same test user; verify only that account's state is
   shown and the final authoritative state remains.
7. Confirm FACT controls (`CONSUMED_AS_PLANNED`, `CONSUMED_MODIFIED`, `EXTRA_FOOD`)
   are absent and no diary row exists.
8. Do not test REPLACE: this package creates no validated replacement offer.

## Boundaries

This package does not prove branch availability, billing, schema inheritance or
live behavior until the owner performs the checkpoints. It does not authorize SQL
on main STAGING, production, deployment, push, migration merge, canonical content,
FACT projection, a replacement-offer producer or retained fixtures.
