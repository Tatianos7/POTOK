# Sprint 7.1.2 — Normalization & Deduplication Layer (Architecture Mode)

## 1. Цель слоя
- Устранение дублей (продукты, упражнения, бренды, синонимы).
- Приведение к каноническим единицам, нутриентам, мышцам.
- Обнаружение конфликтов данных (калории, БЖУ, техника, безопасность).

## 2. Normalization Pipeline

### Text normalization
- Языки: RU/EN + locale‑aware rules.
- Бренды: canonical brand family + alias map.
- OCR‑шум: удаление мусора, нормализация цифр и единиц.

### Unit normalization
- Приведение к g/ml/serving.
- Density conversion (объём → масса).
- Canonical serving size per product.

### Nutrition normalization
- Единый базис: per 100g + per serving.
- Raw/cooked mapping через loss factors.
- Macro bounds guard + suspicious flag.

### Biomechanics normalization
- ROM в процентах от шаблона.
- Паттерны движений и плоскости (sagittal/frontal/transverse).
- Нормализация техники по template‑ID.

## 3. Deduplication & Merge Logic

### Fuzzy matching
- Name/brand similarity + macros distance + structure match.
- Confidence scoring (0–1) на основе источника и совпадений.

### Merge strategies
- Auto‑merge: высокий confidence + trusted source.
- Human review: medium confidence или конфликтные нутриенты.
- AI‑assisted arbitration: подсказка, но финал — модератор.

### Golden record selection
- Приоритет: trusted > community > AI‑extracted.
- История слияния сохраняется как lineage.

## 4. Safety & Guard Layer
- Блокировка небезопасных данных до канонизации.
- Аномалии: нереальные БЖУ, травмоопасные ROM.
- Медицинские конфликты: аллергии, противопоказания.

## 5. AI‑контракты
- AI получает: confidence, source_rank, verification_level.
- Explainability указывает источник и уровень доверия.
- Guard использует нормализованные эталоны и противопоказания.

## 6. Versioning & Re‑processing
- При обновлении канона: re‑index + re‑embed + re‑rank.
- Deterministic re‑ingestion по `input_hash`.
- Rollback возможен на предыдущую `nutrition_version`.

## 7. E2E расширение
- 61 Ambiguous food resolution
- 62 Unsafe exercise blocked
- 63 Conflicting macros merge
- 64 Brand vs generic resolution
- 65 Medical contraindication override

## 8. Definition of Done
- Определены правила нормализации и дедупликации.
- Определён human‑in‑the‑loop контур.
- AI/Pose/Reports/Coaching контракты подтверждены.
- Импорт реальных баз возможен без изменения архитектуры.

## Переход: Architecture → Live Knowledge Platform
- Freeze нормализаторов v1.
- Включить импорт реальных датасетов.
- Ввести QA gates (sampling + anomaly review).
- Запустить мониторинг качества знаний.

