# Roadmap Extension — Phase 4.3 → Phase 5 → Phase 6

## Phase 4.3 — Smart Notifications & Retention Intelligence

### Подфазы
- **4.3.1 Notification Intelligence (Core)**
- **4.3.2 AI Priority & Timing**
- **4.3.3 Guardrails & Burnout Protection**
- **4.3.4 E2E Scenarios 11–14**

### Архитектура
- Триггеры от `user_state`, привычек, траектории, trust, геймификации
- Профиль внимания для тайминга
- Explainable messaging через AI Coaching Layer

### AI Модули
- Приоритизация, fatigue detection, timing

### Таблицы
- `notification_rules`, `notification_scores`, `notification_history`
- `notification_suppression`, `user_attention_state`, `notification_feedback`

### RLS
- User‑scoped (`auth.uid() = user_id`)

### Guardrails
- No dark patterns, cooldown, trust‑adaptive frequency

### E2E
- Scenarios 11–14

---

## Phase 5 — Monetization & Pro Intelligence Layer

### Подфазы
- **5.1 Subscription & Entitlement Core**
- **5.2 Pro‑Only AI Intelligence**
- **5.3 Economic Safety & Ethics**

### Архитектура
- Entitlements как единственный источник доступа к Pro‑фичам
- Без давления, с этическими ограничениями

### AI Модули
- Gating по entitlements + trust_score
- Мягкий downgrade для Free

### Таблицы
- `subscriptions`, `entitlements`, `feature_flags`, `billing_events`

### RLS
- `auth.uid() = user_id` для всех персональных таблиц

### Guardrails
- Cooldown upsell
- Запрет upsell при уязвимости пользователя

### E2E
- Scenarios 19–24

---

## Phase 6 — Vision Coach & Technique Intelligence

### Подфазы
- **6.1 2D Pose**
- **6.2 3D Lift Analysis**
- **6.3 Real‑time Coaching**

### Архитектура
- On‑device pose → biomechanics → guard → coaching
- Realtime только при Pro/Vision entitlements

### Таблицы
- `pose_sessions`, `pose_frames`, `pose_joints`, `pose_angles`
- `pose_quality_scores`, `pose_guard_flags`, `pose_feedback_events`

### RLS
- Pose data private: `auth.uid()` via `pose_sessions.user_id`

### Guardrails
- Safety override beats coaching
- No medical diagnosis

### E2E
- Scenarios 15–18

### Monetization Hooks
- Vision Pro tier
- Advanced biomechanics & realtime coaching

## Phase 6.2 — 3D Biomechanics & Depth Estimation (2–3 weeks)
- 3D pose reconstruction
- Depth, velocity, power proxy
- Biomechanics risk scoring (shear/compression proxy)
- Vision Pro realtime 3D overlay
- Pro post‑analysis 3D replay
- Free 2D summary only

**STATUS: DONE**  
Pose Engine v2: Production Ready

## Phase 6.3 — On‑device AI Coach & Vision Pro Mode (3–5 weeks)
- Edge inference (CoreML / TFLite)
- On‑device guard v4 + offline fallback
- Vision Pro spatial coach
- Latency < 100ms end‑to‑end

**STATUS: COMPLETE**  
Pose Engine: World‑Class AI Coach Ready
