# Sprint 8.2.6 — Coach Decision Companion Layer

## Цель
Сделать коуча частью ключевых точек принятия решений, а не только реакцией на события.

## Decision Moments
- Смена цели
- Отказ от плана
- Длительный застой
- Перерыв > N дней
- Возврат после перерыва
- Сомнение в подписке

## Типы вмешательств
- Clarify — помочь понять
- Reframe — снять давление
- Encourage — поддержка
- Protect — безопасность
- Empower — вернуть контроль

## Runtime
### DecisionContext
```
decision_type
emotional_state
trust_level
history_pattern
user_mode (Manual / Follow Plan)
```

### API
`getDecisionSupport(context) → CoachDecisionResponse`

## UI точки
- GoalResult: «Вы уверены в цели?»
- MyProgram: «Продолжить / изменить / пауза»
- Progress: «Плато — что делаем?»
- Paywall: «Продлить / сделать паузу / уйти»
- Profile: «Сбросить / начать заново»

## Explainability
Для каждого решения:
- Почему сейчас
- На основе чего
- Какие альтернативы

## Premium логика
- **Free:** базовая поддержка без памяти и персонализации.
- **Premium:** история решений, паттерны, мягкое сопровождение.

## E2E 321–340
См. `docs/architecture/e2e_matrix_v2.md`.

## DoD
- Коуч присутствует в точках выбора.
- Не давит, возвращает контроль.
- Объясняет логику.
- Соблюдает safety и autonomy.
