# Инструкция по деплою на GitHub Pages

## Шаг 1: Сохранение в Git

Выполни следующие команды в терминале из корня проекта:

```bash
# Добавить все изменения
git add -A

# Создать коммит
git commit -m "Интеграция профиля пользователя и замеров с Supabase

- Добавлена таблица user_profiles для синхронизации профилей
- Добавлены таблицы для замеров (user_measurements, measurement_history, measurement_photo_history)
- Создан profileService для работы с профилями
- Обновлен measurementsService для работы с Supabase
- Исправлены ошибки ReferenceError и 406 в сервисах
- Обновлен disable_rls.sql для новых таблиц
- Добавлена синхронизация аватаров с Supabase"

# Проверить удаленный репозиторий
git remote -v

# Если репозиторий не настроен, добавь его:
# git remote add origin https://github.com/ТВОЙ_USERNAME/POTOK.git
# git branch -M main

# Отправить изменения
git push origin main
# или
git push origin master
```

## Шаг 2: Настройка GitHub Pages

1. Открой репозиторий на GitHub
2. Перейди в **Settings** → **Pages**
3. В разделе **Source** выбери **GitHub Actions**
4. Сохрани изменения

## Шаг 3: Автоматический деплой

После настройки GitHub Actions, при каждом push в ветку `main` или `master` проект автоматически:
- Соберется (npm run build)
- Задеплоится на GitHub Pages

## Альтернативный способ: Ручной деплой

Если хочешь задеплоить вручную:

```bash
# Собрать проект
npm run build

# Установить gh-pages (если еще не установлен)
npm install -g gh-pages

# Задеплоить
gh-pages -d dist
```

## Настройка переменных окружения (если используешь Supabase)

1. В настройках репозитория: **Settings** → **Secrets and variables** → **Actions**
2. Добавь секреты:
   - `VITE_SUPABASE_URL` - URL твоего Supabase проекта
   - `VITE_SUPABASE_ANON_KEY` - Anon ключ из Supabase

## Проверка деплоя

После деплоя приложение будет доступно по адресу:
`https://ТВОЙ_USERNAME.github.io/POTOK/`

