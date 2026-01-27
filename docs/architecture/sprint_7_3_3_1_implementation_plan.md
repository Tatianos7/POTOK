# Sprint 7.3.3.1 — План реализации (UI Runtime & Experience Layer)

## Чек‑лист старта реализации
**Существующие экраны (уже в коде)**
- Цель (Goal)
- Замеры + Фото (Measurements)
- Дневник питания (Food Diary)
- Дневник тренировок (частично)
- Прогресс (частично)

**Новые экраны (к реализации)**
- Today
- My Program
- Progress v2 (life‑timeline)
- Habits
- Paywall / Premium Gate
- Profile (UX‑доработка под entitlement + состояние плана)

**Существующие сервисы**
- `programUxRuntimeService`
- `entitlementService`
- `programGenerationService`
- Контуры Adaptation + Trust + Explainability

**UI ↔ backend контракты уже готовы**
- DTO `programDeliveryService` (days/phases/status)
- `programUxRuntimeService` (Today/My Program flows)
- `entitlementService` gating (Free/Pro/Vision Pro)

**Контракты, которые нужно создать/расширить**
- Агрегация Progress (goal/measurements/diaries/habits)
- Habits service + streaks + logs
- Статус активации плана / follow‑cancel
- Explainability drawer hooks для Today/Progress/My Program

## Этап A — Bugfix & Stabilization
**Фокус**
- Устранить блокеры перед запуском UI runtime.

**Целевые фиксы**
- Сохранение Food Diary (idempotency key + стабильность upsert)
- Сохранение Recipes (RLS + user_id, единицы анализатора)
- Парсер единиц (display_amount/display_unit)
- Auth‑петля после logout
- Несоответствия RLS (user_id vs id_user)

**Результат**
- Все блокирующие ошибки в текущих экранах закрыты.
- E2E‑smoke 141–150 (manual path) — зелёные.

## Этап B — Core Manual Flow (Architecture & Contracts)
**Фокус:** базовый путь без плана и без Premium.

**B.1 (первый блок):** Goal → Measurements → Food Diary
- Описать UI State Machine.
- Зафиксировать Data Contracts.
- Safety & Trust слой.
- Explainability hooks.

**Связь с E2E 141–170**
- Manual Mode покрывает 141–165 как основу.
- Дополнительные проверки: 166–170 (manual/follow/explainability/trust).

## Этап C — Follow Plan Activation & Lifecycle
**Фокус:** активация плана и жизненный цикл (preview → active → paused → cancelled → completed → replan).

**C.1 (первый блок):** Plan Preview → Follow / Cancel
- UI State Machine для статусов плана.
- Data Contracts (активация, пауза, отмена).
- Trust / Safety / Explainability copy.

**Связь с E2E 141–170**
- 143–150: Today + Follow Plan + explainability
- 166–170: end‑to‑end journey / trust / adaptation

## Этап D — Account & Monetization UX Runtime
**Фокус:** профиль, подписка, paywall, настройки, уведомления, поддержка, legal.

**D.1 (первый блок):** Entitlement State Machine
- active / grace / expired / cancelled / restored
- paywall entry points: Goal / Today / My Program / Progress / Explainability

**D.2:** Subscription Lifecycle
- purchase / renew / cancel / restore / downgrade

**D.3:** Profile Security & Data Rights
- export / delete / consents / devices

**Связь с E2E 171–185**
- профиль, оплата, отмена/восстановление, legal‑согласия, экспорт/удаление.

## Summary по Scope
**Уже частично реализовано**
- Goal (расчёт + сохранение в `user_goals`)
- Measurements + Photos
- Food Diary
- Training Diary (частично)

**Новое**
- Today (только Premium + Follow Plan)
- My Program (таймлайн + версии + активация)
- Progress (агрегатор life‑timeline)
- Habits (поведенческий слой)

## Порядок реализации
1) **Today runtime**
   - `programUxRuntimeService.getToday()`
   - запись в дневники (meals/workouts)
   - feedback → `program_feedback`

2) **Follow Plan activation**
   - Preview плана → “Follow Plan”
   - Активация плана + создание `program_sessions`
   - Today включён

3) **My Program timeline**
   - phases/blocks/weeks view
   - версия + “почему изменилось”
   - pause/cancel flow

4) **Progress life‑timeline**
   - агрегировать goal/measurements/food/training/habits
   - plan adherence (только Follow Plan)

5) **Habits engine**
   - system + custom habits
   - streaks + logs
   - интеграция с Progress + Adaptation

## Backend‑зависимости
- `programUxRuntimeService` (Today, My Program, explains)
- `programDeliveryService` (данные программы)
- `entitlementService` (Premium gate)
- `programGenerationService` (Follow Plan activation)
- `program_adaptations`, `program_explainability`, `program_feedback`
- RPC/запросы для агрегации Progress (goal/measurements/diaries/habits)

## Интеграционные вехи
- M1: Today рендерится + пишет в дневники
- M2: Follow Plan activation + program sessions
- M3: My Program timeline + versioning
- M4: Progress timeline + insights
- M5: Habits layer + trust/adaptation hooks
