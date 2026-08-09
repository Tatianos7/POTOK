# Missing Food Owner Apply DB/RPC Draft Review

- Timestamp: 2026-08-09T00:00:00Z
- Reviewed SQL: `supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql`
- Reviewed report: `reports/missing-food-owner-apply-db-draft-2026-08-09.md`
- Basis: `reports/missing-food-owner-approved-food-creation-design-2026-08-09.md`
- Verdict: **MISSING_FOOD_OWNER_APPLY_DB_APPLY_READY**

## Safety

- Review/report only.
- Migration was not applied.
- RPC was not called.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No foods were created.
- No aliases were added.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No import/backfill/recompute was run.
- No PR was created.

## Review Result

No blocking findings were found.

The draft is apply-ready as an RPC-install migration, subject to the normal owner apply package:

- run exact pre-check;
- apply the draft SQL only after explicit owner approval;
- run exact post-check;
- confirm counts unchanged after migration apply only;
- do not call the RPC until a separate owner-approved draft id is selected.

## SQL/RPC Contract Review

The draft creates/replaces one RPC:

- `public.apply_owner_approved_missing_food_draft(p_draft_id uuid)`

Migration apply behavior:

- creates/replaces the function;
- sets function comment/grants;
- inserts no `foods`;
- inserts no `food_aliases`;
- updates no draft rows;
- creates no trigger;
- runs no import/backfill/recompute.

RPC call behavior:

- can insert exactly one `public.foods` row on success;
- marks exactly the selected `food_missing_food_drafts` row as `applied`;
- returns a result row with `result`, `food_id`, and `error`.

This matches the intended owner-approved path:

```text
ready_for_owner_apply draft -> explicit owner-approved RPC call -> one core food -> draft applied
```

## Admin Gate

Admin gate is correct for current production identity:

```sql
from public.user_profiles
where id_user = v_admin_id
  and is_admin = true
```

Other security properties:

- `security definer` is used;
- `search_path = public, pg_temp` is set;
- `revoke all ... from public` is present;
- execute is granted only to `authenticated`;
- unauthenticated/non-admin callers return `permission_denied`.

Owner approval remains a process gate before any RPC call. The DB gate enforces authenticated admin access.

## Draft Validation

The RPC validates the selected draft before any insert:

- draft row exists;
- row is locked `for update`;
- `status = 'ready_for_owner_apply'`;
- `applied_food_id is null`;
- `applied_by is null`;
- `applied_at is null`;
- linked review row exists;
- linked review `classification = 'missing_canonical_food'`;
- linked review `status = 'approved_for_food_draft'`.

This blocks repeat calls, premature drafts, rejected/research drafts, and drafts not backed by an approved Missing Food Review row.

## Food Shape Validation

The RPC validates MVP food shape:

- `source = 'core'`;
- `unit = 'g'`;
- `brand is null`;
- `barcode is null`;
- `name` non-blank;
- `normalized_name` non-blank;
- `category` non-blank;
- `data_source` non-blank;
- `normalized_name = public.normalize_food_text(name)`;
- calories/protein/fat/carbs are present;
- calories/protein/fat/carbs are non-negative;
- nullable fiber is either null or non-negative;
- numeric `NaN` is rejected.

The draft table constraints already limit macro upper bounds. The RPC repeats the high-risk required/non-negative checks, which is sufficient for this apply draft.

## Duplicate Guard

The duplicate guard checks existing `public.foods` by:

- exact `normalized_name`;
- normalized current `name`;
- shared source `core`/`brand`;
- empty/null normalized brand conflict shape.

This is conservative and safe. It blocks:

- existing shared canonical foods with the same normalized name;
- likely unique-index conflicts for empty-brand normalized names;
- repeated owner applies that would collide at insert time.

The insert also catches `unique_violation` and returns `duplicate_food`, so the race condition between duplicate check and insert is handled transactionally.

## Food Insert Review

Successful call inserts one row into `public.foods`.

Expected inserted values:

- generated `id`;
- `name = trim(draft.name)`;
- draft calories/protein/fat/carbs/fiber;
- `unit = 'g'`;
- `category = trim(draft.category)`;
- `source = 'core'`;
- `created_by_user_id = null`;
- `canonical_food_id = inserted id`;
- `normalized_name = draft.normalized_name`;
- `normalized_brand = null`;
- `nutrition_version = 1`;
- `verified = true`;
- `suspicious = false`;
- `confidence_score = 1`;
- `source_version` includes draft id and `data_source`;
- empty allergens/intolerances/aliases arrays;
- `auto_filled = false`;
- `popularity = 0`.

No `stable_food_id` is assigned. That is consistent with the draft report because stable-id semantics are deferred.

## Canonical Self-Root

The RPC sets:

```sql
canonical_food_id = v_food_id
```

This satisfies the self-root requirement even if the existing `foods` trigger is absent or changes later.

The post-check requires:

```sql
canonical_food_id = id
```

## Draft Applied State

After successful insert, the RPC updates only the selected draft:

- `status = 'applied'`;
- `applied_food_id = v_food_id`;
- `applied_by = v_admin_id`;
- `applied_at = now()`;
- metadata receives owner apply markers.

The draft update happens in the same PL/pgSQL exception block as the insert. If insert/update fails inside that block, the subtransaction rolls back and the function returns a non-applied result.

## Alias / Automation Review

Confirmed:

- no `insert into public.food_aliases`;
- no `update public.food_aliases`;
- no `delete from public.food_aliases`;
- no call to `public.apply_admin_approved_food_alias`;
- no trigger is created from `food_missing_food_drafts`;
- no import/backfill/recompute path is present;
- diary/favorites/recipes are not referenced or mutated.

Alias follow-up remains separate through Admin-approved Alias Apply.

## Pre/Post Validation Review

The draft report includes:

- combined pre-check SQL;
- baseline counts SQL;
- combined post-check SQL;
- post-apply-only expected unchanged counts;
- draft-id-specific future RPC call pre-check;
- future RPC call post-check;
- rollback notes;
- stop conditions.

The validation plan is sufficient for installing the RPC. The future owner apply package should additionally make the exact owner-approved draft id explicit and capture pre-call counts immediately before the RPC call.

## Rollback / Stop Conditions

Rollback notes are adequate:

- function-only rollback is provided for migration apply before any successful RPC call;
- data rollback after a successful food creation is explicitly treated as a separate Food Core data remediation;
- cleanup is blocked if diary/favorite/recipe rows or aliases reference the inserted food.

Stop conditions are appropriate:

- stop on non-`master`;
- stop on failed pre-check;
- stop if required tables/functions/columns are missing;
- stop if nullable fiber semantics cannot be preserved;
- stop if owner approval is not explicit;
- stop future RPC calls on draft/review/duplicate/count failures.

## Residual Checks For Owner Package

These are not blockers for the RPC-install draft, but should remain explicit in the owner package:

- verify `gen_random_uuid()` is available;
- verify production `foods.fiber` accepts `null` before calling the RPC with a null-fiber draft;
- verify `foods.source_version` exists if provenance is copied there;
- verify current `foods_normalized_unique` behavior before the first real call;
- confirm exact owner-approved `draft_id`;
- capture counts immediately before and after the RPC call.

## Deferred

- Owner apply package for installing the RPC.
- Production post-apply status for RPC installation.
- First owner-approved food creation package/call.
- Production smoke for one reviewed food creation.
- Post-food-creation Alias Apply follow-up.
- Stable food id policy.
- Dedicated audit table for owner food creation attempts.

## Final Recommendation

The owner-approved Missing Food apply DB/RPC draft is ready for owner apply packaging. Apply the migration only after explicit owner approval, then validate that installing the RPC changed no counts. Do not call the RPC until a separate owner-approved draft id and call package are prepared.
