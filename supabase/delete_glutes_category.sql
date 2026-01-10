-- Удаление категории "Ягодицы" из базы данных
-- Выполните этот скрипт в Supabase SQL Editor

-- Сначала удаляем все связи упражнений этой категории с мышцами
DELETE FROM exercise_muscles
WHERE exercise_id IN (
  SELECT id FROM exercises 
  WHERE category_id IN (
    SELECT id FROM exercise_categories WHERE name = 'Ягодицы'
  )
);

-- Удаляем все упражнения из категории "Ягодицы"
DELETE FROM exercises
WHERE category_id IN (
  SELECT id FROM exercise_categories WHERE name = 'Ягодицы'
);

-- Удаляем саму категорию "Ягодицы"
DELETE FROM exercise_categories WHERE name = 'Ягодицы';

-- Проверяем результат - должны остаться только 7 категорий
SELECT name, "order" FROM exercise_categories ORDER BY "order";

