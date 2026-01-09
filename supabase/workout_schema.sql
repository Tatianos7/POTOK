CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Категории
CREATE TABLE IF NOT EXISTS exercise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Мышцы
CREATE TABLE IF NOT EXISTS muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Упражнения
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES exercise_categories(id) ON DELETE CASCADE,
  description TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT exercises_name_category_unique UNIQUE (name, category_id, created_by_user_id)
);

-- Связь упражнений и мышц
CREATE TABLE IF NOT EXISTS exercise_muscles (
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_id UUID NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, muscle_id)
);

-- Дни тренировок
CREATE TABLE IF NOT EXISTS workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workout_days_user_date_unique UNIQUE (user_id, date)
);

-- Записи тренировок
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

DROP POLICY IF EXISTS "Anyone can read muscles" ON muscles;
CREATE POLICY "Anyone can read muscles"
  ON muscles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read standard exercises" ON exercises;
CREATE POLICY "Anyone can read standard exercises"
  ON exercises FOR SELECT
  USING (is_custom = false OR created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create custom exercises" ON exercises;
CREATE POLICY "Users can create custom exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "Users can update their custom exercises" ON exercises;
CREATE POLICY "Users can update their custom exercises"
  ON exercises FOR UPDATE
  USING (created_by_user_id = auth.uid());

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
      SELECT 1 FROM workout_days
      WHERE workout_days.id = workout_entries.workout_day_id
      AND workout_days.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_days
      WHERE workout_days.id = workout_entries.workout_day_id
      AND workout_days.user_id = auth.uid()
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
ON CONFLICT (name) DO NOTHING;

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

  ('Широчайшие'),
  ('Трапеция — верх'),
  ('Трапеция — средняя'),
  ('Ромбовидные'),

  ('Разгибатели спины'),
  ('Поясница'),

  ('Ягодицы — большая'),
  ('Ягодицы — средняя'),
  ('Ягодицы — малая'),

  ('Квадрицепс'),
  ('Бицепс бедра'),
  ('Икроножные'),

  ('Прямая мышца — верх'),
  ('Прямая мышца — низ'),
  ('Косые'),
  ('Поперечная'),

  ('Кор')
ON CONFLICT (name) DO NOTHING;

