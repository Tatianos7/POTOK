# Phase 7.4 — Explainability & Trust DTO Contracts

## Базовый Explainability Bundle (DTO)
```
{
  source: string,              // сервис или слой, напр. "progressAggregatorService"
  version: string,             // версия логики / модели
  confidence: number,          // 0..1
  trust_score: number,         // 0..1
  decision_ref: string,        // ссылка/ключ решения
  safety_notes: string[],      // предупреждения, ограничения
  adaptation_reason?: string   // причина адаптации (если есть)
}
```

---

## DTO по экранам

### Today
**DTO:** `ExplainabilityBundle`  
**Контент:**
- why_today: decision_ref
- safety_notes: overload / pain guard
- adaptation_reason: если день адаптирован
**UI:** “Почему сегодня так?” → explainability drawer

### My Program
**DTO:** `ExplainabilityBundle`  
**Контент:**
- why_phase: decision_ref
- adaptation_reason: версионирование
**UI:** “Почему план изменился?” → history + rationale

### Progress
**DTO:** `ExplainabilityBundle`  
**Контент:**
- why_trend: decision_ref
- confidence
**UI:** “Почему такой прогресс?” → metric rationale

### Habits
**DTO:** `ExplainabilityBundle`  
**Контент:**
- why_habit: decision_ref
- trust_score
**UI:** “Почему это важно?” → микро-объяснение

### Paywall
**DTO:** `ExplainabilityBundle`  
**Контент:**
- why_locked: decision_ref
- safety_notes (если есть ограничения)
**UI:** “Почему доступ закрыт?” → value + gate reason

---

## Обязательные UI-ответы (микрокопия)
- “Почему сегодня так?” → decision_ref + confidence + safety_notes
- “Почему план изменился?” → adaptation_reason + decision_ref
- “Почему доступ закрыт?” → entitlement + value
- “Почему сейчас безопаснее замедлиться?” → safety_notes + trust_score

