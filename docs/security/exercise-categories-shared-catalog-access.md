# Exercise Categories Shared Catalog Access

## Verdict

`public.exercise_categories` should be treated as a shared read-only catalog.

It is not user-owned data.
It does not need client write access.
It does not need anon access for the current app flows.

## Why disable RLS here

The previous posture used an RLS read policy that was effectively `USING (true)`.

That shape is not adding meaningful protection because:

- every allowed caller sees the same rows
- ownership checks are not part of this table's model
- the real boundary is role-based access, not row filtering

For a shared catalog, `disable RLS + narrow grants` is safer and simpler than
keeping permissive RLS:

- no always-true policy remains
- access is explicit at the grant layer
- client writes stay blocked
- the mental model is clearer for future schema maintenance

## Effective access after the fix

- `authenticated`: `select`
- `anon`: no access
- `public`: no access
- client `insert/update/delete`: no access

## Why anon access is not required

Current usage is in authenticated workout flows:

- `src/services/exerciseService.ts`
- `src/pages/Workouts.tsx`
- `src/components/CreateExerciseModal.tsx`

The app loads exercise categories inside signed-in flows.
No required public/anonymous flow was found that depends on direct reads from
`public.exercise_categories`.

## Manual apply order

1. Run:
   - `scripts/sql/security_exercise_categories_audit.sql`
2. Apply:
   - `supabase/migrations/20260312_exercise_categories_shared_catalog_access.sql`
3. Re-run:
   - `scripts/sql/security_exercise_categories_audit.sql`
   - `scripts/sql/security_advisor_remaining_warnings_audit.sql`

## Smoke check

1. Sign in and open workouts.
2. Confirm exercise categories load.
3. Confirm exercise list loading via `exercises_full_view` still works.
4. Confirm no client flow tries to insert or update `exercise_categories`.
