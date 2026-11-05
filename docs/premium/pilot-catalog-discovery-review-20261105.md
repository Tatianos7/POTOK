# Bounded shared-catalog discovery after exact lookup

Draft PR337 exact head `5314fe0e38731798a55e7c5de0c8355a80bf7fd9`
passed both GitHub workflows. This stage extends its private observations with
explicit name-family discovery. It does not change the exact resolver, issue
evidence, assign identities, create aliases or repair catalog rows.

Fresh SELECT-only reads restricted to shared core/brand foods without a creator
captured 299 discovery rows in Staging and 224 in Production. The query searches
explicit Russian/English name families, including е/ё variants of salmon. It is
not an exhaustive search of all possible names, brands or catalog identities.

An explicit private reviewer plan covers every unmatched ingredient row from
the prior exact report, with candidate stable keys, excluded variants, expected
state labels and remaining attributes. Its byte hashes bind both observations.
This plan is a work queue, not source authority or approval. The script rejects
missing/duplicate/foreign target rows, cross-environment inputs, private rows,
duplicate UUIDs, promoted/bound prior reports, invalid dispositions and changed
input bytes. Multiple rows for a stable key remain multiple observations.

| Observation | Staging | Production |
| --- | ---: | ---: |
| Prior exact-lookup misses reviewed | 41 | 53 |
| Rows with potential discovery observations | 31 | 25 |
| Rows without potential observations in this capture | 10 | 28 |
| Distinct potential catalog candidates | 25 | 23 |
| Applied bindings / admitted recipes | 0 / 0 | 0 / 0 |

These coverage numbers include candidates with unknown/conflicting attributes;
they are not counts of resolved, source-approved or runtime-eligible ingredients.
All potential candidates have missing fiber and unknown review/search flags.
Catalog nutrient values are retained, never replaced with the input-source vector.

Useful discoveries include generic fresh banana/pear/apple, raw chicken breast,
dried long-grain rice, walnut/almond, lemon juice, bulgur and raw rainbow trout.
Generic labels still do not establish skin/bones, edible portions, grain size,
white-and-long-grain identity, farmed origin, fillet, drained solids or additives.

No qualifying discovery was selected for exact 2% milk, plain unsweetened Greek
2% yogurt, prepared shelled edamame, whole brown lentils or 100% whole common-wheat
pasta in the captured scope. Different milk fat percentages, mature soy, red/green
lentils and spelt pasta are retained as exclusions or unresolved variant questions,
not substitutions. Previously accepted yogurt/state choices remain unchanged.

Important state conflicts: some catalog rows named steamed/grilled chicken or
salmon carry `raw`. They remain visible as rejected variants with a specific
name/state conflict. Tuna in its own juice carries `raw` despite the required
canned/drained input, so it remains a candidate requiring review. Fresh mushrooms,
cinnamon and breadcrumbs have unknown state labels. A matching state label is
only an observation and never state equivalence or source proof.

Production lacks the selected raw chicken/olive-oil stable-key observations found
in Staging within this capture. No environment is synchronized or repaired here.
Privileged shared-catalog reads do not prove ordinary-account RLS access.

Private snapshots, row-level plans/results and recipe data stay outside public
GitHub. The offline CLI consumes the prior exact report, discovery snapshot and
explicit plan. Proposed canonical/stable IDs remain null; promotion flags stay
false, and the runtime authority decoder rejects the result. PLAN != FACT.

Next: use the existing retained primary-source and evidence contracts to prepare
concrete repair/binding proposals for the potential candidate groups, preserving
state/variant unknowns and the five uncovered ingredient families. Do not promote
name matches, copy a different source vector onto existing catalog identities,
create replacement foods or mutate flags without a separately reviewed package.
Cooking/yield/portion measurements remain deferred to owner prelaunch testing.
