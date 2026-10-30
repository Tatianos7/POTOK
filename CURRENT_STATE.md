# POTOK current state

## Generation recovery checkpoint — 2026-10-30

This branch records source preparation only; it does not update the deployed application.
The 2026-10-03 checkpoint below is historical, not the current generator status.

- Verified GitHub generation stack: Draft PRs #244–#252 remain open and unmerged.
- Latest inspected base: #252, `46eccc401f2bd99acde478396d6f51932400cfa2`. Both exact-head CI workflows succeeded.
- Day/meal/week selection is implemented in the candidate stack and tested on synthetic inputs; final accepted-plan projection, full runtime orchestration and real end-to-end delivery remain incomplete.
- Real source readiness: 132 recipes, 0 APPROVED, 730 unresolved/ambiguous ingredient rows. This is the prior source audit, not a new live DB check.
- Recovered the previously uncommitted pear/almond source preparation in an isolated branch; original working files were preserved. Official SR28 record pages and carbohydrate semantics were independently checked.
- Pear/almond available-carbohydrate reference discrepancy is explicit; no workbook rewrite, recipe approval, canonical identity, evidence receipt or measured yield was invented.
- Oatmeal pilot remains selected; water evidence issuance and physical cooking are outstanding. Dairy NO-GO remains in force.
- Next: close existing Food/Nonfood issuer integration gaps, obtain independent source/portion/allergen/publication review for a small real batch, then test real weeks and final server record/read flow. No new parallel authority mechanism.
- Supabase/STAGING/production writes, merge, deployment and generator activation: not performed in this recovery.
- Purchase verification stays after generation, tracked in issue #198.

See [source preparation](docs/premium/pear-almonds-source-preparation-20261030.md), [catalog audit](docs/premium/real-catalog-readiness-20261030.md) and [integration gaps](docs/premium/generation-integration-checkpoint-20261030.md).

## Historical checkpoint

Checkpoint date: 2026-10-03

- GitHub `master` at this checkpoint: `25166665fee11465af867d1731e6818549c2bca0`.
- Cloud environment `POTOK`: **published and operational**.
- Cloud workflow branch → PR → review → owner approval → merge: **verified end-to-end**.
- `WORKFLOW.md` is in `master`; PR **#142 merged**.
- The protected execution binding is accepted on STAGING.
- Rollback-only behavioral acceptance: **PASS**.
- Final SELECT-only postcheck: **15/15 PASS**.
- Acceptance fixture residue: **zero**.
- Auth-contract and schema-USAGE repairs are applied on STAGING.
- GitHub Pages build and deploy for the checkpoint: **PASS** (run `37141713000`).
- Edge Function: **NOT DEPLOYED**.
- Trusted generator: **NOT ACTIVATED**.
- Production database: **untouched**.
- Existing local future work: **72 paths remain uncommitted**; owner baseline paths remain separate and preserved.
- Next technical phase: protected execution runtime / Edge orchestration integration, without generator activation or production rollout.
