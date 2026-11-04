# POTOK accelerated AI development workflow — proposal v1

Status: PROPOSED / owner review required. This document is not a grant of production or deployment permissions.
Date: 2026-11-04
Scope: GitHub-based AI-assisted development, without Codex dependency.

## Authority and precedence
- Read root AGENTS.md and relevant approved domain contracts before every change. This proposal adds workflow guidance only; it cannot override stronger safety, security, privacy, or domain restrictions.
- Treat proposed/draft documents and source-preparation packets as non-authoritative. Never infer approval from a passing test or CI.
- Owner approval of a development stage authorizes only the explicitly scoped branch/code/test/documentation work. Do not interpret “делай” as production, staging-write, migration, release, or merge authorization.
- No secrets or private recipe packets in public GitHub; sanitize logs, issue bodies, PR descriptions, and artifacts.

## Stage-based execution
- Agree on one outcome-oriented stage containing up to four related, bounded tasks, each with an acceptance criterion and affected path list.
- Within an approved stage, proceed through analysis, implementation, targeted tests, fixes, security review and draft PR without asking for approval at every noncritical substep.
- Stop and ask the owner if requirements conflict, evidence is missing for a consequential decision, the task scope expands, or an irreversible/security-sensitive action is needed.
- Separate unrelated tasks into isolated branches. Parallelism is optional and only safe when changes, tests, and dependencies are isolated; do not promise simultaneous autonomous workers.
- No background continuation is implied by ordinary chat. Report when a task is blocked by tools, quotas, unavailable environments, or missing owner evidence.

## Git discipline
- Use a dedicated branch and Draft PR for each independently reviewable change. Never push directly to master; never merge or mark ready without separate approval.
- Respect existing stacked Draft PR ancestry; verify exact base/head SHA and upstream dependencies before proposing a new PR. Do not rebase, squash, retarget or merge stacked branches without owner approval.
- Preserve all owner files; stage exact paths only; never force push, reset --hard, or clean -fd.
- Do not claim a local test was run if only GitHub CI ran; distinguish static review, CI, staging verification, and production proof.

## Quality gates
- State expected behavior and acceptance tests before editing.
- Add negative/security/regression tests where relevant. Run available targeted checks and relevant CI; report unrun checks and why.
- Preserve canonical resolver-first identity, visible-food authorization, snapshot-first writes, idempotency and no ambiguous/unresolved successful canonical writes.
- Preserve PLAN != FACT, history and receipts, fail-closed behavior, account isolation, RLS and least privilege.
- Recipe source preparation is not canonical resolution, nutritional approval, publication, or runtime admission. Missing serving sizes, yields, edible states, quantities and identity must remain explicitly blocked.
- No automatic fallback, invented evidence, silent data correction, or destructive cleanups.

## Mandatory owner gates
Explicit separate owner authorization required for:
- Any production change or deployment, including feature activation and payment changes.
- Any staging write/apply, database migration, RLS/grant/role/security policy change, or destructive data operation.
- Merging PRs, modifying release branches, enabling workers or scheduled runtime actions.
- Sending sensitive data to external services, changing data-retention or account-deletion semantics.

## Stage report (Russian, concise)
1. Outcome and exact scope.
2. Branch / Draft PR / base and head SHA.
3. Implemented items and evidence.
4. Tests: local vs CI, PASS/FAIL/NOT RUN.
5. Security, data and domain invariant checks.
6. Blockers, assumptions, deferred owner decisions.
7. Next recommended stage, with explicit approval boundary.

## Pilot adoption
- Start with one non-production, documentation-or-test-only stage and measure: owner approvals needed, time to verified PR, CI pass rate, reopened defects.
- If effective, adopt stage-based development more broadly. Keep root AGENTS.md unchanged until the owner reviews this proposal and its interaction with the current stacked PR chain.
