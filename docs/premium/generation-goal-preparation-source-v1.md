# Current-goal preparation source

The inactive `createGoalDerivedGenerationPreparationSourceV1(sql)` implements the existing menu candidate source port without a supplied metadata/profile/revision fixture. It uses one fixed private SQL reader to obtain current admitted preparation context and the matching saved goal type. No storage metadata row, new table or writer is needed. The source can be passed to the existing admitted worker as `source`; warning, decision and final independent authority ports remain separate and mandatory.

The SQL candidate requires installed PR267 storage and PR268 preparation context reader. It does not require PR269 metadata storage. Its SECURITY DEFINER boundary stays in the private schema, rejects app roles/owner sessions/SET ROLE, pins existing gate/context function definitions, and grants only its exact EXECUTE signature to the existing NOLOGIN reader. It does not grant SELECT on user_goals. The nested context reader holds the shared account gate and rechecks current Premium/request/selection/goal revision, policy/manifest/authority heads and input receipt revocation. The goal lookup is constrained by that account and goal revision. Unsupported or null goal types remain unavailable.

Exact supported saved values:

| Saved goal type | Profile |
| --- | --- |
| Похудение, weight-loss, WEIGHT_LOSS | WEIGHT_LOSS |
| Поддержка формы, maintain, MAINTENANCE | MAINTENANCE |
| Набор массы, gain, MASS_GAIN | MASS_GAIN |
| CUT | CUT |

The Russian values and three form keys match the current GoalResult write path. No calorie-based inference, fuzzy matching or default maintenance profile is used. Other historical labels need an explicit reviewed mapping; they are not silently normalized.

For each independently decoded required slot, a UUIDv8 output revision is derived from SHA-256 of canonical JSON containing domain `potok-generation-meal-snapshot-revision-v1`, request ID, generation input digest and slot ID. The version/variant bits are set on the first 128 hash bits. This is a stable output identifier, not nutrition/review/publication evidence. Same immutable request/input/slot yields the same revision; a different request/input/slot uses a different hash namespace. No servings, grams, nutritional facts or reviewer IDs are allocated here.

Native PostgreSQL CI exercises the actual reader SQL and TypeScript source through real candidate preparation, privilege denial, currentness/revocation, missing inputs/goal values, stable output and installer rollback on prerequisite drift. Rows are synthetic and confined to the disposable database. Unit tests additionally reject source/lookup/byte substitution and duplicate/extra fields.

The SQL file is an unapplied candidate. Staging installation is a separate approval step. This removes the supplied metadata dependency; it does not publish a real recipe catalog, produce warning metrics or optimization traces, install source extensions, mount the gateway/route, activate the generator or prove live end-to-end readiness. Cooking remains deferred. PLAN != FACT.
