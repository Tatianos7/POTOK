# Inactive deterministic week proposal search

`searchGenerationWeekRawV1` assembles a week from an explicitly ordered pool of day alternatives. It reuses `validateWeekSnapshotRawV2` for every visited full combination, so meal, day and cross-day rules retain one implementation. It does not claim to be the complete generator.

Input is duplicate-aware raw JSON with exactly `contract: potok-generation-week-search-v1`, `weekHeader`, `dayOptions`, and `maxEvaluations`. The header is the existing V2 week validator input without `days`; all policy bodies, revisions, fallback proof and identity fields must already be supplied. There are exactly seven ordered day pools, each with 1–16 existing day validation DTOs. Each raw source is limited to eight million UTF-16 code units. The explicit evaluation budget is an integer from 1 to 1024. This is a computation limit, not a nutrition policy.

Traversal preserves the supplied preference order, with the final day varying fastest. It returns the first feasible combination, not a global optimum. No random IDs, changed portions, synthesized fallback proof, altered constraints or inferred nutrition are introduced. A future provider must supply reviewed portions and pinned day alternatives; this function does not establish their provenance or preference ranking. Malformed visited data aborts instead of becoming an unsuitable meal. Unvisited alternatives are not validated or certified.

| Result | Meaning |
| --- | --- |
| `FEASIBLE_PROPOSAL` | Real domain validator returned VALID or VALID_WITH_WARNINGS; warnings and the exact evaluated JSON are retained. |
| `SEARCH_LIMIT_REACHED` | More combinations remain. No conclusion about feasibility. |
| `BLOCKED_MISSING_EVIDENCE` | The supplied pool was exhausted and at least one combination lacked evidence. |
| `NO_FEASIBLE_WEEK_IN_POOL` | Every combination in this finite supplied pool failed domain validation without missing evidence. No conclusion about other pools or the real catalog. |

Every result includes evaluated and total combination counts. Feasible results additionally include zero-based chosen option indexes and the actual validator result. Outputs are recursively frozen. Raw input is parsed into owned data before asynchronous validation.

This is an internal, unconnected proposal building block. Its domain result is **not** trusted acceptance, an ACTIVE plan, a source receipt, an entitlement check or a consumption fact. The trusted validator/authority loader and publication admission still independently apply downstream. No Edge, browser, database, payment, deployment or generator activation path is added. Graph V1 is unchanged; current V2 Monday week semantics are retained pending the product's rolling-week reconciliation.

Validation covers deterministic selection, backtracking, cross-day repeat rejection, exact budget boundaries, explicit missing evidence, retained warnings, malformed provenance, dates/goals, duplicate keys, ownership and resource bounds. Fixtures contain synthetic food only. The test helper extraction returns the exact previous validator input; existing trusted validator cases remain in the same CI step.

Before live generation: provide the real approved recipe catalog and measured yields, authoritative distribution/portion/optimization/generation policies, reviewed ordinary fallback proof, a provider constructing alternatives from those pinned sources, the Graph V2 proposal projection and its trusted receipts, and the separately authorized activation path. A single pilot recipe cannot be stretched into a legitimate diverse week by relaxing repeat caps.
