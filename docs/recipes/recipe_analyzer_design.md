# Recipe Analyzer Design (Nutrition)

## Цель
Детерминированный расчёт БЖУ/ккал рецепта из состава ингредиентов с безопасным разделением catalog/user данных.

## 1) Целевая модель данных

## Базовые таблицы
- `public.recipes`
  - `id uuid pk`
  - `user_id uuid not null`
  - `name text not null`
  - `servings numeric(8,2) default 1`
  - `yield_g numeric(10,2)` (готовый вес)
  - `total_calories/protein/fat/carbs/fiber numeric`
  - `created_at/updated_at`

- `public.recipe_ingredients` (новая, рекомендована)
  - `id uuid pk`
  - `recipe_id uuid not null references public.recipes(id) on delete cascade`
  - `food_id uuid not null references public.foods(id)`
  - `amount_g numeric(10,2) not null` (MVP: граммы)
  - `state text default 'raw' check (state in ('raw','cooked'))`
  - `loss_pct numeric(5,2) default 0` (потери/усушка опционально)
  - `created_at/updated_at`
  - Индексы: `(recipe_id)`, `(food_id)`

- `public.unit_conversions` (optional, roadmap)
  - `id uuid pk`
  - `food_id uuid null` (null = глобальная конверсия)
  - `unit text not null` (`g`,`ml`,`piece`,`tbsp`...)
  - `grams_per_unit numeric(10,4) not null`
  - `source text`

## Требования к `foods`
- Для расчёта analyzer нужны нутриенты на 100г:
  - `calories`, `protein`, `fat`, `carbs`, `fiber`
- `source` используется для доступа:
  - `core/brand` — каталог
  - `user` — только создателю
- Для user-food: обязательна связка `source='user'` + `created_by_user_id=auth.uid()`.

## 2) Алгоритм расчёта

1. Для каждого ингредиента взять nutrition-per-100g из `foods`.
2. Нормализовать массу ингредиента в граммы:
   - MVP: `amount_g` подаётся сразу.
   - Roadmap: через `unit_conversions`.
3. Посчитать вклад ингредиента:
   - `nutrient_value = nutrient_per_100g * amount_g / 100`.
4. Суммировать по ингредиентам: `total_*`.
5. Если задан `yield_g` и нужен per-100g cooked:
   - `per100_final = total_* / yield_g * 100`.
6. Если заданы порции (`servings`):
   - `per_serving = total_* / servings`.
7. Округление: `round(..., 2)`.

## 3) Порции и готовый вес

- MVP:
  - обязательный ввод в граммах (`amount_g`).
  - `servings` опционально.
  - `yield_g` опционально (если не задан — считаем `yield_g = sum(amount_g)` без термопотерь).
- Расширение:
  - `state raw/cooked` + `loss_pct` для корректировки выхода.
  - unit-aware ввод (шт/мл/ложки) через conversions.

## 4) Где считать

Рекомендация: Edge Function / server-side сервис.
- Причины:
  - единая воспроизводимая формула,
  - меньше риска расхождения клиента,
  - контроль валидации и аудита,
  - безопаснее для mixed-access foods.

Client-side допустим только как preview, финальное значение — после серверного пересчёта.

## 5) Валидация и edge-cases

- Продукт не найден: вернуть `validation_error` + список проблемных ингредиентов.
- Нулевая/отрицательная масса: reject.
- Неизвестная единица (roadmap): reject или требовать ручной ввод в граммах.
- Пустой рецепт: reject.
- Недоступный food row по RLS: reject как `not_found_or_forbidden`.

## 6) MVP правила ввода

- Только граммы (`amount_g`) на уровне UI/API.
- Минимальная масса > 0.
- Ограничение верхней границы на один ингредиент (например, <= 100000 г) для anti-abuse.
- Все totals считаются из `foods` per-100g, не из текстовых полей клиента.

## 7) Roadmap

1. `recipe_ingredients` как структурированный состав (убрать зависимость от json в `recipes.ingredients`).
2. Unit conversions (`piece/ml/tbsp`) + плотности.
3. Учет cooking transforms (loss/gain water).
4. Микроэлементы и allergens rollup.
5. Версионирование nutrition snapshots для воспроизводимости истории.

## 8) Security/RLS

- `recipes`, `recipe_ingredients`, `recipe_notes`, `favorite_recipes`, `recipe_collections` — user-owned RLS (`auth.uid() = user_id`).
- Для `recipe_ingredients.food_id` доступ к `foods` должен проходить через существующие mixed-access правила.
- Любая серверная функция расчёта должна выполнять запросы как authenticated user, не как service_role от клиента.
