# Syrniki Owner Apply Production Final Status

- Timestamp: 2026-08-12T00:00:00Z
- Draft correction package: `reports/missing-food-draft-correct-syrniki-owner-package-2026-08-10.md`
- Prior cleanup status: `reports/missing-food-owner-apply-smoke-food-cleanup-applied-final-status-2026-08-10.md`
- Apply path: production app UI `/admin/missing-food-review` -> `Owner apply food`
- Verdict: **SYRNIKI_OWNER_APPLY_PRODUCTION_PASS**

## Safety

- This is a final production status report only.
- Owner manually applied the corrected draft from an authenticated app session.
- Production DB schema was not changed by Codex.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- RPC was not called by Codex.
- No additional foods were created by Codex.
- No aliases were added by Codex.
- Alias Apply was not called by Codex.
- No import/backfill/recompute was run.
- No PR was created.

## Apply Result

Owner production apply passed for the corrected real product:

- product: `Сырники`;
- source: `core`;
- category: `desserts`;
- apply timestamp: `2026-08-12 17:46:06 UTC`.

## Draft State

Applied draft:

| Field | Value |
| --- | --- |
| `draft_id` | `b65055c5-1283-46fd-ba69-de7f395eae88` |
| `draft_name` | `Сырники` |
| `draft_normalized_name` | `сырники` |
| `draft_status` | `applied` |
| `applied_food_id` | `d3342e36-ed0c-4244-9e61-8a2c4a148836` |
| `applied_by` | filled |
| `applied_at` | `2026-08-12 17:46:06 UTC` |

Confirmed:

- draft was marked `applied`;
- `applied_food_id` points to the created food;
- `applied_by` is filled;
- `applied_at` is filled.

## Created Food

Created production food:

| Field | Value |
| --- | --- |
| `food_id` | `d3342e36-ed0c-4244-9e61-8a2c4a148836` |
| `name` | `Сырники` |
| `normalized_name` | `сырники` |
| `category` | `desserts` |
| `source` | `core` |
| `calories` | 220 |
| `protein` | 14 |
| `fat` | 8 |
| `carbs` | 23 |
| `fiber` | `null` |
| `canonical_food_id` | self-root |

Confirmed:

- exactly one real corrected `core` food was created;
- `canonical_food_id` is self-root;
- nullable fiber was preserved as `null`.

## Counts

Production counts after apply:

| Table | Count |
| --- | ---: |
| `foods` | 2267 |
| `food_aliases` | 2890 |
| `food_alias_apply_audit` | 0 |
| `food_missing_food_drafts` | 1 |

Expected effect:

- `foods` increased by exactly `+1` from the post-cleanup baseline;
- `food_aliases` stayed unchanged;
- `food_alias_apply_audit` stayed `0`;
- `food_missing_food_drafts` stayed `1`.

## Confirmed Boundaries

Owner production apply confirmed:

- real corrected food `Сырники` was created;
- draft was marked `applied`;
- no extra foods were created;
- no aliases were created;
- `food_aliases` unchanged;
- Alias Apply was not called;
- `food_alias_apply_audit` stayed `0`;
- Codex did not call RPC;
- Codex did not run import/backfill/recompute.

## Current Status

The real product `Сырники` now exists in Food Core as a reviewed `core` food. The earlier smoke-created food `Сырники ки` remains deleted, and the corrected draft now points to the real applied food.

## Deferred

- Post-food-creation alias follow-up only if a specific reviewed query is a safe alias candidate.
- Any alias must go through Admin-approved Alias Apply.
- No automatic alias should be created from this food apply.
- Future nutrition/provenance refinements should use a separate reviewed package.

## Final Status

Syrniki owner apply production status is pass. The corrected draft produced exactly one real `core` food, marked the draft applied, preserved aliases/audit, and did not create any extra foods or aliases.
