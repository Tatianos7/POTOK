# Sprint 8.1.4 — AI Coach UI Components Implementation

Цель: реализовать визуальный и интерактивный слой коуча в UI, используя
runtime из `sprint_8_1_3_ai_coach_runtime.md` и дизайн‑язык Calm Power Coach.

## 1. Базовые UI‑компоненты коуча
- **CoachMessageCard** — карточка с тоном забота/уверенность/безопасность.
- **CoachTimelineComment** — комментарий в таймлайне Progress.
- **CoachDailyNudge** — мягкое утреннее/вечернее напоминание в Today.
- **CoachRecoveryDialog** — диалог после срыва/возврата.
- **CoachSafetyBanner** — баннер боли/переутомления/риска.
- **CoachExplainabilityPanel** — “Почему я это советую”.
- **CoachMemoryChip** — короткая память (“я помню, что помогло…”).

## 2. Эмоциональные режимы отображения
Связь с `emotional_mode` из runtime:
- **support** — спокойная поддержка
- **motivate** — мягкая энергия, без давления
- **stabilize** — замедление и выравнивание
- **protect** — безопасность и пауза
- **celebrate** — тихая радость
- **guide** — ясный, уверенный курс
- **reframe** — переосмысление без обесценивания

Для каждого режима:
- цветовая подложка
- иконка
- микрокопия
- анимация (спокойная, не агрессивная)

## 3. Точки появления коуча (экранные интеграции)
- **Today**: утро, вечер, пропуск, усталость.
- **Progress**: плато, рост, спад.
- **Habits**: стрик, срыв, восстановление.
- **My Program**: объяснение адаптаций.
- **Paywall**: бережный апселл.
- **Onboarding**: формирование доверия.

## 4. Explainability UI
Показываем человеческое объяснение:
- источники данных (Goals, Habits, Progress, Programs)
- confidence (уровень уверенности)
- trust level (как влияет доверие)
- safety flags (почему коуч осторожен)

Форма: панель с ясной фразой и короткими маркерами, не “лог”.

## 5. State → UI Mapping
Связка: `CoachState + Event → UI Component + Tone + CTA`.
Примеры:
- `PainReported` + `protect` → `CoachSafetyBanner` + CTA “Снизить нагрузку”.
- `PlateauDetected` + `reframe` → `CoachMessageCard`.
- `DaySkipped` + `support` → `CoachRecoveryDialog`.

## 6. Premium / Free UX
- **Free**: короткие supportive фразы, без глубокой персонализации.
- **Premium**: диалоги, история, долгосрочная память, реакции плана.

## 7. Минимальный React‑слой (заготовки)
```
src/ui/coach/
  CoachMessageCard.tsx
  CoachNudge.tsx
  CoachSafetyBanner.tsx
  CoachExplainability.tsx
  CoachTimelineComment.tsx
  CoachDialog.tsx
  coachStyles.ts
  coachAnimations.ts
```

## 8. E2E 8.1.4
- Усталость → `CoachSafetyBanner`.
- Срыв привычки → `CoachRecoveryDialog`.
- Прогресс → `CoachCelebrateCard`.
- Плато → `CoachReframeMessage`.
- Отмена плана → `CoachSupport` + выбор пути.
- Возврат после паузы → `CoachWelcomeBack`.

Тон: Calm Power Coach. Никакого давления и “ты должен”.
