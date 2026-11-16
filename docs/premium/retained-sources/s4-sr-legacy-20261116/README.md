# POTOK Staging generation checkpoint

Resume from this branch. The recovered seven-day reference menu and the scoped request inventory are checked in. The inventory links each of the 17 candidate recipes to the project weighing guide and records the number of servings declared there. That number is a reference, while `portionEvidence: null` and `publicationEvidence: null` mark the outstanding admission evidence. The reference menu can be replayed offline.

For the hosted run, use the existing [recipe publication contract](../../reviewed-runtime-recipe-publication-evidence-v1.md). Obtain published recipe and policy revisions, bind the single request to the test account and its actual goal, then check that one saved plan opens again after refresh and creates no diary FACT entries. The inventory is a checklist with unresolved fields, rather than a database write payload.

The pre-recovery scratch scripts and complete ingredient-source extracts were not recovered. Use the original project sources for any missing evidence. Future changes needed to resume this work belong in the Git branch. Keep private workbooks, credentials and test-account data out of the repository.

## Portion evidence to collect for this menu

The guide identifies eight one-serving recipes and nine two-serving recipes. Its declared counts are present for all 17. The available guide is a blank measurement protocol, so none of these counts supplies measured portion evidence. The publication contract expects a reviewed recipe and a real portion revision; positive declared servings alone do not fulfill that requirement.

For each recipe already prepared, attach the dated measurement or the filled guide page to its recipe number. Record the actual ingredient weights and states, finished yield excluding cookware, number and weight of served portions, and any remainder or drained liquid. For separately served components, retain their individual weights. For a single-serving assembly, capture the actual served weight and any remainder. If the observed count differs from the reference, review the affected recipe snapshot before replaying the menu. Leave unmeasured entries pending. Existing measurements can be reused when they identify the matching recipe and preparation.

All 17 appear in the current seven-day witness. An excluded recipe requires rerunning selection against eligible replacements before relying on seven-day coverage. This dependency applies to this specific menu; the other recipes in the 132-recipe guide are outside this checkpoint.

## Local server roundtrip verified on 2026-11-16

The runtime implementation was recovered from the GitHub branch `codex/generation-request-roundtrip-20261103` at `40516f31cb92990474094ba3a12413c04c4c9e5c`. A clean checkout passed 36 application/worker/readback tests. The existing native request-to-menu suite passed all 22 tests/subtests using an isolated loopback PostgreSQL 17.6 instance with the PostgreSQL 17.12 psql client.

With synthetic accepted inputs, the server recorded and activated one seven-day plan, recovered the original request after a lost response, and the application controller reopened the stored plan. Foreign/revoked sessions could not read it, repeat requests did not duplicate it, and the test kept the FACT relation empty. This suite does not exercise live Supabase Auth, the hosted Staging environment, or automatic selection from the real 17-recipe catalog. The checked-in reference week still requires published recipe and policy revisions before hosted execution.
