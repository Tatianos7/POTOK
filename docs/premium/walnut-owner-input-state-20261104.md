# Walnut owner input-state decision — 2026-11-04

Continues #319 at `58edcca4777e80533c3b5dd6bc4fa9e4947cf4fd`.
The owner answered the specific walnut question: use raw shelled walnut kernels
without salt or additives in **oatmeal with pear and walnut**. This confirms the
recipe's intended authoring input only. It does not apply to other recipes/nuts,
prove actual product composition, approve a nutrition source or authorize publication.

The clarification scope is: retain this decision, make its conditional 30 g input
arithmetic explicit, and test row/context/quantity and publication boundaries.
Affected paths are the retained owner-state JSON, existing offline review builder
and its test, and this document. No application or database path is changed.

## Versioned overlay, original data preserved

`retained-sources/three-food-applicability-20261104/walnut-owner-input-state-v1.json`
binds the exact original ingredient row, full recipe context and private catalog.
Processing is RAW; edible form is SHELLED_KERNELS; salt/additives are absent.
Its kind/scope records an owner authoring decision, not source/mapping admission.
All approval/apply/publication/activation flags stay false.

The existing #319 default function/CLI and original review annotations remain
unchanged: they still reproduce the original text's unspecified processing.
An explicit `--owner-walnut-state-v1` mode produces a **new output contract**,
`potok-three-food-owner-input-state-result-v1`, with the owner-state digest,
original review-result digest and original declared alignment preserved. Berry
rows remain byte-for-byte equal to the original review results. Original catalog,
recipe text, reference totals, history and PLAN/FACT are untouched.

```sh
node --import tsx scripts/contracts/three-food-applicability-review-v1.ts PRIVATE_INPUT.json ORIGINAL_PRIVATE_CATALOG.json --owner-walnut-state-v1 > private-owner-state-review.json
```

The CLI uses only local pinned input. Exported seams remain for trusted offline
composition/tests, not arbitrary authority assertions. Wrong target/context,
broadened scope, roasted/in-shell/salted variants or extra approval fields reject.

## Conditional walnut input, not a finished recipe

For the existing **30 g recorded authoring reference**, #318's complete source
candidate yields exact conditional arithmetic:

| kcal | Protein g | Fat g | Candidate available carbohydrate g | Fiber g |
| ---: | ---: | ---: | ---: | ---: |
| 196.20000000 | 4.56900000 | 19.56300000 | 2.10300000 | 2.01000000 |

This closes the unanswered intended-input choice, not primary-source applicability,
food-specific mapping or canonical identity. The numbers are explicitly conditional
on the source candidate, not measured/approved nutrient facts. Source calories
are preserved; no cooking retention, serving/yield or recipe/day/week total is
invented. ML/pieces or unknown/zero mass stay blocked even after this decision.
Before available carbohydrate and its delta remain null. Source/selection/owner
publication decisions remain false/null; the authoring-state choice is separate.

## Checks and remaining boundary

Local PASS: 42 tests (four new owner-state regressions plus previous source/draft/review
tests), strict standalone TypeScript, ESLint, both private CLI modes and original checksums.
The default legacy CLI result is byte-for-byte equal to the prior private replay.
The existing CI step already checks this builder and test; no CI permission or
workflow change is needed. See the Draft PR for final counts and exact CI status.
Tests cover exact arithmetic, unchanged legacy/berry outputs, wrong recipe/hash/
scope/state, attempted approval, quantity blocks and runtime decoder rejection.

The original private catalog hash remains
`517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0`.
No private recipe bodies or raw notes are committed. Cooking/portion/yield tests
stay deferred to owner prelaunch app testing; generic-tvorog, milk/piece mass and
other recipe decisions are unaffected. No Production/Supabase access, grant/RLS/
migration, runtime admission, app integration, release change, deployment, worker
activation or merge. Next is the still-separate source/mapping review and catalog
admission work; this clarification does not grant it automatically.
