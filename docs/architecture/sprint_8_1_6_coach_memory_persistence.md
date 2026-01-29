# Sprint 8.1.6 — AI Coach Memory Persistence & Learning Loop

Цель: сделать долговременную память коуча реальной: сохраняемой в БД, обновляемой
со временем и влияющей на тон, решения и рекомендации.

## Слой хранения памяти
**Таблицы**
- `coach_memory_events`
- `coach_emotional_state`
- `coach_trust_timeline`
- `coach_relationship_profile`
- `coach_goal_history`

**Связи**
- `user_id` — обязательная привязка.
- `date` / `created_at` — линия времени.
- `confidence` — уровень уверенности.
- `safety_class` — безопасность.
- `explainability_ref` — ссылка на объяснение.

## Learning Loop
Event → Interpretation → Memory Update → Trust Update → Tone Shift → Future Response Bias

## Политики обновления
- **decay доверия**: мягкое снижение при отсутствии прогресса.
- **рост уверенности**: при устойчивых паттернах.
- **recovery после срыва**: доверие восстанавливается постепенно.
- **долгосрочные паттерны**: consistency, volatility, resilience.

## Интеграция с Runtime
- `coachMemoryService` (8.1.5)
- `coachRuntime` (8.1.3)
- `uiRuntimeAdapter` (Phase 7)

## Explainability
Каждое решение коуча должно уметь сказать:
“Я это советую, потому что в твоей истории…”

## Definition of Done
- Есть физическая модель хранения памяти.
- Описан learning loop.
- Есть сервисный слой.
- Есть explainability памяти.
- Готово к Phase 8.2 (Voice / Vision / Embodied Coach).
