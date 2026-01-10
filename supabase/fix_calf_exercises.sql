-- Обновление связей упражнений на подъёмы на носки с мышцей "Икроножные мышцы"
-- Этот скрипт можно выполнить в Supabase SQL Editor, если упражнения уже существуют, но не имеют правильных связей

-- Убеждаемся, что мышца "Икроножные мышцы" существует
INSERT INTO muscles (name) 
VALUES ('Икроножные мышцы')
ON CONFLICT (name) DO NOTHING;

-- Получаем ID мышцы "Икроножные мышцы"
DO $$
DECLARE
    calf_muscle_id UUID;
    exercise_id_var UUID;
BEGIN
    -- Получаем ID мышцы
    SELECT id INTO calf_muscle_id FROM muscles WHERE name = 'Икроножные мышцы';
    
    IF calf_muscle_id IS NULL THEN
        RAISE EXCEPTION 'Мышца "Икроножные мышцы" не найдена';
    END IF;
    
    -- Обновляем связи для каждого упражнения
    FOR exercise_id_var IN 
        SELECT e.id 
        FROM exercises e
        JOIN exercise_categories c ON c.id = e.category_id
        WHERE c.name = 'Ноги'
        AND e.name IN (
            'Подъёмы на носки сидя или стоя',
            'Подъёмы на носки у стены',
            'Подъёмы на носки с гантелями'
        )
        AND e.is_custom = false
    LOOP
        -- Удаляем старые связи с мышцами икр (если есть)
        DELETE FROM exercise_muscles
        WHERE exercise_id = exercise_id_var
        AND muscle_id IN (
            SELECT id FROM muscles 
            WHERE name IN ('Икроножные', 'Икроножные мышцы')
        );
        
        -- Создаем новую связь с "Икроножные мышцы"
        INSERT INTO exercise_muscles (exercise_id, muscle_id)
        VALUES (exercise_id_var, calf_muscle_id)
        ON CONFLICT (exercise_id, muscle_id) DO NOTHING;
        
        RAISE NOTICE 'Связь обновлена для упражнения ID: %', exercise_id_var;
    END LOOP;
    
    RAISE NOTICE 'Все связи обновлены успешно!';
END $$;

