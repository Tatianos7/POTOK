# Exercise Catalog New User Bootstrap Fix

- Timestamp: 2026-08-01T00:00:00Z
- Scope: new-user startup/profile 401 noise from `initializeExerciseData`
- Verdict: **EXERCISE_CATALOG_BOOTSTRAP_RUNTIME_FIX_READY**

## Safety

- Runtime-only fix.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No migrations/import/backfill/recompute were run.
- Food Core, nutrition, recipes, Progress logic, Workout Progress logic, Exercise Card MVP, archived exercises, restore UI, and user exercise media flow were not changed.
- No PR was created.

## Finding

`exercise_categories` is a shared read-only catalog:

- authenticated users can read categories;
- anon/public access is blocked;
- client writes are intentionally blocked by grants/RLS.

The startup path still called legacy `initializeExerciseData()` from `src/main.tsx`. If it ran before the auth session was ready, the category read could return 401/fallback empty, then the legacy bootstrap attempted client-side inserts for default categories such as `Плечи`, `Руки`, `Грудь`, `Спина`, `Ноги`, `Пресс`, and `Кардио`.

Those inserts were correctly blocked, but produced confusing console errors for a new user.

## Fix

- Removed global `initializeExerciseData()` call from app startup.
- Kept `initializeExerciseData()` as a read-only catalog availability check.
- Removed client-side category insert bootstrap behavior.
- Updated Workout Diary category loading so an empty category result does not trigger client-side category creation.

## Product Impact

- New user startup/profile no longer attempts to create exercise categories.
- Shared exercise categories remain global/read-only.
- Exercise list, workout creation, Workout Diary, Workout Progress, and MuscleMap continue to rely on the existing authenticated catalog read path.
- If categories are unavailable after login, that indicates catalog seed/RLS configuration and should be handled as a DB/RLS review, not by client inserts.

## Verification

- `npx tsx --test src/utils/__tests__/initializeExerciseData.test.ts src/pages/__tests__/Workouts.test.ts src/services/__tests__/exerciseService.test.ts`: **PASS**, `44/44`.
- `npm run build`: **PASS**.

Build notes:

- Existing browser data and chunk-size warnings were shown.
- No build failure.

## Final Status

The new-user exercise catalog bootstrap issue is fixed in runtime code. The client no longer writes shared exercise categories, and the app no longer queries the exercise catalog during global startup before auth is ready.
