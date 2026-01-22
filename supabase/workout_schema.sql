CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP VIEW IF EXISTS exercises_full_view CASCADE;

CREATE TABLE IF NOT EXISTS exercise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES exercise_categories(id) ON DELETE CASCADE,
  description TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT exercises_name_category_unique UNIQUE (name, category_id, created_by_user_id)
);

CREATE TABLE IF NOT EXISTS exercise_muscles (
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_id UUID NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, muscle_id)
);

CREATE TABLE IF NOT EXISTS workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workout_days_user_date_unique UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS workout_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL DEFAULT 1,
  reps INTEGER NOT NULL DEFAULT 0,
  weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_exercise_categories_updated_at ON exercise_categories;
CREATE TRIGGER update_exercise_categories_updated_at
BEFORE UPDATE ON exercise_categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_muscles_updated_at ON muscles;
CREATE TRIGGER update_muscles_updated_at
BEFORE UPDATE ON muscles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exercises_updated_at ON exercises;
CREATE TRIGGER update_exercises_updated_at
BEFORE UPDATE ON exercises
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workout_days_updated_at ON workout_days;
CREATE TRIGGER update_workout_days_updated_at
BEFORE UPDATE ON workout_days
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workout_entries_updated_at ON workout_entries;
CREATE TRIGGER update_workout_entries_updated_at
BEFORE UPDATE ON workout_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exercise categories" ON exercise_categories;
CREATE POLICY "Anyone can read exercise categories"
  ON exercise_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert exercise categories" ON exercise_categories;
CREATE POLICY "Anyone can insert exercise categories"
  ON exercise_categories FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Anyone can read muscles" ON muscles;
CREATE POLICY "Anyone can read muscles"
  ON muscles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read standard exercises" ON exercises;
CREATE POLICY "Anyone can read standard exercises"
  ON exercises FOR SELECT
  USING (is_custom = false);

DROP POLICY IF EXISTS "Users can read their custom exercises" ON exercises;
CREATE POLICY "Users can read their custom exercises"
  ON exercises FOR SELECT
  USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create custom exercises" ON exercises;
CREATE POLICY "Users can create custom exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "Users can update their custom exercises" ON exercises;
CREATE POLICY "Users can update their custom exercises"
  ON exercises FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their custom exercises" ON exercises;
CREATE POLICY "Users can delete their custom exercises"
  ON exercises FOR DELETE
  USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their workout days" ON workout_days;
CREATE POLICY "Users can manage their workout days"
  ON workout_days FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their workout entries" ON workout_entries;
CREATE POLICY "Users can manage their workout entries"
  ON workout_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM workout_days wd
      WHERE wd.id = workout_day_id
        AND wd.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_days wd
      WHERE wd.id = workout_day_id
        AND wd.user_id = auth.uid()
    )
  );

INSERT INTO exercise_categories (name, "order") VALUES
  ('Плечи', 1),
  ('Руки', 2),
  ('Грудь', 3),
  ('Спина', 4),
  ('Ноги', 5),
  ('Пресс', 6),
  ('Кардио', 7)
ON CONFLICT (name) DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO muscles (name) VALUES
  ('Передние дельты'),
  ('Средние дельты'),
  ('Задние дельты'),

  ('Бицепс'),
  ('Трицепс'),
  ('Брахиалис'),

  ('Грудь — верх'),
  ('Грудь — середина'),
  ('Грудь — низ'),
  ('Верхний пучок'),
  ('Средний пучок'),
  ('Нижний пучок'),

  ('Широчайшие'),
  ('Трапеция — верх'),
  ('Трапеция — средняя'),
  ('Ромбовидные'),

  ('Разгибатели спины'),
  ('Поясница'),

  ('Ягодицы — большая'),
  ('Ягодицы — средняя'),
  ('Ягодицы — малая'),
  ('Большая ягодичная'),
  ('Средняя ягодичная'),
  ('Малая ягодичная'),
  ('Ягодичная'),
  ('Ягодицы'),

  ('Квадрицепс'),
  ('Бицепс бедра'),
  ('Икроножные'),
  ('Икроножные мышцы'),
  
  ('Приводящие'),
  ('Приводящие мышцы'),

  -- Пресс (нормализованные названия)
  ('Прямая — верх'),
  ('Прямая — низ'),
  ('Косые'),
  ('Поперечная'),
  ('Кор'),
  ('Нижний кор'),
  
  -- Грудь (нормализованные названия)
  ('Верхний пучок'),
  ('Средний пучок'),
  ('Нижний пучок'),
  
  -- Старые варианты для обратной совместимости
  ('Прямая мышца — верх'),
  ('Прямая мышца — низ'),
  ('Прямая (верхняя часть)'),
  ('Прямая (нижняя часть)'),
  ('Прямая'),
  ('Поперечные'),
  ('Косая'),
  ('Прямая мышца живота'),
  ('Косые мышцы'),
  ('Поперечная мышца живота'),
  ('Прямая мышца живота-верх'),
  ('Прямая мышца живота-низ'),
  ('Грудь (верх)'),
  ('Грудь — верх'),
  ('Грудь (середина)'),
  ('Грудь — середина'),
  ('Грудь (низ)'),
  ('Грудь — низ'),
  ('Грудь')
ON CONFLICT (name) DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Плечи'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Обратная бабочка (Reverse Pec Deck)'),
  ('Тяга штанги к подбородку'),
  ('Жим гантелей за голову'),
  ('Изолированный подъём рук в тренажёре (махи в стороны)'),
  ('Армейский жим с гантелями'),
  ('Подъёмы на грудь (Push Press) со штангой'),
  ('Подъёмы на грудь (Push Press) с гантелями'),
  ('Разведение гантелей в наклоне'),
  ('Тяга к подбородку в тренажёре'),
  ('Жим гантелей сидя'),
  ('Армейский жим с гирей (одной рукой)'),
  ('Армейский жим с гантелью (одной рукой)'),
  ('Разведение гантелей в стороны'),
  ('Жим штанги за голову'),
  ('Жим гантелей стоя'),
  ('Жим в тренажёре сидя (плечевой жим)'),
  ('Махи гантелей перед собой'),
  ('Жим штанги сидя'),
  ('Жим штанги стоя')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Обратная бабочка (Reverse Pec Deck)',
  'Разведение гантелей в наклоне'
)
AND m.name = 'Задние дельты'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Тяга штанги к подбородку',
  'Изолированный подъём рук в тренажёре (махи в стороны)',
  'Тяга к подбородку в тренажёре',
  'Разведение гантелей в стороны',
  'Жим штанги за голову'
)
AND m.name = 'Средние дельты'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим гантелей за голову',
  'Армейский жим с гантелями',
  'Подъёмы на грудь (Push Press) со штангой',
  'Подъёмы на грудь (Push Press) с гантелями',
  'Жим гантелей сидя',
  'Армейский жим с гирей (одной рукой)',
  'Армейский жим с гантелью (одной рукой)',
  'Жим гантелей стоя',
  'Жим в тренажёре сидя (плечевой жим)',
  'Махи гантелей перед собой',
  'Жим штанги сидя',
  'Жим штанги стоя'
)
AND m.name = 'Передние дельты'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Подъёмы на грудь (Push Press) со штангой',
  'Подъёмы на грудь (Push Press) с гантелями'
)
AND m.name = 'Трицепс'
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Руки'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Отжимания на брусьях (без отягощения)'),
  ('Концентрированный подъём гантели (сидя, локоть на бедре)'),
  ('Французский жим лёжа'),
  ('Сгибание рук в тренажёре на бицепс'),
  ('Молотковый подъём гантелей'),
  ('Отжимания от скамьи'),
  ('Отжимания на брусьях'),
  ('Разгибание гантели в наклоне'),
  ('Жим лёжа узким хватом'),
  ('Подъём гантелей с супинацией'),
  ('Подтягивания обратным хватом'),
  ('Концентрированный подъём со штангой'),
  ('Разгибание гантели из-за головы одной рукой'),
  ('Жим в тренажёре на трицепс'),
  ('Разгибание рук в блоке сверху'),
  ('Разгибание с прямой рукоятью в блоке сверху'),
  ('Подъём гантелей на наклонной скамье'),
  ('Отжимания узким хватом'),
  ('Французский жим одной гантелью'),
  ('Подъём гантелей на бицепс'),
  ('Французский жим стоя или сидя'),
  ('Изометрические удержания в подтягиваниях'),
  ('Сгибание рук в кроссовере'),
  ('Подъём EZ-штанги на бицепс'),
  ('Подъём штанги на бицепс')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Концентрированный подъём гантели (сидя, локоть на бедре)',
  'Сгибание рук в тренажёре на бицепс',
  'Подъём гантелей с супинацией',
  'Подтягивания обратным хватом',
  'Концентрированный подъём со штангой',
  'Подъём гантелей на наклонной скамье',
  'Подъём гантелей на бицепс',
  'Изометрические удержания в подтягиваниях',
  'Сгибание рук в кроссовере',
  'Подъём EZ-штанги на бицепс',
  'Подъём штанги на бицепс'
)
AND m.name = 'Бицепс'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Французский жим лёжа',
  'Отжимания от скамьи',
  'Отжимания на брусьях',
  'Разгибание гантели в наклоне',
  'Жим лёжа узким хватом',
  'Разгибание гантели из-за головы одной рукой',
  'Жим в тренажёре на трицепс',
  'Разгибание рук в блоке сверху',
  'Разгибание с прямой рукоятью в блоке сверху',
  'Отжимания узким хватом',
  'Французский жим одной гантелью',
  'Французский жим стоя или сидя'
)
AND m.name = 'Трицепс'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN ('Молотковый подъём гантелей')
AND m.name = 'Брахиалис'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Отжимания на брусьях',
  'Отжимания на брусьях (без отягощения)'
)
AND m.name = 'Грудь'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN ('Подтягивания обратным хватом')
AND m.name = 'Широчайшие'
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Грудь'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Жим в тренажёре под углом вниз'),
  ('Жим штанги лёжа (горизонтальная скамья)'),
  ('Жим гантелей под углом вверх'),
  ('Кроссовер — сведение рук сверху вниз («нижний кроссовер»)'),
  ('Жим в тренажёре лёжа (грудной тренажёр)'),
  ('Кроссовер—сведение снизу вверх'),
  ('Жим гантелей под углом вниз'),
  ('Отжимания с хлопком (плиометрические)'),
  ('Жим штанги лёжа узким хватом'),
  ('Кроссовер (сведение рук в кроссовере на высоте груди)'),
  ('Жим гантелей лёжа (горизонтально)'),
  ('Бабочка (машина для сведения рук — Pec Deck)'),
  ('Жим штанги под углом вверх (наклонная скамья, 30–45°)'),
  ('Жим штанги под углом вниз (скамья с отрицательным наклоном)'),
  ('Отжимания на кольцах или нестабильной поверхности'),
  ('Отжимания с ногами на возвышении'),
  ('Отжимания от пола (классические)'),
  ('Жим в тренажёре под углом вверх'),
  ('Пулловер с гантелью лёжа (через голову)'),
  ('Разведение гантелей на наклонной скамье вниз'),
  ('Разведение гантелей на наклонной скамье вверх'),
  ('Разведение гантелей лёжа («бабочка с гантелями»)')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим гантелей под углом вверх',
  'Кроссовер—сведение снизу вверх',
  'Жим штанги под углом вверх (наклонная скамья, 30–45°)',
  'Отжимания с ногами на возвышении',
  'Жим в тренажёре под углом вверх',
  'Разведение гантелей на наклонной скамье вверх'
)
AND m.name = 'Верхний пучок'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим штанги лёжа (горизонтальная скамья)',
  'Жим в тренажёре лёжа (грудной тренажёр)',
  'Отжимания с хлопком (плиометрические)',
  'Кроссовер (сведение рук в кроссовере на высоте груди)',
  'Жим гантелей лёжа (горизонтально)',
  'Бабочка (машина для сведения рук — Pec Deck)',
  'Отжимания на кольцах или нестабильной поверхности',
  'Отжимания от пола (классические)',
  'Разведение гантелей лёжа («бабочка с гантелями»)',
  'Жим штанги лёжа узким хватом'
)
AND m.name = 'Средний пучок'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим в тренажёре под углом вниз',
  'Кроссовер — сведение рук сверху вниз («нижний кроссовер»)',
  'Жим гантелей под углом вниз',
  'Жим штанги под углом вниз (скамья с отрицательным наклоном)',
  'Пулловер с гантелью лёжа (через голову)',
  'Разведение гантелей на наклонной скамье вниз'
)
AND m.name = 'Нижний пучок'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим штанги лёжа узким хватом'
)
AND m.name = 'Трицепс'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Жим штанги лёжа узким хватом'
)
AND m.name IN ('Грудь', 'Грудь (середина)', 'Грудь — середина', 'Средний пучок')
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN ('Пулловер с гантелью лёжа (через голову)')
AND m.name = 'Широчайшие'
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Спина'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Тяга каната к поясу в наклоне'),
  ('Румынская становая тяга'),
  ('Австралийские подтягивания'),
  ('Тяга гантели в наклоне одной рукой'),
  ('Горизонтальная тяга сидя'),
  ('Тяга верхнего блока к груди'),
  ('Пулловер с гантелью лёжа'),
  ('Шраги со штангой'),
  ('Гиперэкстензия'),
  ('Обратная гиперэкстензия'),
  ('Тяга штанги в наклоне'),
  ('Гиперэкстензия в тренажёре'),
  ('Шраги с гантелями'),
  ('Супермен'),
  ('Тяга в тренажёре Горка'),
  ('Тяга Т-грифа'),
  ('Горизонтальная тяга в тренажёре'),
  ('Тяга нижнего блока одной рукой'),
  ('Тяга двух гантелей в наклоне'),
  ('Подтягивания обратным хватом'),
  ('Подтягивания средним хватом'),
  ('Подтягивания широким хватом'),
  ('Вертикальная тяга узким хватом'),
  ('Становая тяга (классическая)'),
  ('Вертикальная тяга широким хватом')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Тяга каната к поясу в наклоне',
  'Тяга гантели в наклоне одной рукой',
  'Тяга верхнего блока к груди',
  'Тяга штанги в наклоне',
  'Тяга Т-грифа',
  'Тяга нижнего блока одной рукой',
  'Тяга двух гантелей в наклоне',
  'Подтягивания обратным хватом',
  'Подтягивания средним хватом',
  'Подтягивания широким хватом',
  'Вертикальная тяга узким хватом',
  'Вертикальная тяга широким хватом'
)
AND m.name = 'Широчайшие'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Австралийские подтягивания',
  'Горизонтальная тяга сидя',
  'Тяга в тренажёре Горка',
  'Горизонтальная тяга в тренажёре',
  'Тяга Т-грифа',
  'Тяга двух гантелей в наклоне'
)
AND m.name = 'Середина спины'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Румынская становая тяга',
  'Гиперэкстензия',
  'Обратная гиперэкстензия',
  'Гиперэкстензия в тренажёре',
  'Супермен',
  'Становая тяга (классическая)'
)
AND m.name = 'Поясница'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Шраги со штангой',
  'Шраги с гантелями',
  'Становая тяга (классическая)'
)
AND m.name = 'Трапеция'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Подтягивания обратным хватом',
  'Подтягивания средним хватом',
  'Вертикальная тяга узким хватом'
)
AND m.name = 'Бицепс'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Становая тяга (классическая)',
  'Румынская становая тяга'
)
AND m.name = 'Ягодицы'
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Ноги'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Махи ногой в сторону на четвереньках'),
  ('Махи ногой назад на четвереньках'),
  ('Подъёмы на носки сидя или стоя'),
  ('Приседания со штангой спереди'),
  ('Подъёмы на носки у стены'),
  ('Стульчик у стены'),
  ('Разгибание ног сидя'),
  ('Отведение ног назад в тренажёре'),
  ('Приседания с гантелью у груди'),
  ('Становая тяга на прямых ногах'),
  ('Болгарские сплит-приседания с гантелями'),
  ('Приседания классические'),
  ('Степ-апы'),
  ('Тяга ног назад в тренажёре'),
  ('Мостик с одной ногой'),
  ('Боковые выпады'),
  ('Ягодичный мост'),
  ('Выпады с гантелями'),
  ('Приведение ног в тренажёре'),
  ('Сгибание ног лёжа'),
  ('Гакк-присед'),
  ('Болгарские сплит-приседания'),
  ('Отведение ног в стороны в тренажёре'),
  ('Прыжки в приседе'),
  ('Жим ногами'),
  ('Выпады со штангой'),
  ('Подъёмы на носки с гантелями'),
  ('Махи гирей'),
  ('Становая тяга на одной ноге'),
  ('Приседания со штангой на плечах')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Приседания со штангой спереди',
  'Стульчик у стены',
  'Разгибание ног сидя',
  'Приседания с гантелью у груди',
  'Болгарские сплит-приседания с гантелями',
  'Приседания классические',
  'Степ-апы',
  'Боковые выпады',
  'Выпады с гантелями',
  'Гакк-присед',
  'Болгарские сплит-приседания',
  'Прыжки в приседе',
  'Жим ногами',
  'Выпады со штангой',
  'Приседания со штангой на плечах'
)
AND m.name = 'Квадрицепс'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Махи ногой назад на четвереньках',
  'Отведение ног назад в тренажёре',
  'Приседания с гантелью у груди',
  'Становая тяга на прямых ногах',
  'Болгарские сплит-приседания с гантелями',
  'Приседания классические',
  'Мостик с одной ногой',
  'Ягодичный мост',
  'Выпады с гантелями',
  'Болгарские сплит-приседания',
  'Жим ногами',
  'Выпады со штангой',
  'Махи гирей',
  'Становая тяга на одной ноге',
  'Приседания со штангой на плечах'
)
AND m.name = 'Ягодицы'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Становая тяга на прямых ногах',
  'Сгибание ног лёжа',
  'Тяга ног назад в тренажёре',
  'Махи гирей',
  'Становая тяга на одной ноге'
)
AND m.name = 'Бицепс бедра'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Подъёмы на носки сидя или стоя',
  'Подъёмы на носки у стены',
  'Подъёмы на носки с гантелями'
)
AND m.name = 'Икры'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Приведение ног в тренажёре',
  'Боковые выпады'
)
AND m.name = 'Приводящие'
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Пресс'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('«Ножницы» ногами лёжа'),
  ('Русские скручивания с медболом или гантелью'),
  ('Подъём ног в висе на турнике'),
  ('Русские скручивания (без веса)'),
  ('«Мостик» (для включения нижнего пресса в стабилизацию)'),
  ('«Супермен» (лёжа, подъём рук и ног)'),
  ('Подъём ног с утяжелителем между стоп'),
  ('«Лодочка»'),
  ('Подъём ног лёжа'),
  ('«Альпинист»'),
  ('Планка на ролике (с колен или стоя)'),
  ('Боковые наклоны с гантелью'),
  ('Скручивания'),
  ('Скручивания в тренажёре на пресс'),
  ('Боковая планка'),
  ('Тяга каната к колену в кроссовере (стоя в повороте)'),
  ('«Мертвец и ангел»'),
  ('«Птица-собака»'),
  ('«Велосипед»'),
  ('Кабельные скручивания (стоя, трос сверху)'),
  ('Скручивания с гантелью за головой'),
  ('Планка'),
  ('Обратные скручивания (подъём таза лёжа)'),
  ('«Планка с подтягиванием колен»')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  '«Ножницы» ногами лёжа',
  'Подъём ног в висе на турнике',
  'Подъём ног с утяжелителем между стоп',
  'Подъём ног лёжа',
  'Обратные скручивания (подъём таза лёжа)',
  '«Мостик» (для включения нижнего пресса в стабилизацию)'
)
AND m.name = 'Прямая — низ'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Скручивания',
  'Скручивания в тренажёре на пресс',
  'Кабельные скручивания (стоя, трос сверху)',
  'Скручивания с гантелью за головой',
  '«Лодочка»',
  '«Альпинист»',
  'Планка на ролике (с колен или стоя)',
  '«Велосипед»'
)
AND m.name = 'Прямая — верх'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Русские скручивания с медболом или гантелью',
  'Русские скручивания (без веса)',
  'Боковые наклоны с гантелью',
  'Боковая планка',
  'Тяга каната к колену в кроссовере (стоя в повороте)',
  '«Велосипед»'
)
AND m.name = 'Косые'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Боковая планка',
  'Планка',
  'Планка на ролике (с колен или стоя)',
  '«Планка с подтягиванием колен»',
  '«Мертвец и ангел»',
  '«Птица-собака»',
  '«Альпинист»',
  '«Мостик» (для включения нижнего пресса в стабилизацию)',
  '«Лодочка»'
)
AND m.name = 'Поперечная'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  '«Альпинист»',
  'Планка',
  '«Птица-собака»',
  '«Планка с подтягиванием колен»'
)
AND m.name IN ('Кор', 'Нижний кор')
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  '«Мостик» (для включения нижнего пресса в стабилизацию)'
)
AND m.name IN ('Поперечная', 'Поперечная мышца живота', 'Поперечные')
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  '«Супермен» (лёжа, подъём рук и ног)'
)
AND m.name = 'Разгибатели спины'
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  '«Супермен» (лёжа, подъём рук и ног)'
)
AND m.name IN ('Нижний кор', 'Кор')
ON CONFLICT DO NOTHING;

WITH cat AS (
  SELECT id FROM exercise_categories WHERE name = 'Кардио'
)

INSERT INTO exercises (name, category_id)
SELECT name, (SELECT id FROM cat)
FROM (VALUES
  ('Бег на дорожке'),
  ('Бег на улице'),
  ('Ходьба'),
  ('Скакалка'),
  ('Велотренажёр'),
  ('Эллипсоид'),
  ('Гребной тренажёр'),
  ('Степпер'),
  ('Прыжки на месте'),
  ('Берпи'),
  ('Быстрая ходьба в гору'),
  ('Интервальный бег'),
  ('Спринты'),
  ('Прыжки со скакалкой'),
  ('Танцевальное кардио'),
  ('Плавание'),
  ('Аэробика'),
  ('Круговая тренировка')
) AS t(name)
ON CONFLICT DO NOTHING;

INSERT INTO muscles (name)
VALUES
  ('Сердечно-сосудистая система'),
  ('Все тело')
ON CONFLICT DO NOTHING;

INSERT INTO exercise_muscles (exercise_id, muscle_id)
SELECT e.id, m.id
FROM exercises e, muscles m
WHERE e.name IN (
  'Бег на дорожке',
  'Бег на улице',
  'Ходьба',
  'Скакалка',
  'Велотренажёр',
  'Эллипсоид',
  'Гребной тренажёр',
  'Степпер',
  'Прыжки на месте',
  'Берпи',
  'Быстрая ходьба в гору',
  'Интервальный бег',
  'Спринты',
  'Прыжки со скакалкой',
  'Танцевальное кардио',
  'Плавание',
  'Аэробика',
  'Круговая тренировка'
)
AND m.name = 'Сердечно-сосудистая система'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW exercises_full_view AS
SELECT
  e.id,
  e.name AS exercise_name,
  c.name AS category,
  COALESCE(
    array_agg(DISTINCT m.name ORDER BY m.name) FILTER (WHERE m.name IS NOT NULL),
    ARRAY[]::text[]
  ) AS muscles
FROM exercises e
JOIN exercise_categories c ON c.id = e.category_id
LEFT JOIN exercise_muscles em ON em.exercise_id = e.id
LEFT JOIN muscles m ON m.id = em.muscle_id
WHERE e.is_custom = false
GROUP BY e.id, e.name, c.name
ORDER BY e.name, c.name;

SELECT * FROM exercise_categories ORDER BY "order";
SELECT * FROM muscles ORDER BY name;
SELECT exercise_name, category FROM exercises_full_view ORDER BY category, exercise_name;

