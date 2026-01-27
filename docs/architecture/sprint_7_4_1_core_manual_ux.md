# Sprint 7.4.1 — Core Manual UX (Architecture & Implementation Plan)

## A) UX Runtime State Machine
**Состояния пользователя**
- new_user → goal_set → measurements_set → diary_active → habits_active → progress_active
- error → recovery
- offline → retry

**Переходы между экранами**
- Goal → Measurements → Food Diary → Training Diary → Habits → Progress
- Прямые входы: Food/Training Diary (ручной режим), Progress (life‑timeline)

**Пустые состояния**
- нет цели → CTA “рассчитать цель”
- нет замеров → CTA “зафиксировать точку А”
- нет записей → CTA “добавить питание/тренировку”

**Ошибки / восстановление**
- запись не сохранилась → retry
- конфликт данных → показать факт + предложить исправить

## B) Data Contracts
| Screen | Reads | Writes | Source of truth | Sync rules | Offline/Retry | Explainability | Trust Impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Goal | `user_profiles` | `user_goals`, `nutrition_targets` | DB | save immediately | retry on error | “почему КБЖУ” | ↑ |
| Measurements | `measurement_history`, `measurement_photo_history` | same | DB | append + update | offline cache | “почему темп” | ↑ |
| Food Diary | `food_diary_entries`, `nutrition_targets` | `food_diary_entries` | DB | upsert by date | retry + cache | “почему отклонения” | ↑ |
| Training Diary | `workout_days`, `workout_entries` | same | DB | upsert day + entries | retry + cache | “почему объём” | ↑ |
| Habits | `habits`, `habit_logs` | same | DB | daily logs | retry | “почему ритм” | ↑ |
| Progress | all sources | — | aggregate | refresh on change | cache | “почему прогресс” | ↑ |

## C) Progress Aggregation Logic
- goal_state + measurements_timeline + photo_timeline
- nutrition_timeline (daily фактическое КБЖУ)
- training_timeline (объём, PR, частота)
- habits_timeline (streaks, consistency)
- результат: единый Progress Life‑Timeline

## D) Safety & Trust Layer
**Validation**
- числовые поля: диапазоны, отрицательные значения → мягкое предупреждение
- пропуски → “это нормально”

**Anti‑shame UX**
- “вы в контроле”
- “маленькие шаги важны”

**Error copy**
- “не удалось сохранить, попробуйте ещё раз”

**Recovery paths**
- retry / восстановление из локального кэша

## E) E2E Scenarios (Manual Mode)
- создание цели → цель сохранена
- изменение замеров → обновлён прогресс
- добавление еды → отражено в дневнике
- добавление тренировок → отражено в дневнике
- формирование привычек → streak в прогрессе
- progress timeline показывает все источники

## Implementation Backlog
**UI tasks**
- Goal → Measurements → Diaries → Habits → Progress (manual)
- пустые состояния, recovery UX

**Backend adjustments**
- агрегатор Progress (goal/measurements/food/training/habits)
- стабилизация дневников (idempotency)

**RLS / Entitlements**
- manual mode не зависит от entitlement

**Performance / Stability**
- cache first, sync later
- error boundaries на ключевых экранах
