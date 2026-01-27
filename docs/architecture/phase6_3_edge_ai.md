# Phase 6.3 — On-device AI Coach & Vision Pro Mode

## 1. Архитектура Edge‑Inference
**Разделение пайплайна:**
- **On‑device:** pose → angles → biomechanics → guard → basic cues
- **Cloud:** explainability, long‑term learning, analytics, отчёты

**Модели:**
- 2D/3D pose (MediaPipe → CoreML/TFLite)
- Angle regression
- Guard classifier

**Latency budget:**
- Inference < 60ms
- End‑to‑end < 100ms

---

## 2. On‑device Safety Layer
**Guard v4:**
- stop
- reduce load
- rest
- asymmetry correction

**Правила:**
- Hard‑block AI при `danger`
- Локальный fallback при отсутствии сети

---

## 3. Voice Coach on Device
- Локальный TTS (iOS/Android/Vision Pro)
- Очередь приоритетов: safety > fatigue > technique > motivation
- Spatial audio для Vision Pro

---

## 4. Vision Pro Mode
- Пространственные векторы
- 3D‑скелет
- Направляющие в пространстве
- AR‑подсказки по траектории

---

## 5. Entitlement & Privacy
- Free: post‑analysis only
- Pro: realtime 2D + voice
- Vision Pro: realtime 3D + spatial coach
- Никакого хранения видео, только векторы

---

## 6. E2E Scenarios (45–55)
- 45: On‑device inference without internet
- 46: Safety stop offline
- 47: Vision Pro spatial cue
- 48: Latency under 100ms
- 49: Entitlement gating edge mode
- 50: Trust‑adaptive silence on device
- 51: Battery‑safe degradation
- 52: Cloud sync after session
- 53: Explainability from on‑device logs
- 54: Guard override blocks coaching
- 55: Pro vs Vision Pro capability split
