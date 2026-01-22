# Sprint 6.1 — Pose Engine v1 (2D Real‑Time Technique Analysis)

## Sprint Goal
Запустить архитектурно‑готовый контур 2D‑позы: live‑скелет → углы → валидация техники → safety‑guard → entitlement‑gate → коучинг.

## Scope
- Real‑time 2D pose detection (on‑device + server hybrid)
- Расчёт joint vectors + joint angles
- Template‑validation техники по упражнению
- Confidence gating + safety override
- Entitlement gating:
  - Pro / Vision Pro → realtime overlay
  - Free → post‑analysis без live‑overlay

## Out of Scope
- 3D lift analysis
- Персонализированные biomech‑профили
- История травм как часть медицинского анализа
- Полный voice‑assistant с TTS

## Dependencies
- Phase 5 entitlements (plan gating)
- Phase 2.2 canonical exercises
- Phase 3 `user_state`

## Latency Budget
- Target end‑to‑end frame loop: **< 120ms**

## Privacy Guarantees
- Нет хранения raw video
- Только вектора, углы, агрегаты
- On‑device inference приоритетен

## Safety Model
- Injury‑risk guard overrides coaching
- Low confidence → suppression
- Safety warnings only (no diagnostics)
