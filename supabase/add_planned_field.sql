-- Добавляем поле planned в таблицу food_diary_entries
-- Это поле указывает, является ли запись планируемой (для будущих дат)

ALTER TABLE IF EXISTS public.food_diary_entries 
ADD COLUMN IF NOT EXISTS planned BOOLEAN NOT NULL DEFAULT false;

-- Добавляем комментарий к полю
COMMENT ON COLUMN public.food_diary_entries.planned IS 'Указывает, является ли запись планируемой (true для будущих дат)';

