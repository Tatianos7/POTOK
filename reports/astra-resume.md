# POTOK resume — 2026-09-20

**POTOK_PREMIUM_ADAPTIVE_NUTRITION_V1_IN_PROGRESS. NOT LAUNCH READY.**

## HEAD / authorization

- Worktree: `/Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation`.
- Branch master; HEAD `38f2e68ca129838b2b6469ade58e51fb15612289`.
- Local commits not pushed: `4fed6b3` (27 approved files), `4c441db` (24),
  `38f2e68` (exact 29 Adaptive Nutrition paths, approved by owner).
- Commit message: `feat: add adaptive nutrition domain and weekly preview`.
- Before the latest commit: exact selective staging/name comparison, no owner
  paths, cached diff check. After commit: index empty. No push/deploy.
- Current PLAN/FACT + read-model/recovery package: **13 UNCOMMITTED paths**,
  index empty; no further commit permission inferred. Exact allowlist is in
  `docs/premium/adaptive-nutrition-v1.md`. Earlier local changes preserved.
- All 229 owner baseline file hashes unchanged. Manifest:
  `/tmp/potok-launch-audit-2026-09-18/baseline.json`.
- NO SQL / DB / RLS writes / payment / import / production activation.

## Active contract / accepted owner decisions

Adaptive Nutrition v1 replaces fixed-14-day nutrition as the target. Active week
is local Monday–Sunday; next week remains provisional. Legacy IDs/routes retained.

Owner confirmed PLAN/FACT/persistence **domain semantics** on 2026-09-20:
consumed-as-planned requires explicit confirmation of the exact plan snapshot;
modified/extra food requires actual payload; skipped is annotation only; replacement
mutates PLAN, never FACT; shopping follows confirmed graph revision. No punitive
compensation. Stale revisions conflict; idempotency and non-destructive supersession
history are required. Do not ask the owner to reconfirm these same semantics.

This does not approve server implementation, schema, endpoint, SQL or writes.
Contract/details: `docs/premium/plan-fact-persistence-domain-v1.md`.

## Completed foundation (committed)

- Compatible Goal/training/preferences/safety/cycle types and advanced macro math
  preview; no new clinical thresholds or Goal activation.
- Seven-day projection through the existing Premium/Today adapter. Local weekly
  preview with planned meals, four food actions and six daily states. Missing days
  remain missing. Production App does not enable it; legacy routes preserved.
- Approved-only curated filters cut/bulk/vegan/high_protein/high_carb/keto.
  Free shows only current-account private user recipes; old relations retained.
- Scoped replacement arithmetic preview and occurrence/portion-aware shopping;
  canonical/portion/safety evidence is still required before application.
- 120 owner-review names (30 per meal) preserved unchanged. No ingredients, grams,
  instructions, UUID expansion or import. Evidence register remains preliminary.

## Latest completed local package (uncommitted)

- Versioned domain context: account, plan/goal revisions, local week/timezone,
  dated slot, recipe/portion/snapshot revisions and idempotency key.
- Pure `PROPOSE → PREVIEW → CONFIRM` simulation with explicit confirmation,
  account/version/content checks, exact replay no-op and changed-key-payload conflict.
  Future consumption and provisional active-week input fail closed.
- As-planned copies the exact snapshot; modified/extra requires actual payload.
  Skip and skip undo only append annotation events. Extra food leaves graph intact.
- Replacement confirmation changes only the simulated graph. Revision-bound shopping
  selection sees the new snapshot; pending proposals and diary actions do not alter
  it. Earlier consumed snapshots remain intact after later replacements.
- Edit/undo appends supersession/retraction history. Original events remain; stale
  history targets reject. Plan restoration is a fresh replacement with retained
  snapshots. No destructive deletion or silent resurrection.
- Contradictory content under the same snapshot/portion revision fails closed.
- Weekly action-preview UX explains separate consequences and keeps saving disabled.

**Simulation is not persistence.** `networkWritesEnabled: false`; local sequence
numbers are never authoritative server revisions. No writer, storage, RPC, transport
or real diary facts are created. Real server confirmation is not integrated. Synthetic read-model reconciliation
and optional preview integration are implemented below; this is not complete
end-to-end adaptive execution.

## Completed recovery/read-model package

- Pure adapter against synthetic inputs: account/calendar/timezone binding, session
  and request/attempt generations, late/foreign response rejection, current graph
  validation, preview invalidation on plan/goal revision changes. No new endpoint.
- Cross-read plan/snapshot/portion immutability and known-retired-revision rejection.
  Opaque revisions are not ordered by guessed numbers, timestamps or lexical order.
- Timeout remains UNKNOWN, neither success nor failure. New key/action is blocked
  while unresolved; explicit retry preserves original payload, expected revisions
  and idempotency key. A fresh-looking graph alone never proves mutation outcome.
- Accepted outcome requires matching fresh read identifiers/revisions; replacement
  also requires a new plan revision and exact confirmed slot snapshot. Old reads
  cannot overwrite the receipt constraint. Conflict requires refresh and new review.
- Unknown operations survive A→B→A in account-scoped memory quarantine and reattach
  under a fresh session. Another week/timezone keeps unresolved work blocked pending
  proper reconciliation. Foreign account view exposes neither payload nor outcome.
  Settled keys also remain account scoped. No restart persistence is claimed.
- Optional recovery input wired into existing Today weekly preview only. It checks
  account/date/week/timezone, plan/goal revisions and dated slot/recipe identity set.
  Loading/unknown/conflict/mismatch hide stale meal content/actions. No request or
  diary write controls enabled; App production routes do not supply this input.

## Verification

- Focused **47 PASS** (domain, recovery, weekly/Today SSR).
- Broad **153 files; 1161 tests; 1160 PASS; 0 failed; 1 skipped** (dedicated diary
  Supabase integration environment unavailable).
- Build **PASS**: TypeScript, Vite, Pages fallback.
- Lint **FAIL: 121 existing errors / 491 warnings; 0 added diagnostics** versus
  the preceding persistence package / committed weekly baseline. No mass cleanup.
- Diff/whitespace checks, empty index, 229 owner hashes and unchanged name dataset
  verified. Logs: `/tmp/potok-launch-audit-2026-09-18/recovery-{focused,tests,build,lint}.log`.
- Browser gap **NOT_TESTED_BROWSER / EXTERNAL_TOOL_UNAVAILABLE** retained.
  Previous discovery returned `[]`; not retried. SSR/reducer tests are not mobile QA.

## Parked dependencies / real checkpoints

- Canonical export: **OPEN_EXTERNAL_DEPENDENCY / PARKED**. No retry, invented UUID,
  service role, import or production catalog-readiness claim.
- Recipe atomic metadata: **PARKED**. No SQL/CLI retry. Earlier authorized metadata
  attempt unexpectedly initialized login role and failed HTTP 544; no metadata
  received and absence of side effects was not proven. Evidence remains in
  `reports/recipe-resolver-safety-checkpoint-2026-09-19.md`.
- Actual transport/persistence needs verified schema/read-model metadata and an
  approved authenticated atomic/idempotent endpoint contract, including server-owned
  revisions and history identity mapping. Exact storage remains undecided.
- Recipe ingredient expansion waits for owner review of the preserved 120-name list.
- Numerical adaptation/safety policy needs authoritative evidence review; deployment,
  import, payment and production activation are separately unauthorized.

## Remaining boundary / exact next safe task

The requested local recovery package is complete. Real port integration is blocked
on a reviewable authenticated server contract proving:

1. Freshness/successor ordering for previously unseen opaque graph revisions and
   races after an accepted mutation. Latest client request generation is not proof
   of server freshness; do not implement a client oracle.
2. Receipt provenance and account/entitlement enforcement; exact returned plan,
   goal, dated slot and recipe/portion snapshot identities.
3. Outcome lookup by original idempotency key/payload, including unknown results
   from another week/timezone or across reload; no fresh key on retry.
4. Authoritative history identities and atomic conflict/rollback semantics.

Exact next safe task: review a supplied read-only server protocol/schema artifact
against `docs/premium/plan-fact-persistence-domain-v1.md`, then add synthetic contract
fixtures matching verified behavior. Do not guess endpoint/storage or resume parked
metadata access. The owner checkpoint is for this real server contract, not repeated
approval of already accepted PLAN/FACT semantics. No broad write permission requested.

Browser/mobile QA remains a separate external gap; only resume when availability
changes. Canonical export, atomic metadata and recipe expansion remain parked.
MASTER PROMPT remains incomplete; no production activation or new commit performed.
