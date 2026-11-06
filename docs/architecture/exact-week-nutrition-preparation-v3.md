# Exact portion, meal, day and week input preparation V3

Status: unmounted conditional PLAN-input arithmetic. **Not Graph V3, published
menu, nutrition-goal/safety validation, Premium authorization or diary FACT.**

## Independently pinned complete request

The weekly request binds account and selection IDs, timezone, local Monday week,
seven consecutive civil dates and the complete ordered meal/component schedule.
This follows the current Graph weekly-anchor convention. Calendar arithmetic uses
civil date offsets, not 24-hour instant increments across DST. The timezone is
validated and retained; no live clock or UTC-to-local meal time is inferred.

Each unique local recipe key binds both its independently selected exact typed
recipe request digest and expected prepared snapshot digest. Recipe keys are
local references, not minted canonical recipe IDs. Selected keys must all be used;
missing/extra/duplicate refs, duplicated artifact digests, foreign/dangling keys,
missing days/meals, duplicate slot/component IDs and unknown meal types reject.
Repeated meal types with distinct slots are allowed; meal eligibility and balance
remain separately validated product rules.

| Portion kind | Exact multiplier | Missing declared servings |
| --- | --- | --- |
| FRACTION_OF_WHOLE | Supplied positive rational (including explicit whole-recipe multiples) | Does not require declared servings |
| DECLARED_SERVINGS | Supplied serving amount / source declared servings | Blocks, no inferred default |

These are conditional input shares, not physical portion approval. Gram-based
cooked-serving assignment, measured yield, discrete food rounding, portion limits
and retention factors are not inferred.

## Source and calculation boundary

All source contexts are owned before the first await. Every selected recipe is
re-prepared through the existing exact typed V3 Food/water/salt boundary, which
checks canonical/Nonfood revisions, original receipts, retained sources, complete
histories, current heads/state and event-time authorization. Both request and
snapshot digest must match. Any unavailable, changed, stale, invalidated or
unauthorized ingredient blocks the entire week, without partial totals.

A private invocation-only map reuses that owned verified source for repeated
placements. There is no process cache, cross-user reuse or skipped source read in
a subsequent invocation. Snapshot readback repeats source/authority validation
and recomputes the complete output. The caller must supply fresh atomic complete
trusted contexts; a hidden invalidation cannot be detected from a hash. A later
write/activation still needs the established transactional currentness gate.

The existing rational V2 operations scale each ingredient quantity and nutrient
contribution, each whole-recipe total and each declared-serving fraction. The
portion total must equal the sum of its projected ingredients. Meal, day and week
totals are exact sums; no decimal rounding or residual allocation occurs.
Recorded grams remain grams and millilitres remain millilitres. Water volume does
not become mass. Every container separates known input mass from nullable total
input mass and scoped unknown items (slot/component/row). These are planned input
quantities, not measured cooked mass, shopping-list identity merging or consumption.

Results have `authority: NONE`, `purpose: CONDITIONAL_PLAN_INPUT_ARITHMETIC` and an
empty immutable facts array. Source recipe references preserve authoring IDs/
revisions and exact source digests. Readback rejects altered ingredients, portions,
meal/day/week totals, mass, source refs, authority or facts even if an output hash
is recomputed, because it regenerates the complete snapshot from the independent
request and trusted source contexts.

## Representation and resource limits

Separate request/snapshot contracts, encoding and domain-separated SHA256 preserve
older Graph/recipe behavior. The only recipe V3 change exports its existing context
ownership helper; its internal preparation calls the same function. No old decoder
is widened. Default canonical JSON still rejects number payloads; all quantities
are canonical reduced rational strings.

Limits: 64 selected recipes, exactly seven days, 1..8 meals/day, 1..8 recipe
components/meal, 128 total recipe placements, 1024 projected ingredient rows and
262144 UTF8 bytes for both request/output. The shared duplicate-aware bounded raw
parser retains depth 12, safe-number and negative-zero rejection. Excess/budget
failure yields BLOCKED, never truncated or partial output. These limits are bounded
code behavior, not hosted CPU/memory or worst-case real-catalog acceptance.

## Remaining gates

Account/selection pins prevent numeric context substitution under an independent
trusted pin; they do not authenticate a client or prove Premium. Recipe source,
portion, allergen, dietary, eligibility/publication, goal/policy acceptance,
optimization, actual atomic store/issuer, SQL persistence and readback/activation
integration remain separate. This change does not issue real source approvals or
admit the 19 real pilot recipes. Source/owner decisions and cooking deferral stay
unchanged. No Supabase operation, new service, migration, merge, deploy, runtime
binding, diary/FACT write or generator activation occurs.

Parent #345 `02f1faf4c1a9f5e1c5c873b0311d098fc01faddd` passed PR checks and
PostgreSQL admission. Its Edge full-worker gate failed (run42156155530); known
TLS/peer-DER and execution-placement constraints remain, with no security bypass.
Next integrate this arithmetic into separately versioned exact Graph and trusted
validator/storage/readback under the existing authorization/publication model.
