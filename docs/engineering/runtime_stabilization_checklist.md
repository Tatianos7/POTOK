# Runtime Stabilization — Smoke Checklist

Follow these steps after applying Phase 2 guards and Phase 1 schema migrations to verify the runtime is stable and schema-related errors are gone.

## Apply migrations (if not already applied)
- Run SQL scripts in Supabase SQL Editor in the following order:
  1. `supabase/phase8_ai_training_plans.sql`
  2. `supabase/phase8_food_upsert_indexes.sql`
  3. `supabase/phase8_notifications.sql`

## Quick checks (SQL Editor)
- Check `input_context` exists:
  - SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_training_plans' AND column_name='input_context';
  - Expect: one row with `input_context`.
- Check unique index for food diary idempotency:
  - SELECT indexname FROM pg_indexes WHERE tablename='food_diary_entries' AND indexdef ILIKE '%idempotency_key%';
  - Expect: `food_diary_entries_idempotency_unique` present and no duplicates:
    - SELECT user_id, idempotency_key, count(*) FROM public.food_diary_entries WHERE idempotency_key IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1; (should return 0 rows)
- Check `notification_history` exists:
  - SELECT 1 FROM public.notification_history LIMIT 1; (should not raise PGRST205)

## Runtime smoke tests (dev server + logs)
- Start dev server (`npm run dev`) and open these pages in the app (they trigger related services):
  - Today (/)
  - Workouts (/workouts)
  - Progress (/progress)
  - Any screen that triggers meal logging (add a food) or viewing food diary
- Observe logs and network:
  - Errors `PGRST205: Could not find table public.notification_history` should be gone.
  - Errors `42703: ai_training_plans.input_context does not exist` should be gone.
  - Upsert error `there is no unique or exclusion constraint matching the ON CONFLICT specification` should be gone.
  - No repeated retries or spammy network loops triggered by schema errors.

## Service-specific checks
- Notifications:
  - When `notification_history` is present: create a notification and ensure it is persisted.
  - If `notification_history` missing => service warns once and returns local fallback IDs (no repeated noise).
- AI training plans:
  - Queue a training plan; if `input_context` column was absent before migration, verify no crash occurs and fallback behavior is used (once migration applied, full behavior returns).
- Meal upsert:
  - Add food and ensure no ON CONFLICT unique constraint error occurs post-migration.

## Logs to verify
- No repeating schema errors in console (PGRST*/42703/42P01/23505). If any appear, they should be one-time warnings with a clear migration file to apply.

## Notes
- Guards are additive and conservative: they silence noisy schema errors and fallback to local-only behavior until migrations are applied.
- If you want, run the SQL commands as part of CI to ensure migrations are applied before deploy.
