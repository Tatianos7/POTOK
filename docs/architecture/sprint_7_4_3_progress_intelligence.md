# Sprint 7.4.3 — Progress Intelligence (Architecture, Calm Power Coach)

## Цель
Progress — не просто графики, а «эмоциональный интеллект» продукта:
- показывает траекторию пользователя,
- объясняет «почему сейчас так»,
- поддерживает устойчивость без давления.

---

## 1) Progress как Life Timeline

### Этапы
- старт → рост → плато → восстановление → новый рост

### События
- переломы (shift in trend)
- плато
- фазы восстановления
- рост силы и выносливости

---

## 2) Метрики ядра

- Вес (EMA + slope)
- Объем тренировки (volume trend)
- КБЖУ (ккал, белки, жиры, углеводы)
- Белок (sufficiency)
- Привычки (streak / adherence)
- Энергия / восстановление (proxy)
- Соблюдение плана (program_sessions)

---

## 3) Insight Engine

### Типы инсайтов
- перегруз
- недоедание
- стагнация
- восстановление
- стабильность

### Пример
> «3 дня подряд ниже белка → риск отката восстановления»

---

## 4) Explainability UI

Для каждой метрики:
- «почему сейчас так»
- «что изменилось»
- «на что опереться»

Explainability bundle включает:
- decision_ref
- data_sources
- confidence
- safety_notes
- trust impact

---

## 5) Эмоциональные состояния (Calm Power Coach)
- уверенность: «ты в ритме»
- усталость: «время восстановиться»
- откат без вины: «ты не потерял прогресс»
- возвращение: «твой ритм возвращается»

---

## 6) Premium‑ценность
- интерпретация и прогноз
- объяснения без давления
- персональная поддержка вместо «барьера»

---

## 7) Data Contracts

### Reads
- `measurement_history`
- `food_diary_entries`
- `workout_entries`
- `habit_logs`
- `user_goals`
- `program_sessions`

### Writes
- `progress_snapshots`
- `progress_trends`
- `report_snapshots`

---

## 8) Offline / Recovery
- offline cached snapshot
- safe retry
- partial data tolerant

---

## 9) Trust & Safety
- недостаток данных → сниженная уверенность (confidence)
- предупреждения без стыда
- пояснение, что метрики примерные

---

## 10) Explainability Bundles
Для каждого инсайта:
- decision_ref
- data_sources
- confidence
- trust impact

---

## 11) Integration with Coach Layer
- Coach использует прогресс как основу диалогов
- поддержка при плато и усталости

---

## 12) E2E сценарии (новые)
Добавить в `e2e_matrix_v2.md`:
- 217: EMA веса корректно отображается
- 218: Объём тренировок даёт slope тренд
- 219: Недоедание → инсайт + explainability
- 220: Плато → мягкий коуч‑инсайт
- 221: Соблюдение плана → положительный прогноз
- 222: Offline snapshot → no white screen

---

## 13) Implementation Backlog (без кода)
1. Progress insight service
2. Explainability UI layer
3. Coach‑ready summaries
4. Premium‑интерпретация и прогноз
