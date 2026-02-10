# Sprint 8.3 — Production Hardening & Observability Layer

Цель: сделать AI‑Coach и Runtime контур полностью production‑ready для публичного MVP, не меняя UX/поведение и не добавляя новых фич. Только стабильность, деградация, контроль, метрики и release‑готовность.

## 1) Архитектурные слои

### Observability
- Единый лёгкий телеметрический слой для событий, таймингов и деградации.
- Только тех‑сигналы (без персональных данных).
- Совместимость с будущими экспортами в PostHog / Amplitude.

### Feature Flags
- Централизованные флаги включения/отключения AI‑слоя и его модулей.
- Должны уважаться в `uiRuntimeAdapter` и `coachRuntime`.

### Graceful Degradation
- Любая ошибка памяти/объяснимости/таймаута → безопасный fallback.
- Никаких `throw` в UI‑слое.
- Fallback: поддержка без персонализации и без зависимости от памяти.

### Performance Budgets
- overlay < 50ms
- response < 300ms
- memory < 150ms
- explainability < 200ms
- При превышении — предупреждение телеметрии и fallback lightweight.

### Kill Switch
- Экстренное отключение коуча:
  - env: `POTOK_DISABLE_COACH`
  - localStorage: `POTOK_DISABLE_COACH`
- При активном kill‑switch: коуч полностью bypass, без UI‑ошибок.

### Privacy Controls
- Телеметрия без персональных данных.
- Память хранит только минимальные payload‑сигналы.
- TTL/очистка/сброс реально освобождают память.

### Rollout Strategy
- Пошаговая активация через feature flags.
- Возможность мгновенного отката (kill switch).
- Мягкая деградация при нестабильности источников данных.

## 2) Observability — CoachTelemetryEvents

События:
- `coach_overlay_shown`
- `coach_response_generated`
- `coach_response_time`
- `coach_memory_hit`
- `coach_memory_miss`
- `coach_explainability_opened`
- `coach_user_ignored`
- `coach_user_requested`
- `coach_decision_support_used`
- `coach_error`
- `coach_timeout`
- `coach_fallback_used`

Принцип: не логируем user_id, email, имя, сообщения или контент диалогов.

## 3) Feature Flags

Флаги:
- `coach_enabled`
- `coach_voice_enabled`
- `coach_dialog_enabled`
- `coach_memory_enabled`
- `coach_decision_support_enabled`

Контракты:
- Если флаг выключен → компонент/ответ отсутствует полностью.
- Никаких runtime‑ошибок, только безопасный silent‑fallback.

## 4) Graceful Degradation

Сценарии:
- Память недоступна → support‑only, без персонализации.
- Explainability упала → UI работает без “почему”, без краша.
- Timeout runtime → safe response без сложной логики.

Запрет:
- Не бросать исключения из UI‑слоя.

## 5) Performance Budget

Бюджеты и реакции:
- Response > 300ms → fallback + telemetry warning.
- Explainability > 200ms → fallback + telemetry warning.
- Overlay > 50ms → telemetry warning.

## 6) Kill Switch

- При `POTOK_DISABLE_COACH=true`:
  - `coachRuntime` возвращает `null`
  - `uiRuntimeAdapter` не вызывает коуча
  - UI остаётся полностью работоспособным

## 7) Privacy / Compliance

- Никаких персональных данных в telemetry.
- TTL и очистка памяти реально удаляют данные.
- Сброс trust‑модели не затрагивает прогресс пользователя.

## 8) Definition of Done (Phase 8.3)

AI‑Coach:
- нельзя сломать
- нельзя зависнуть
- можно отключить
- можно откатить
- можно измерять
- не блокирует UX

Релиз:
- готов к публичному MVP без архитектурных изменений.
