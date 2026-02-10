# Sprint 8.2 — Coach Explainability History

## Цель
Сделать explainability продуктовой функцией: не одноразовый drawer, а история решений и причин по времени.

## Продуктовая форма
История решений отвечает на:
- «Почему в этот день коуч вмешался»
- «Почему снизил нагрузку»
- «Почему изменил тон»

## API прототип
```ts
export interface CoachDecisionHistoryItem {
  decisionId: string;
  timestamp: string;
  screen: 'Today' | 'Progress' | 'Habits' | 'Program' | 'Paywall';
  decisionType: string;
  summary: string;
  trustLevel?: number;
  emotionalState?: string;
  safetyFlags?: string[];
  explainabilityRef?: string;
}

export interface CoachDecisionHistoryQuery {
  from: string; // ISO
  to: string;   // ISO
  screen?: CoachDecisionHistoryItem['screen'];
}

export type GetCoachDecisionHistory = (
  query: CoachDecisionHistoryQuery
) => Promise<CoachDecisionHistoryItem[]>;
```

## Источники данных
- `coachRuntime` (decision_id)
- `coachMemoryFacade` (trace + memory refs)
- `uiRuntimeAdapter` (screen context)

## UX правила
- Показ в `Profile` в виде списка.
- Без перегруза: 1–3 причины, одна ключевая.
- Если explainability недоступна — fallback: «Сейчас без деталей».

## Ограничения
Не менять:
- Explainability API
- Memory schema
- Runtime pipeline

## Definition of Done
- Документ описывает API и UX.
- Готова основа для реализации истории решений.
