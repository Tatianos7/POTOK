# Nutrition Data Flow (POTOK)

## 1) Куда реально пишутся данные

### `food_diary_entries` (приватный дневник)
- Что хранится: фактические записи приёмов пищи по дате (`date`, `meal_type`, `product_name`, `weight`, `calories/protein/fat/carbs/fiber`, `canonical_food_id`).
- Источник: пользовательские действия в дневнике (добавить/изменить/удалить).
- Приватность: user-owned, `user_id`.

### `foods` (смешанная модель: каталог + user-food)
- Что хранится: продуктовая база и пользовательские продукты.
- Классы данных:
  - `source in ('core','brand')`: каталог.
  - `source = 'user'` + `created_by_user_id`: пользовательские продукты.
- Критичный вывод: пользовательская еда физически хранится в `public.foods` (не в отдельной таблице), поэтому безопасность держится на корректных RLS-policy по `source` и owner-guard.

### `favorite_products` (приватное избранное)
- Что хранится: избранные продукты пользователя (`user_id`, `product_name`, возможный `canonical_food_id`, макросы).
- Приватность: user-owned, `user_id`.

### `meal_entry_notes` (приватные заметки)
- Что хранится: заметка к записи дневника (`meal_entry_id`, `text`, `user_id`).
- Приватность: user-owned, `user_id`.

### `food_import_*` (админ/ingestion pipeline)
- `food_import_batches`, `food_import_staging`: импортные этапы (обычно user/admin scoped).
- `food_import_conflicts`: конфликтные строки импорта; клиентский доступ должен быть закрыт или строго ограничен.

### `recipes` / `recipe_notes` / `favorite_recipes` / `recipe_collections`
- Рецепты и связанные user-owned данные.
- Приватность: user-owned по `user_id`.

## 2) Public catalog vs private data

- Public catalog: `foods` rows с `source in ('core','brand')`.
- Private user-owned:
  - `foods` rows с `source='user'` и `created_by_user_id=auth.uid()`.
  - `food_diary_entries`, `favorite_products`, `meal_entry_notes`, `recipes`, `recipe_notes`, `favorite_recipes`, `recipe_collections`.
- Требование безопасности: ни один запрос клиента не должен возвращать чужие user-rows.

## 3) Клиентские операции и какие таблицы они трогают

Ниже перечислены вызовы `supabase.from('...')` в nutrition-потоке.

### Дневник питания
- `src/services/mealService.ts:435`
- `src/services/mealService.ts:584`
- `src/services/mealService.ts:678`
- `src/services/mealService.ts:708`
- `src/services/mealService.ts:719`
- `src/services/mealService.ts:730`
- `src/services/mealService.ts:975`
- `src/services/mealService.ts:1034`
- Таблица: `food_diary_entries`

### Заметки к записи
- `src/services/mealEntryNotesService.ts:53`
- `src/services/mealEntryNotesService.ts:93`
- `src/services/mealEntryNotesService.ts:146`
- `src/services/mealEntryNotesService.ts:188`
- Таблица: `meal_entry_notes`

### Избранные продукты
- `src/services/favoritesService.ts:63`
- `src/services/favoritesService.ts:112`
- `src/services/favoritesService.ts:158`
- `src/services/favoritesService.ts:190`
- `src/services/favoritesService.ts:199`
- Таблица: `favorite_products`

### Поиск/каталог продуктов
- `src/services/foodService.ts:361` (`food_aliases`)
- `src/services/foodService.ts:368` (`foods`)
- `src/services/foodService.ts:524` (`foods`)
- `src/services/foodService.ts:594` (`foods`)
- `src/services/foodService.ts:633` (`foods`)
- `src/services/foodService.ts:686` (`foods` insert)
- `src/services/foodService.ts:799` (`foods`)
- `src/services/foodService.ts:834` (`foods`)

### Ingestion/import
- `src/services/foodIngestionService.ts:51` (`food_import_batches`)
- `src/services/foodIngestionService.ts:115` (`food_import_staging`)
- `src/services/foodIngestionService.ts:137` (`food_import_staging`)
- `src/services/foodIngestionService.ts:148` (`foods`)
- `src/services/foodIngestionService.ts:192` (`food_import_staging`)
- `src/services/foodIngestionService.ts:197` (`food_import_conflicts`)
- `src/services/foodIngestionService.ts:207` (`food_import_conflicts`)
- `src/services/foodIngestionService.ts:219` (`food_import_conflicts`)
- `src/services/foodIngestionService.ts:229` (`food_import_staging`)
- `src/services/foodIngestionService.ts:236` (`food_import_conflicts`)
- `src/services/foodIngestionService.ts:247` (`food_import_staging`)
- `src/services/foodIngestionService.ts:257` (`foods`)
- `src/services/foodIngestionService.ts:292` (`foods`)
- `src/services/foodIngestionService.ts:318` (`food_aliases`)
- `src/services/foodIngestionService.ts:329` (`food_import_batches`)
- `src/services/foodIngestionService.ts:348` (`food_diary_entries`)
- `src/services/foodIngestionService.ts:375` (`foods`)
- `src/services/foodIngestionService.ts:384` (`foods`)

### Рецепты и связи
- `src/services/recipesService.ts:39` (`foods`)
- `src/services/recipesService.ts:48` (`food_aliases`)
- `src/services/recipesService.ts:67` (`recipes`)
- `src/services/recipesService.ts:142` (`recipes`)
- `src/services/recipesService.ts:172` (`favorite_recipes`)
- `src/services/recipesService.ts:182` (`recipes`)
- `src/services/recipesService.ts:196` (`recipe_collections`)
- `src/services/recipesService.ts:206` (`recipes`)
- `src/services/recipesService.ts:227` (`favorite_recipes`)
- `src/services/recipesService.ts:240` (`favorite_recipes`)
- `src/services/recipesService.ts:255` (`recipe_collections`)
- `src/services/recipesService.ts:268` (`recipe_collections`)
- `src/services/recipesService.ts:322` (`recipes`)
- `src/services/recipesService.ts:333` (`recipes`)
- `src/services/recipesService.ts:458` (`recipes`)
- `src/services/recipesService.ts:491` (`recipes`)

### Заметки к рецептам
- `src/services/recipeNotesService.ts:46`
- `src/services/recipeNotesService.ts:82`
- `src/services/recipeNotesService.ts:127`
- `src/services/recipeNotesService.ts:192`
- `src/services/recipeNotesService.ts:215`
- `src/services/recipeNotesService.ts:256`
- Таблица: `recipe_notes`

## 4) Риски и контрольные точки

- Главная зона риска утечки: mixed-access в `foods`.
- Обязательная проверка в каждом релиз-гейте:
  - `source='user'` rows не видны другим пользователям.
  - `favorite_products`/`food_diary_entries`/`meal_entry_notes` строго owner-only.
  - `food_import_conflicts` не доступен клиенту (или отдаёт 0 строк по RLS).
