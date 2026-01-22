# Sprint 6.3.1 — Edge Pose & Guard

## Step 1: Edge Pose & Guard

### Scope
- On‑device pose inference (2D/3D)
- On‑device angles + biomechanics
- Guard v4 (stop / reduce load / rest / asymmetry)
- Offline fallback (no cloud dependency)

### Definition of Done
- End‑to‑end latency < 100ms
- Guard v4 работает локально
- No raw video storage
- Trust + entitlement gates соблюдены

### Performance KPIs
- Inference < 60ms
- Frame loop < 100ms median
- Battery degradation < 20% baseline

### Safety KPIs
- 100% блокировка coaching при `danger`
- Safety stop < 200ms latency

### Privacy KPIs
- 0 raw video persisted
- Only vectors + metrics stored
