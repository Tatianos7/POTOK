-- ============================================================
-- Performance indexes for high-traffic tables (Stage 1.5.1)
-- Only CREATE INDEX IF NOT EXISTS
-- ============================================================

-- food_diary_entries
create index if not exists food_diary_entries_user_created_at_idx
  on public.food_diary_entries (user_id, created_at desc);

-- workout_days
create index if not exists workout_days_user_created_at_idx
  on public.workout_days (user_id, created_at desc);

-- workout_entries
create index if not exists workout_entries_workout_day_id_idx
  on public.workout_entries (workout_day_id);
create index if not exists workout_entries_exercise_id_idx
  on public.workout_entries (exercise_id);
create index if not exists workout_entries_workout_day_created_at_idx
  on public.workout_entries (workout_day_id, created_at desc);

-- measurement_history
create index if not exists measurement_history_user_created_at_idx
  on public.measurement_history (user_id, created_at desc);

-- favorite_products
create index if not exists favorite_products_user_created_at_idx
  on public.favorite_products (user_id, created_at desc);

-- meal_entry_notes
create index if not exists meal_entry_notes_user_created_at_idx
  on public.meal_entry_notes (user_id, created_at desc);

-- exercise_muscles (filter by muscle)
create index if not exists exercise_muscles_muscle_exercise_idx
  on public.exercise_muscles (muscle_id, exercise_id);

-- Full-text search indexes (expression)
create index if not exists recipes_name_fts_idx
  on public.recipes using gin (to_tsvector('russian', name));

create index if not exists exercises_name_fts_idx
  on public.exercises using gin (to_tsvector('russian', name));
