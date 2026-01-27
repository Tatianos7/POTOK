# Sprint 7.2.2 — Adaptation & Safety Layer (Architecture)

## Goal
Сделать слой динамической адаптации программ питания/тренировок с безопасным re‑plan, объяснимостью v4 и guard‑ограничениями поверх программ.

## Scope
- Пересчёт программ при: изменении веса, пропусках дней, переутомлении, снижении trust_score, обновлении knowledge_version.
- Safety слой поверх программ: авто‑деинтенсификация, stop‑conditions, мед‑ограничения.
- Feedback‑loop: дневники питания/тренировок, прогресс, привычки, поза.
- Explainability v4: причины адаптаций и дневных решений.

## Domain Events
- `plateau_detected`: плато по весу/объёму/силовым.
- `fatigue_spike`: резкий рост утомления/снижение темпа.
- `adherence_drop`: пропуски/низкая комплаентность.
- `risk_flag`: травмоопасные сигналы/медицинские ограничения.
- `trust_drop`: trust_score ниже порога.
- `knowledge_version_bump`: обновление KB версии.

## Adaptation Rules
1. **Plateau** → micro‑adjustments (±5–10% калорий/объёма) + обновление целей недели.
2. **Fatigue spike** → deload‑инъекция (1–3 дня) или сокращение объёма.
3. **Adherence drop** → упрощение плана и снижение глубины объяснений.
4. **Trust drop** → уменьшение глубины и частоты изменений (replan cooldown).
5. **KB update** → safe re‑plan с versioning и diff‑explainability.

## Safety Rules
- **Hard stop** при `risk_flag= danger`: блокировка прогрессирующих действий.
- **Auto‑deintensify** при fatigue/overload: −10–20% объёма/калорий.
- **Medical override**: абсолютный запрет несоответствующих продуктов/нагрузок.
- **Graceful pause**: при череде пропусков → пауза + maintenance.

## Trust & Confidence Interaction
- `trust_score < 40` → plan_depth=`basic`, упрощённые паттерны.
- `effective_confidence < 0.60` → guard‑блок или safe‑mode.
- Чем ниже trust/confidence, тем меньше агрессивность и частота адаптаций.

## Replan Strategies
- **Micro**: дневные/недельные корректировки макро‑целей.
- **Meso**: инъекция deload/recovery блока.
- **Macro**: перегенерация программы с новым горизонтом и версией.

## Explainability Contracts (v4)
Каждая адаптация должна фиксировать:
- `reason_code` (plateau|fatigue|adherence|risk|trust|kb_update)
- `input_context` (метрики, дневники, поза, trust, confidence)
- `diff_summary` (что изменилось)
- `safety_notes` (guard/fallback)
- `knowledge_refs` (версия KB и confidence)

## E2E Scenarios (83–95)
См. `docs/architecture/e2e_matrix_v2.md`.

## Definition of Done
- События адаптации определены и связаны с входными данными.
- Правила re‑plan и safety‑слой зафиксированы.
- Explainability v4 описана и контрактирована.
- E2E 83–95 добавлены.
- Готов переход в Implementation Mode.
