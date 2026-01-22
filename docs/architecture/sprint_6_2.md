# Sprint 6.2 — 3D Biomechanics & Depth Estimation (Planning)

## Sprint Goal
Расширить Pose Engine до 3D‑биомеханики: глубина, траектории, скорости/мощность, 3D‑асимметрия и безопасный guard‑контур с device/entitlement gating.

## Scope
- 3D Pose Pipeline (2D→3D реконструкция, ARKit/LiDAR, Vision Pro track)
- 3D‑координаты суставов в мировом пространстве
- Biomechanics Engine: torque proxies, moment arms, spine shear/compression proxy
- Depth & Load Estimation: depth, velocity, acceleration, power
- Asymmetry & compensation detection (left/right, hip shift, knee shift)
- Safety Layer v2: risk score + red/yellow/green
- AI Coach 3D: spatial cues + voice + 3D vectors
- Entitlement & device gating:
  - Vision Pro → realtime 3D overlay
  - Pro → 3D post‑analysis
  - Free → 2D summary only

## Out of Scope
- Полная медицинская диагностика
- Биомеханика уровня клиники
- 3D моделирование тела в облаке

## Dependencies
- Phase 5 entitlements
- Phase 6.1 2D pipeline
- Device capabilities (ARKit/LiDAR/Vision Pro)
- Phase 3 user_state + trust_score

## Latency / Performance
- Realtime 3D overlay: target < 160ms
- Post‑analysis: ≤ 2 min per session

## Privacy Guarantees
- No raw video storage
- Only vectors / 3D coordinates / aggregates
- On‑device processing preferred

## Safety Model (v2)
- Risk score 0–1
- Red: блок коучинга
- Yellow: корректировка
- Green: допустимая техника

## Definition of Done
- 3D pose pipeline spec утверждён
- Biomechanics engine spec утверждён
- Depth/load estimation spec утверждён
- Safety v2 rule set утверждён
- Entitlement/device gating описаны
- E2E scenarios 31–38 добавлены в матрицу
- Roadmap обновлён
