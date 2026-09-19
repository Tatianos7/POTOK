# ПОТОК - Фитнес приложение

Современное мобильное фитнес-приложение, созданное с использованием React, TypeScript, Vite и Tailwind CSS.

Текущее состояние и ограничения запуска: [аудит 2026-09-18](reports/launch-readiness-audit-2026-09-18.md).
Приложение использует Supabase Auth; пользовательские данные защищаются серверными
RLS-политиками. Исторические SQL-файлы не являются единым bootstrap-скриптом.
Применение SQL, изменение RLS и импорт данных требуют отдельного согласованного
пакета: draft → review → approval → staging → verification → production approval.

## 🚀 Особенности

- 📱 Адаптивный дизайн для мобильных устройств (от 360px)
- 🔐 Система авторизации и регистрации
- 👤 Персонализированное приветствие пользователя
- 💎 Премиум функции с визуальными пометками
- 🔒 Безопасное хранение данных
- ⚡ Быстрая работа благодаря Vite
- 📦 Готово к деплою на GitHub Pages

## 🛠 Технологии

- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **Vite** - Сборщик и dev-сервер
- **Tailwind CSS** - Стилизация
- **React Router** - Маршрутизация
- **Axios** - HTTP клиент (для будущего API)
- **Lucide React** - Иконки
- **Supabase** - Backend as a Service (база данных, авторизация, аналитика)

## 📦 Установка

1. Установите зависимости:
```bash
npm install
```

2. Настройте Supabase (опционально, для полной функциональности):
   - Создай проект на [supabase.com](https://supabase.com)
   - Создай файл `.env.local` в корне проекта:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   - Для существующего проекта сначала проверь фактическую схему и историю миграций; не запускай общий SQL-файл как инструкцию обновления.
   - **Важно**: Используй только `anon` (публичный) ключ, НЕ `service_role`!

3. Запустите dev-сервер:
```bash
npm run dev
```

4. Откройте браузер на `http://localhost:5173`

> После применения SQL-миграций обновите кэш схемы PostgREST:
```sql
select pg_notify('pgrst', 'reload schema');
```

### Supabase Auth Redirect URLs (GitHub Pages + локально)

Для OAuth/OTP callback в `Supabase -> Authentication -> URL Configuration` добавьте:

- `Site URL`:
  - `https://tatianos7.github.io/POTOK/`
- `Redirect URLs`:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5176/auth/callback`
  - `https://tatianos7.github.io/POTOK/auth/callback`

Google OAuth в приложении использует redirect:
`window.location.origin + import.meta.env.BASE_URL + 'auth/callback'`.

> **Примечание**: Приложение будет работать и без Supabase, но функции привычек и аналитики будут недоступны.

## 🏗 Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в папке `dist/`.

## 📱 Мобильная разработка (Capacitor)

Приложение поддерживает разработку для Android через Capacitor.

### Быстрый старт:

```bash
# Собрать и синхронизировать с Android
npm run build:mobile

# Открыть в Android Studio
npm run android
```

### Полезные команды:

```bash
npm run build:mobile  # Собрать веб + синхронизировать с Android
npm run sync          # Синхронизировать файлы
npm run android       # Открыть проект в Android Studio
```

### Тестирование на устройстве:

1. Включить режим разработчика на Android
2. Подключить устройство через USB
3. В Android Studio нажать "Run"

**Подробная инструкция:** См. `РАБОТА_С_CAPACITOR.md`

**Важно:** Регистрация в Google Play Developer НЕ требуется для разработки и тестирования!

## 📱 Структура проекта

```
POTOK/
├── index.html          # Главный HTML файл (в корне для GitPages)
├── src/
│   ├── components/     # React компоненты
│   ├── pages/          # Страницы приложения
│   ├── context/        # React Context (Auth)
│   ├── services/       # API сервисы
│   ├── types/          # TypeScript типы
│   ├── utils/          # Утилиты и константы
│   ├── App.tsx         # Главный компонент
│   ├── main.tsx        # Точка входа
│   └── index.css       # Глобальные стили
├── package.json
├── vite.config.ts      # Конфигурация Vite
├── tailwind.config.js  # Конфигурация Tailwind
└── tsconfig.json       # Конфигурация TypeScript
```

## 🚀 Деплой на GitHub Pages

### Автоматический деплой (рекомендуется)

1. Убедись, что репозиторий подключен к GitHub:
   ```bash
   git remote add origin https://github.com/ТВОЙ_USERNAME/POTOK.git
   git branch -M main
   git push -u origin main
   ```

2. В настройках репозитория на GitHub:
   - Перейди в **Settings** → **Pages**
   - В разделе **Source** выбери **GitHub Actions**

3. При каждом push в ветку `main` или `master` проект автоматически соберется и задеплоится

### Ручной деплой

1. Запусти скрипт деплоя:
   ```bash
   ./scripts/deploy.sh
   ```

2. Или выполни вручную:
   ```bash
   npm run build
   # Затем используй gh-pages или другой инструмент для деплоя
   ```

### Настройка переменных окружения для GitHub Pages

Если используешь Supabase, добавь секреты в настройках репозитория:
- **Settings** → **Secrets and variables** → **Actions**
- Добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`

## 🔐 Аутентификация

Текущий вход использует Supabase Auth (OTP/OAuth) и `src/context/AuthContext.tsx`.
Локальные пользовательские кэши не заменяют сессию и серверные проверки доступа.
`ProtectedRoute` и `PremiumRoute` управляют UX; права на данные проверяются отдельно
на сервере. Локальный Demo Premium не является оплатой или серверным entitlement.

## 🗄️ Supabase Backend

Приложение поддерживает Supabase для хранения данных:

### Настройка базы данных

1. Создай проект на [supabase.com](https://supabase.com)
2. Открой SQL Editor в панели Supabase
3. Сверь фактические таблицы с текущими миграциями и одобренными пакетами. Не применяй `schema_fixed.sql` или `disable_rls.sql`: это исторические файлы с отключением RLS. Основные области данных:
   - `user_goals` - цели пользователя (калории, БЖУ)
   - `food_diary_entries` - записи дневника питания
   - `favorite_products` - избранные продукты
   - `recipes` - рецепты пользователя
   - `habits` - привычки пользователя
   - `habit_logs` - логи выполнения привычек
   - `analytics_events` - события аналитики

4. **Для замеров**: проверь текущие canonical-миграции и Storage-политики; старые таблицы встречаются в истории:
   - `user_measurements` - текущие замеры и фото пользователя
   - `measurement_history` - история замеров (для бесплатных пользователей)
   - `measurement_photo_history` - история фото замеров

5. **Для профилей пользователей**: проверь текущую схему и политики таблицы:
   - `user_profiles` - профили пользователей (имя, возраст, рост, цель, email, телефон, аватар, статус подписки, админ-статус)

### Безопасность (RLS)

RLS должен оставаться включённым. Фактическое состояние проверяется отдельно для
каждого окружения с anon и двумя authenticated-пользователями. Наличие миграции в
репозитории и прохождение клиентских тестов не доказывают применение политики.

### Доступные сервисы

- `habitsService.ts` - управление привычками
- `analyticsService.ts` - отслеживание событий аналитики
- `measurementsService.ts` - управление замерами и фото
- `profileService.ts` - управление профилем пользователя (синхронизация с Supabase)
- `goalService.ts` - управление целями пользователя
- `mealService.ts` - управление дневником питания
- `favoritesService.ts` - управление избранными продуктами
- `recipesService.ts` - управление рецептами
- `supabaseClient.ts` - единый клиент Supabase

### Переменные окружения

Создай файл `.env.local` в корне проекта:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Найди эти значения в Settings > API твоего Supabase проекта.

## 💎 Премиум функции

Следующие функции помечены как PREMIUM:
- Тренировки
- Привычки
- Прогресс

Пользователи без подписки видят пометку "PREMIUM" на этих карточках.

## 🚀 Деплой на GitHub Pages

1. Установите `gh-pages`:
```bash
npm install --save-dev gh-pages
```

2. Добавьте в `package.json`:
```json
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

3. Деплой:
```bash
npm run deploy
```

## 🔒 Безопасность

- Токены хранятся в localStorage (в продакшене использовать httpOnly cookies)
- Пароли должны хешироваться на сервере

## ✅ Smoke-test: Photo Storage Migration

Проверки после перехода на `measurement_photo_assets + Supabase Storage`:

1. `6 фото впервые`
- На `/measurements` загрузить `3 main + 3 extra`, нажать `СОХРАНИТЬ`.
- На `/progress/measurements` фото появляются, pending-бейдж исчезает после завершения upload.

2. `+1 фото в тот же день`
- После предыдущего шага снова сохранить только `1` фото за тот же день.
- UI не должен прыгать между старыми и новыми фото.

3. `Offline`
- Отключить сеть и сохранить фото.
- В `/progress/measurements` виден статус ошибки upload и доступен retry.
- После возврата сети retry завершает загрузку.

4. `Sign out / Sign in`
- После повторного входа фото за день доступны в `Progress -> Замеры`.

5. `320px layout`
- Проверить, что таблица/фото/бейджи/кнопка `Показать ещё` читаемы и не ломают верстку.
- Все API запросы должны проходить через HTTPS
- Используйте CORS настройки на backend
- Валидация данных на клиенте и сервере

## 📈 Масштабируемость

Для поддержки 500+ одновременных пользователей:

1. **Backend**: Используйте Node.js с Express/Fastify или другой фреймворк
2. **База данных**: PostgreSQL или MongoDB с индексами
3. **Кеширование**: Redis для сессий и часто используемых данных
4. **CDN**: Для статических файлов
5. **Балансировка нагрузки**: Nginx или облачные решения
6. **Мониторинг**: Логирование и метрики (Prometheus, Grafana)

## 📝 Лицензия

MIT

## 👨‍💻 Разработка

Для разработки рекомендуется использовать:
- VS Code с расширениями ESLint и Prettier
- React DevTools
- Redux DevTools (если добавите state management)
