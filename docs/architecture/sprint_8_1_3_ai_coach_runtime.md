# Sprint 8.1.3 — AI Coach Runtime & State Model

Цель: превратить Interaction Engine в исполняемую модель, которая живет в
приложении и управляет состояниями коуча в реальном времени.

## 1. Coach Runtime State Model
**CoachState**
- emotional_mode
- trust_level
- confidence_level
- fatigue_level
- relapse_risk
- motivation_level
- safety_flags
- last_events[]
- active_context (Today / Progress / Habits / Program / Paywall)
- user_mode (Manual / Follow Plan)
- subscription_state

## 2. Event DTO
Формат события: `type`, `timestamp`, `payload`, `confidence`, `safety_class`, `trust_impact`

**GoalCalculated**
- payload: `{ goal_id, goal_type, targets, horizon }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+1` (если цель валидна)

**DayCompleted**
- payload: `{ date, adherence, mood? }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+2`

**DaySkipped**
- payload: `{ date, reason?, streak_break? }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `-1`

**HabitBroken**
- payload: `{ habit_id, date, streak_lost }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `-1`

**HabitRecovered**
- payload: `{ habit_id, date, recovery_days }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+1`

**TrainingSkipped**
- payload: `{ date, reason?, fatigue? }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `-1`

**PlateauDetected**
- payload: `{ metric, period, slope }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `0`

**ProgressImproved**
- payload: `{ metric, delta, period }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+1`

**PainReported**
- payload: `{ area, severity, date }`
- confidence: `0..1`
- safety_class: `medical_risk`
- trust_impact: `0`

**FatigueReported**
- payload: `{ severity, date, duration? }`
- confidence: `0..1`
- safety_class: `caution`
- trust_impact: `0`

**PlanAdapted**
- payload: `{ from_version, to_version, reason }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+1`

**SubscriptionBlocked**
- payload: `{ feature, reason }`
- confidence: `1`
- safety_class: `normal`
- trust_impact: `-1`

**SubscriptionUpgraded**
- payload: `{ tier, date }`
- confidence: `1`
- safety_class: `normal`
- trust_impact: `+1`

**LongInactivity**
- payload: `{ days_inactive, last_active_date }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `-1`

**ReturnAfterPause**
- payload: `{ days_paused, return_date }`
- confidence: `0..1`
- safety_class: `normal`
- trust_impact: `+1`

## 3. Response DTO
Формат ответа коуча:
- coach_message
- emotional_tone
- ui_surface (card / nudge / dialog / banner / timeline_comment)
- explainability_ref
- trust_copy
- safety_copy
- cta (optional)
- memory_write (what to store)

## 4. Coach Memory Layers
- **Short term (session)**: текущий контекст и диалог.
- **Mid term (week / phase)**: ритм, фазы, устойчивость.
- **Long term (identity, patterns)**: цели, ценности, паттерны.
- **Safety memory**: боль, травмы, тревожные состояния.
- **Trust memory**: обещания, срывы, успехи.

## 5. Runtime Pipeline
Event → Context Builder → Emotional Mode Resolver → Safety Gate →
Response Generator → UI Surface Selector → Memory Update

## 6. Premium / Free Routing
- **Free**: короткий ответ, базовая explainability.
- **Premium**: полная история, альтернативы, контекст.
- **Teaser**: если контекст premium‑тяжелый, показываем “обрезанный” ответ и
  мягко предлагаем углубление.

## 7. Integration Points
- `uiRuntimeAdapter`
- `progressAggregatorService`
- `habitsService`
- `programGenerationService`
- `trustSafetyService`

## 8. E2E Scenarios (8.1.3)
- Пользователь сорвался → коуч поддержал → доверие выросло.
- Плато → объяснение без демотивации.
- Боль → safety mode.
- Успех → усиление уверенности.
- Отмена плана → бережный переход в Manual Mode.
- Возврат после паузы → восстановление мотивации.

## Минимальный TypeScript интерфейс CoachRuntime
```typescript
export type CoachEventType =
  | 'GoalCalculated'
  | 'DayCompleted'
  | 'DaySkipped'
  | 'HabitBroken'
  | 'HabitRecovered'
  | 'TrainingSkipped'
  | 'PlateauDetected'
  | 'ProgressImproved'
  | 'PainReported'
  | 'FatigueReported'
  | 'PlanAdapted'
  | 'SubscriptionBlocked'
  | 'SubscriptionUpgraded'
  | 'LongInactivity'
  | 'ReturnAfterPause';

export interface CoachEvent {
  type: CoachEventType;
  timestamp: string;
  payload: Record<string, unknown>;
  confidence: number;
  safety_class: 'normal' | 'caution' | 'medical_risk';
  trust_impact: -2 | -1 | 0 | 1 | 2;
}

export interface CoachState {
  emotional_mode: string;
  trust_level: number;
  confidence_level: number;
  fatigue_level: number;
  relapse_risk: number;
  motivation_level: number;
  safety_flags: string[];
  last_events: CoachEvent[];
  active_context: 'Today' | 'Progress' | 'Habits' | 'Program' | 'Paywall';
  user_mode: 'Manual' | 'Follow Plan';
  subscription_state: 'Free' | 'Premium' | 'Trial' | 'Grace' | 'Expired';
}

export interface CoachResponse {
  coach_message: string;
  emotional_tone: string;
  ui_surface: 'card' | 'nudge' | 'dialog' | 'banner' | 'timeline_comment';
  explainability_ref?: string;
  trust_copy?: string;
  safety_copy?: string;
  cta?: { label: string; action: string };
  memory_write?: Record<string, unknown>;
}

export interface CoachRuntime {
  getState(): CoachState;
  handleEvent(event: CoachEvent): CoachResponse | null;
}
```

## Файлы, которые будут созданы в `src/services/coach/*`
- `coachRuntime.ts` — главный runtime, обработчик событий.
- `coachState.ts` — модель состояния и редьюсер.
- `coachEvents.ts` — типы и конструкторы событий.
- `coachResponse.ts` — формат ответа и UI surface mapping.
- `coachMemory.ts` — слои памяти и правила записи.
- `coachSafety.ts` — safety gates и silent mode.
- `coachExplainability.ts` — ссылки и формат explainability.

## Основа для Sprint 8.1.4 — AI Coach UI Components Implementation
- определить UI‑контракты для `CoachCard`, `CoachNudge`, `CoachDialog`.
- описать data‑binding от `CoachResponse` к UI компонентам.
- подготовить Storybook/preview сценарии для Today + Progress.
