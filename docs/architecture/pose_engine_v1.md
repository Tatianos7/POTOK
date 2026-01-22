# Phase 6 — Vision Coach (Pose Engine v1)

## Goal
Integrate computer vision + biomechanics into the training loop: camera → skeleton → joint angles → technique assessment → injury‑risk guard → AI coaching.

---

## 6.1 Domain — Pose & Biomechanics

### Tables
- `pose_sessions`
  - `id`, `user_id`, `workout_entry_id`, `canonical_exercise_id`, `started_at`, `ended_at`, `device_info`, `created_at`
- `pose_frames`
  - `id`, `pose_session_id`, `frame_index`, `ts`, `quality_score`, `created_at`
- `pose_joints`
  - `id`, `pose_frame_id`, `joint_name`, `x`, `y`, `z`, `confidence`, `created_at`
- `pose_angles`
  - `id`, `pose_frame_id`, `angles` (jsonb), `created_at`
- `pose_quality_scores`
  - `id`, `pose_session_id`, `pose_quality_score`, `stability_score`, `symmetry_score`, `tempo_score`, `created_at`
- `pose_guard_flags`
  - `id`, `pose_session_id`, `flag_type`, `severity`, `details`, `created_at`
- `pose_feedback_events`
  - `id`, `pose_session_id`, `event_type`, `message`, `confidence`, `created_at`

### Relationships
- `pose_session` → `workout_entries`
- `pose_session` → `canonical_exercise_id`
- `pose_session` → `user_state`
- `pose_session` → `ai_coaching_events`

### RLS
- All pose tables are user‑scoped via `pose_sessions.user_id`.
- Child tables use `EXISTS` join against `pose_sessions`.

---

## 6.2 Pose Capture Pipeline

1) **Camera** → on‑device capture
2) **Keypoints** → skeleton joints with confidence
3) **Angles** → joint angles, ROM, tempo
4) **Symmetry** → left/right deviation
5) **Velocity** → tempo stability
6) **Guard** → risk flags (limits, asymmetry, low confidence)
7) **Coaching** → feedback if guard passes

---

## 6.3 CV Stack

### Layers
- **On‑device pose estimation:** MediaPipe / MoveNet
- **Biomechanics engine:** ROM, joint chains, tempo, symmetry
- **Guard layer:** injury risk, instability, overload
- **Coaching layer:** real‑time + post‑set feedback

### Guard Signals
- Joint angle limits per exercise
- Asymmetry thresholds
- Instability / wobble detection
- Tempo deviations (too fast, uncontrolled)

---

## 6.4 UX (Conceptual)
- Camera view + skeleton overlay
- Green = within biomechanical bounds
- Yellow = borderline
- Red = violation / risk
- Voice AI coach for immediate cues

---

## 6.5 AI Integration

### Input Context Additions
- `joint_angle_deviation`
- `asymmetry_index`
- `stability_score`
- `fatigue_pattern`
- `pose_quality_score`

### Linked Systems
- `ai_guard` (risk suppression)
- `ai_trust_scores` (confidence adjustments)
- `ai_coaching_events` (realtime + post‑set)
- `gamification` (perfect‑form streak)
- `notifications` (Phase 4.3 triggers)

---

## Privacy & On‑Device Constraints
- No raw video storage
- Only joint vectors, angles, and aggregate scores
- On‑device inference preferred; server receives vectors only

---

## Guardrails & Safety
- No unsafe coaching without guard pass
- Suppress advice if confidence < threshold
- Safety override beats coaching
- No medical diagnosis content

---

## Roadmap Split
- **6.1 2D Pose** (skeleton + basic guard)
- **6.2 3D Lift Analysis** (depth + load inference)
- **6.3 Real‑time Coaching** (low latency, voice)

---

## Monetization Hooks (Pro / Premium)
- Advanced form analysis
- Personalized biomechanical corrections
- Long‑term technique trends
- Real‑time voice coaching

---

## Entitlement Gating (Phase 5)
- **Realtime Pose**: только Pro / Vision Pro
- **Post‑analysis**: доступно Free (с задержкой, без оверлея)
- **Coaching confidence**: масштабируется по `trust_score` + entitlement
- **Safety override**: всегда сильнее коучинга

---

## Sprint 6.1 Execution Layer (Architecture)

### Domain Tables (Spec Only)
- `pose_sessions`
- `pose_frames` (vectors, angles, confidence; no pixels)
- `pose_joints`
- `pose_deviations`
- `pose_feedback_events`

### Service Contracts
- `poseService.startSession()`
- `poseService.processFrame()`
- `poseGuardService.evaluateSafety()`
- `aiPoseCoachService.generateCue()`
- `entitlementService.canRealtimePose()`

### Pipeline
Camera → BlazePose/MediaPipe → Joint Vectors → Angle Engine → Template Matcher → Guard → Entitlement Gate → Coaching

### Entitlement Integration
- Feature flag: `realtime_pose_overlay`
- Plan gating: Pro / Vision Pro
- Free: post‑analysis only (no live overlay)
- Ethical rule: no upsell during injury risk or high fatigue

---

# Pose Engine v2 — 3D Biomechanics & Depth

## 3D Pose Pipeline
- MediaPipe 3D / OpenPose / ARKit / LiDAR (Vision Pro track)
- 2D → 3D реконструкция (калибровка камеры)
- Суставы в мировом пространстве (X/Y/Z)

## Biomechanics Engine
- Joint torque proxy
- Moment arms estimation
- Spine shear / compression proxy
- 3D knee valgus
- Hip hinge correctness
- Bar path (если есть снаряд)

## Depth & Load Estimation
- Depth (camera/LiDAR)
- Velocity, acceleration
- Force proxy (mass × accel)
- Power curve
- RPE inference (proxy)

## Asymmetry & Compensation
- Left/right imbalance
- Hip shift
- Knee shift
- Dominant side compensation

## Safety Layer v2
- Risk score (0–1)
- Red zone → coaching blocked
- Yellow → corrective cues
- Green → optimal form

## AI Coach 3D
- Spatial cues + voice
- 3D vectors of correction
- Trust‑adaptive frequency

## Entitlement & Device Gating
- Vision Pro: realtime 3D overlay
- Pro: 3D post‑analysis
- Free: 2D summary only
