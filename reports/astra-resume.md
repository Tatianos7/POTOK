# POTOK resume — 2026-09-20

**POTOK_PREMIUM_ADAPTIVE_NUTRITION_V1_IN_PROGRESS. NOT LAUNCH READY.**

## HEAD / authorization

- Worktree: `/Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation`.
- Branch master; HEAD `4c441dbd35e1feab674009d180ba1fbd56798fa1`.
- Local commits not pushed: `4fed6b3` (approved 27 files), `4c441db` (approved 24 files).
- Current Adaptive Nutrition package: **29 UNCOMMITTED paths**; index empty.
  Exact list: `docs/premium/adaptive-nutrition-v1.md` → Exact uncommitted package.
  Earlier local changes preserved; no authorization for another commit inferred.
- NO PUSH / DEPLOY / SQL / DB / RLS writes / payment integration / real import.
- All 229 original owner file hashes unchanged. Manifest:
  `/tmp/potok-launch-audit-2026-09-18/baseline.json`.

## Active contract

Owner's **Premium Nutrition / Adaptive Plan Contract v1** supersedes fixed 14-day
nutrition as the target. Active calendar week is Monday–Sunday; next week is
provisional. Preserve legacy IDs/routes/history until explicit compatibility work.
Plan is not fact; all changes require explicit confirmation. No new Goal formula,
clinical bounds, calorie cycling, automatic compensation or sensitive persistence.
Map/status: `docs/premium/adaptive-nutrition-v1.md`.

## Completed this local package

- Added compatible Goal/training/preferences/safety/cycle domain types around
  existing UserGoal and Premium catalog; no new store or competing service.
- Advanced macro **math preview** supports grams and g/kg, computes residual carbs,
  rejects negative energy/invalid inputs; cannot activate or clinically approve goals.
- Existing Premium adapter projects dated catalog days into seven active and
  seven provisional dates. Missing seed days remain missing; source IDs and day
  numbers preserved; incomplete content never borrows demo data.
- Confirmation intents and daily review distinguish actual diary coverage from
  planned intake; no automatic next-day deduction, goal update or diary write.
- Approved-only curated multi-tag filter contract and explicit ingredient density
  conversion; unknown ml density never becomes 1 g/ml.
- Active-week shopping preview counts each selected slot/portion, handles changed
  compositions, separates raw/cooked states, rejects incomplete canonical amounts.
- Free Recipes no longer offers a general Collection tab; current-account private
  recipes/favorites remain, old relations/history preserved. Immediate visibility
  filter hides stale foreign-account content. Not proof of server RLS.
- 120 unique owner-review names, 30 per meal, no UUIDs/nutrients/ingredient expansion:
  `docs/premium/recipe-names-owner-review-v1.md` and
  `data/recipes/premium-name-candidates-v1.json`.
- Preliminary evidence register: `docs/premium/nutrition-safety-evidence-v1.md`.
  NIDDK page read; IOC/ISSN full text not retrieved. No clinical policy approved.

## Latest completed safe package

- Integrated legacy/catalog Today view models into the dated rolling-week adapter;
  kept existing source IDs, day numbers and old routes. No return to fixed-14-day
  nutrition as the new product contract.
- Added local weekly UI: active Monday–Sunday dates, planned meals, honest missing
  days, next-week provisional explanation, clear PLAN != FACT. Today accepts an
  explicit preview input; development-only `?weeklyPreview=demo` labels unvalidated
  legacy demo meals. Existing production App routes do not activate weekly preview.
- All four food actions are in-memory confirmation intents, not completed facts.
  Save is disabled; no persistence callback/storage/network. Future food cannot be
  confirmed. Account/plan/goal version/week/date changes reset local context;
  stale/foreign/provisional-as-active inputs are rejected.
- Six daily states match the contract exactly: normal, no_time, tired, hungry,
  training_day, rest_day. Context/help text only; no calorie or compensation writes.
- Six primary catalog filters: cut, bulk, vegan, high_protein, high_carb, keto.
  Earlier unpersisted spellings have explicit aliases; private recipes cannot opt in.
- Added scoped replacement arithmetic preview: reviewed recipe/batch/portion
  evidence, exact dated original slot, all macro deltas and complete day/week totals.
  Missing/duplicate evidence, stale scope, incomplete totals and overflow fail closed.
  Originals remain unchanged. Application always blocked by restriction/allergen
  review, reviewed portion/safety policy and persistence contract. Shopping does not
  consume a merely proposed replacement automatically.

Production adaptive UI, goal changes, facts and plan persistence remain disabled.
120-name owner-review dataset preserved; no ingredient expansion or canonical IDs.

## Tests / build

- Focused: **84 passed** (week adapter/UI SSR/reducer, adaptation, replacement,
  shopping and existing Today route behavior).
- Broad: **149 files; 1117 tests; 1116 passed; 0 failed; 1 skipped**.
  Skipped diary integration requires dedicated Supabase test environment.
- Build **PASS** (TypeScript, Vite, Pages fallback).
- Lint **FAIL: 121 existing errors / 491 warnings**; **0 added diagnostics** versus
  preceding Adaptive package (and last committed package). No mass cleanup.
- Whitespace, empty index and all 229 owner fingerprints checked.
- Browser: **NOT_TESTED_BROWSER / EXTERNAL_TOOL_UNAVAILABLE**. Runtime bootstrap
  succeeded, default selection reported "No browser is available", discovery
  returned `[]` on 2026-09-20. No fallback browser, app session or staging access.
  React SSR and pure interaction reducer tests passed; no mobile visual QA claimed.
- Logs: `/tmp/potok-launch-audit-2026-09-18/weekly-{focused,tests,build,lint}.log`.

## Parked dependencies / checkpoints

- **Canonical export: OPEN_EXTERNAL_DEPENDENCY / PARKED.** No retry, invented
  UUIDs, service role, production catalog claim or import. Existing four canonical
  candidates remain rejected; new 120-name list is content-review only.
- **Recipe atomic-save metadata: PARKED.** Do not retry CLI. Prior authorized
  metadata-only attempt unexpectedly initialized login role and failed HTTP 544;
  no metadata received; absence of side effects was not proven. Exact evidence and
  approved SQL hash retained in `reports/recipe-resolver-safety-checkpoint-2026-09-19.md`.
- Clinical thresholds/formula activation need authoritative evidence and explicit
  review. DB/schema/RLS/persistence, fact-write endpoint, payment/import/deploy
  require separate concrete checkpoints. No broad approval inferred.
- **Actual content checkpoint:** owner reviews the 120-name list before ingredients,
  grams and instructions are expanded. Approval is not permission to import.

## Actual next functional owner checkpoint

Before enabling persistence or production weekly plan, confirm a versioned contract:

1. Authoritative account-bound plan assignment with local-calendar anchor/timezone,
   plan revision, goal revision and recipe/portion snapshot revision. A client demo
   key is not an authoritative concurrency token.
2. Meal actions: explicit reviewed food/portion/date payload; did-not-eat is a plan
   annotation, not a zero-valued consumed meal; extra food does not silently deduct
   future intake. Define edit/undo/history behavior without deleting existing facts.
3. Atomic/idempotent server boundary validating current account/entitlement and
   expected revisions; concurrent or stale requests reject; failure leaves both
   plan graph and diary unchanged. Client preview cannot assert server permission.
4. Confirmed replacements and shopping use the same approved graph/portion revision.
   Reviewed restrictions, canonical nutrition and portion/safety policy are required
   before labeling replacements safe or activating numerical adaptation.

This is a contract/review checkpoint, not permission to apply SQL, test writes,
activate production, use service role or revisit parked metadata access. Exact DB
patch cannot be finalized from missing live schema evidence.

## Exact next safe task

Resume the 29-path package, not a fresh audit. Browser discovery is currently empty;
do not repeat discovery until the environment changes. Once connected, verify the isolated weekly preview at mobile widths and exercise its
four actions, date navigation, six states and account/version resets without
connecting to staging or writing diary data. Current SSR/reducer coverage does not
replace this check. Otherwise preserve the browser gap and review the persistence
contract above with the owner before functional save integration. Name-list approval
is independently required before recipe ingredient expansion. No new numerical
policy, new commit, DB access or activation is authorized by this handoff.

MASTER PROMPT remains incomplete; canonical export and atomic metadata remain parked.
