# Sprint 8.2 — Coach User Control (Phase 8.2)

## Цель
Довести поведенческий слой коуча до продуктового качества через управляемость, предсказуемость и уважение к границам пользователя. Без новых "умных" функций: только контроль частоты, режимы вмешательств и прозрачность.

## Принципы
- Не навязывать: вмешательство только когда это уместно.
- Прозрачность: понятно, почему коуч реагирует.
- Управляемость: пользователь может включить/выключить коуча и выбрать режим.
- Без изменения UI‑Kit и core runtime pipeline.

## 1. Intervention Policy (поведенческая политика)
В `coachRuntime` добавляется политика вмешательств.

### DTO
```ts
export interface CoachInterventionPolicy {
  maxNudgesPerDay: number;
  minIntervalMinutes: number;
  respectUserSilence: boolean;
}
```

### Runtime‑поля
- `daily_nudge_limit`
- `cooldown_after_ignore`
- `silent_mode`

### Поведение
- Если превышен дневной лимит — коуч молчит.
- Если пользователь игнорирует нуджи, включается cooldown.
- `silent_mode` выключает автоматические nudges, оставляя только реакции на риск (если не запрещено).

## 2. User Control (Profile → Coach Settings)
Расширяем `Profile` без новых экранов.

### Переключатель
`Коуч включён` (on/off).

### Режимы
- **Поддержка** (default)
- **Только по запросу**
- **Только при риске**
- **Выключен**

### Влияние
`uiRuntimeAdapter.getCoachOverlay()` должен учитывать режим:
- Поддержка: обычная логика.
- Только по запросу: overlay не показывать.
- Только при риске: только safety‑режим.
- Выключен: вообще нет overlay.

## 3. Ограничения
Не менять:
- E2E сценарии
- Memory schema
- Runtime pipeline
- UI‑Kit
Не добавлять новые экраны.

## 4. Integration Points
- `Profile` → настройки `Coach Settings`.
- `uiRuntimeAdapter.getCoachOverlay()` → respect policy.
- `coachRuntime` → enforcement policy и silent mode.

## 5. Definition of Done
- Добавлен DTO `CoachInterventionPolicy`.
- Реализован контроль частоты и silent mode.
- Profile управляет режимами коуча.
- Overlay учитывает настройки пользователя.
- UX не меняется, только становится предсказуемым.
