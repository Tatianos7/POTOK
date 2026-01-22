# Sprint 7.3.3.1 — Onboarding & First Program UX (Architecture)

## Goal
Запустить UX‑контур первого опыта: onboarding → goal → program → today.

## Screen Scenarios
- Создание цели
- Выбор плана
- Первый день
- Экран “Сегодня”

## Screen Details
### Onboarding (90 секунд до “вау”)
- **Safety first**: короткий дисклеймер “не мед. совет” + guard‑first подход.
- **Personalization**: 3 ключевых вопроса (цель, частота, ограничения).
- **Value explain**: “план на сегодня за 1 минуту”.
- **Soft camera/voice ask**: объяснить пользу, дать пропустить, не блокировать.

### Today (главный центр)
- Карточка дня: план + статус + причина (why_today).
- Быстрые действия: start / complete / skip.
- Мини‑feedback: energy / difficulty / motivation.

### My Program
- Timeline фаз/блоков.
- Текущая версия + короткий diff.
- История адаптаций (why_changed).

## Contracts
- `programDeliveryService` (day + plan)
- `programUxRuntimeService` (state + offline)
- `entitlementService` (gating)
- `poseEngine` readiness hooks (Vision Pro)

## E2E Scenarios (141–150)
- 141: Onboarding завершён → goal saved
- 142: Goal → Program generation
- 143: Today screen opens
- 144: First workout logged
- 145: First food day completed
- 146: First feedback submitted
- 147: First adaptation triggered
- 148: First progress view
- 149: Paywall shown when locked
- 150: First explainability shown

## Definition of Done
- First‑run flow documented end‑to‑end.
- Contracts validated for Today/Program.
- E2E 141–150 defined.

## Planning Notes (UX Focus)
### First “Wow” Experience
- В течение первых 60–90 секунд пользователь видит персональный план на сегодня.
- Минимум полей при вводе цели, максимум уверенности (trust‑safe copy).
- Первый успех: отметка «выполнено» с мягким поощрением.

### Trust & Emotion
- Низкий trust → меньше советов, больше ясности.
- Safety‑first: при рисках — короткое объяснение и ясное действие.

### UX Path (happy)
Onboarding → Goal Setup → Program Ready → Today → First Action → Feedback → Insight.
