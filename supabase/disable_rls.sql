-- ============================================================
-- Полное отключение RLS для всех таблиц POTOK
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================================

-- 1. Удаляем ВСЕ политики RLS (если они есть)
DROP POLICY IF EXISTS "user_goals_select_own" ON public.user_goals;
DROP POLICY IF EXISTS "user_goals_upsert_own" ON public.user_goals;
DROP POLICY IF EXISTS "food_diary_select_own" ON public.food_diary_entries;
DROP POLICY IF EXISTS "food_diary_modify_own" ON public.food_diary_entries;
DROP POLICY IF EXISTS "favorite_products_select_own" ON public.favorite_products;
DROP POLICY IF EXISTS "favorite_products_modify_own" ON public.favorite_products;
DROP POLICY IF EXISTS "recipes_select_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_modify_own" ON public.recipes;
DROP POLICY IF EXISTS "habits_select_own" ON public.habits;
DROP POLICY IF EXISTS "habits_modify_own" ON public.habits;
DROP POLICY IF EXISTS "habit_logs_select_own" ON public.habit_logs;
DROP POLICY IF EXISTS "habit_logs_modify_own" ON public.habit_logs;
DROP POLICY IF EXISTS "analytics_events_select_own" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;

-- Удаляем политики для новых таблиц (если они есть)
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_modify_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_measurements_select_own" ON public.user_measurements;
DROP POLICY IF EXISTS "user_measurements_modify_own" ON public.user_measurements;
DROP POLICY IF EXISTS "measurement_history_select_own" ON public.measurement_history;
DROP POLICY IF EXISTS "measurement_history_modify_own" ON public.measurement_history;
DROP POLICY IF EXISTS "measurement_photo_history_select_own" ON public.measurement_photo_history;
DROP POLICY IF EXISTS "measurement_photo_history_modify_own" ON public.measurement_photo_history;

-- 2. Отключаем RLS для всех таблиц
ALTER TABLE IF EXISTS public.user_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_diary_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.favorite_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.habits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.habit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_measurements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.measurement_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.measurement_photo_history DISABLE ROW LEVEL SECURITY;

-- 3. Удаляем foreign key constraints на auth.users (если они есть)
ALTER TABLE IF EXISTS public.user_goals DROP CONSTRAINT IF EXISTS user_goals_user_id_fkey;
ALTER TABLE IF EXISTS public.food_diary_entries DROP CONSTRAINT IF EXISTS food_diary_entries_user_id_fkey;
ALTER TABLE IF EXISTS public.favorite_products DROP CONSTRAINT IF EXISTS favorite_products_user_id_fkey;
ALTER TABLE IF EXISTS public.recipes DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
ALTER TABLE IF EXISTS public.habits DROP CONSTRAINT IF EXISTS habits_user_id_fkey;
ALTER TABLE IF EXISTS public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_user_id_fkey;
ALTER TABLE IF EXISTS public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;

-- 4. Проверяем статус RLS (должно показать false для всех таблиц)
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS включен"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_goals',
    'food_diary_entries',
    'favorite_products',
    'recipes',
    'habits',
    'habit_logs',
    'analytics_events',
    'user_profiles',
    'user_measurements',
    'measurement_history',
    'measurement_photo_history'
  )
ORDER BY tablename;
