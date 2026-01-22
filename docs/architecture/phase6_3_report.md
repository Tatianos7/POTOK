# Phase 6.3 Report — Edge AI + Vision Pro Spatial Coach

## Архитектурное резюме
- Edge pipeline: on‑device pose → angles → biomechanics → guard → realtime cues.
- Cloud pipeline: explainability, long‑term learning, analytics sync.
- Vision Pro spatial layer: anchors (knees/hip/spine/bar path), risk zones, spatial audio.

## Safety & Trust Guarantees
- Guard v1–v3: risk classification (safe/caution/danger), hard stop on danger.
- Spatial risk zones: knee collapse cone, lumbar shear plane, danger field.
- Trust‑adaptive silence: coaching muted on low trust or high risk.
- Offline safety: on‑device guard continues without network.

## Latency Budget
- 2D inference: < 60ms
- 3D reconstruction: < 80ms
- Voice cue pipeline: < 50ms
- Spatial overlay: 60fps target, motion‑to‑photon < 20ms

## Entitlement Split
- Free: post‑analysis only
- Pro: realtime 2D + voice
- Vision Pro: realtime 3D + spatial overlay + spatial voice

## E2E Coverage (45–55)
- 45 On‑device inference without internet
- 46 Safety stop offline
- 47 Vision Pro spatial cue
- 48 Latency under 100ms
- 49 Entitlement gating edge mode
- 50 Trust‑adaptive silence on device
- 51 Battery‑safe degradation
- 52 Cloud sync after session
- 53 Explainability from on‑device logs
- 54 Guard override blocks coaching
- 55 Pro vs Vision Pro capability split

## Production Readiness Checklist
- VisionOS performance budget verified
- Audio spatialization hooks ready
- Privacy: no video storage, vectors only
- RLS enforced on all pose data
- Entitlement gating validated
- App Store compliance: non‑medical coaching

## Технологические риски и ограничения
- Depth proxy limits without calibration
- 3D accuracy variance across devices
- Thermal throttling on long sessions
- Legal: explicit non‑medical disclaimers required

