# POTOK generation work checkpoint — 2026-11-12

This file updates the working status against `POTOK_Generation_Work_Instructions_2026-11-11.pdf` and the owner-approved decisions in `POTOK_GOAL_ENGINE_NUTRITION_DECISIONS_2026-11-11.pdf`. It is a code/repository checkpoint, not approval to change Staging, Production, merge, or activate the trusted generator.

## GitHub state verified for this checkpoint

- Repository: `Tatianos7/POTOK`; root `AGENTS.md` read from local checkout and current `master` (`5531c5f`). No nested `AGENTS.md` files were present locally.
- Current local base was the reference-only joint-window Draft PR #370 series. GitHub reports #370 open, Draft, mergeable, based on #369 head `49c964b9051c00d0c450e51c801c2d91d276dd4f`, with head `86efb41c975a32dd8cd01e540345049d642cea23`; its Vercel status is successful. PR #369 is also open/Draft and not merged. Neither is proof of trusted generation or product activation.
- Local checkout had seven unrelated untracked partial-download files under `public/exercises` and `public/models`. They are owner/environment artifacts and must be preserved; do not stage them.
- Current `master` Goal Engine still exposes only weight loss, maintain, and gain. `GoalResult` normalizes all other goal strings to maintain. The modal and validator do not offer drying/recomposition, optional body-fat input, or training/rest-day goals. Manual editing in `EditGoalModal` uses the existing `calculateMacros` behavior. These are observations of legacy code, not approved nutrition formulas.

## Scenario status

| Scenario | Status | Evidence and next operation |
|---|---|---|
| S0 — reconcile code and route | IN_PROGRESS | Instructions and current `master`/PR #369/#370 were checked. Update this checkpoint with the new implementation result and keep unrelated untracked files intact. |
| S1 — save and reopen a test week | IMPLEMENTED_NOT_FULLY_VERIFIED | The isolated reference UI supports device-local save/reopen and the owner has inspected it on a phone. It does not create an authoritative server plan. Recheck this path after the current API/diagnostic changes are published. |
| S2 — select an appropriate, varied menu | IN_PROGRESS | Calorie corridor, recipe exclusions, daily staple diversity, weekly repeat cap, and saved-goal read are present in the reference flow. PR #370 only reported joint daily windows; it did not search for them. This branch now contains a bounded reference search over the three macro windows, a client-checked diagnostic receipt, and clear bounded-search disclosure. Local contracts, TypeScript, lint, API-bundle check, and staging-preview build pass. A private real-catalog run was unavailable in this checkout, so its numerical outcome remains unverified; next: publish an isolated Preview from this branch and test it, then compare the 7 days against all four windows. |
| S3 — verified release catalog | LATER / RELEASE GATE | Recipe inspection and weighing remain deferred by owner choice; this does not block generator code or an explicitly unverified preview. No recipe may enter a Production release without the required ingredient/source/portion review. Use the recipe/weighing guide when that stage begins. |
| S4 — trusted server generation and persistence | BLOCKED / NOT INTEGRATED | The existing contracts and draft PRs do not mean the worker/runtime is active. Continue read-only contract review and disposable tests. Any Staging database write/apply requires a separate, exact approval. Trusted generator and Edge remain inactive. |
| S5 — replace a meal and update shopping | NOT IMPLEMENTED | The current test action excludes a recipe from a later reference search; it does not replace a saved meal or reconcile shopping. Build only after the same validated candidate/portion policy is available. |
| S6 — use a plan in Today/My Flow | NOT INTEGRATED | Product actions must preserve `PLAN != FACT` and use the canonical diary write path. Technical diagnostics remain isolated from product navigation. |
| S7 — rolling plan and adaptation | NOT COMPLETE | Preserve confirmed history and require explicit preview/confirmation for future changes. Resolve only the calendar/revision rules needed for the first release. |
| S8 — resilience, access, performance, device | IN PROGRESS ACROSS SCENARIOS | Local contracts and hosted reference-page checks exist. Still needed: current CI on the combined candidate, real authenticated Android/mobile behavior, failure/recovery and resource evidence. A web preview is not Android acceptance. |
| S9 — release candidate and acceptance | NOT STARTED | Requires the combined code candidate, release-eligible reviewed catalog, trusted path, complete acceptance and exact rollout approvals. Afterwards return to Premium purchase verification (#198), then discuss workout generation separately. |

## Goal screen consequence of the new decisions

Yes, the existing goal flow needs product work before it can fully represent the approved Premium scope. It is a connected change across `CreateGoalModal`, `GoalResult`, `Goal`, `EditGoalModal`, goal validation/persistence, and the generator's confirmed-goal binding. It must preserve one Goal Engine and the Free/Premium boundary.

The owner-approved screen behavior includes Premium drying and recomposition choices, an optional body-fat input, and a Premium-only opt-in to distinguish training/rest-day targets. Recomposition availability depends on strength training; removing strength training must warn and require a user choice. Training-day targets must be previewed and confirmed before saving; the generator reads only those confirmed day-specific targets.

Exact drying/recomposition formulas, acceptable intensity bounds, body-composition interpretation, training-day energy/macro redistribution, schedule identification, and several conflict/rounding rules are still unapproved. Do not expose a selectable mode that silently falls through to maintain, invent numbers, or change the saved target in the background. First keep the current supported generation path moving; separately prepare an implementation contract and tests for the goal-screen work without wiring unapproved calculations.

## Non-negotiable limits

- Daily reference acceptance uses all four owner-approved windows jointly: calories ±50 kcal inclusive, protein and fat ±10%, carbohydrates ±15%.
- A failed bounded search is not proof that no valid week exists in the full catalog. Distinguish a reached search cap from the absence of a candidate in the explored bounded pool.
- Recipe nutrition and portions remain unverified reference values until owner review. Do not invent ingredient states, weights, yields, portions, or carbohydrate semantics.
- Do not write to Staging or Production, merge, activate a trusted worker/Edge, or publish recipe data without the corresponding separate approval.
- Every user-facing plan change preserves `PLAN != FACT`; existing diary facts and confirmed plan history are not rewritten.
