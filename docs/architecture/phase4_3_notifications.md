# Phase 4.3 — Smart Notifications & Retention Triggers

## Goal
Build an explainable, personalized, non‑spammy notification system that reacts to `user_state`, habits, goal trajectory, trust score and gamification signals, while respecting strict guardrails.

---

## 4.3.1 Domain — Notification Intelligence

### Tables
- `notification_rules`
  - `id`, `name`, `trigger_type`, `priority_weight`, `cooldown_hours`, `active`, `created_at`
- `notification_triggers`
  - `id`, `user_id`, `trigger_type`, `context_ref`, `score`, `created_at`
- `notification_events`
  - `id`, `user_id`, `channel`, `message_id`, `status` (`queued|sent|delivered|opened|ignored`), `sent_at`, `created_at`
- `notification_suppression`
  - `user_id`, `reason`, `until_ts`, `updated_at`
- `user_attention_profile`
  - `user_id`, `chronotype`, `preferred_hours`, `timezone`, `fatigue_score`, `updated_at`
- `notification_feedback`
  - `id`, `user_id`, `event_id`, `feedback` (`positive|neutral|negative`), `reason`, `created_at`

### Relationships (Triggers)
- `notification_triggers` ← `user_state`
- `notification_triggers` ← `habits.adherence`
- `notification_triggers` ← `goal_trajectory.deviation`
- `notification_triggers` ← `ai_trust_score`
- `notification_triggers` ← `user_streaks` / `user_xp`
- `notification_triggers` ← `pose_engine` (future)

### RLS
- All user-scoped tables: `auth.uid() = user_id` for read/write.
- Aggregation tables (if introduced later) contain no user identifiers.

---

## 4.3.2 AI Layer

### Decision Flow
1) Collect candidate triggers
2) Score priority (trajectory deviation + adherence + trust + fatigue)
3) Apply suppression / cooldown windows
4) Pick channel + time (chronotype, routine, timezone)
5) Generate message via AI Coaching Layer
6) Log event + capture feedback

### Signals Used
- **Priority scoring:** deviation from trajectory, adherence drops, streak break risk
- **Fatigue detection:** rising `fatigue_score` + negative feedback trend
- **Contextual timing:** chronotype + preferred hours + timezone

### Outputs
- `notification_events` with explainability metadata
- `notification_feedback` for trust adjustments and frequency tuning

---

## 4.3.3 Guardrails
- No dark patterns or guilt loops
- No toxic comparison; no peer identifiers
- Cooldown windows per trigger type
- Trust‑adaptive frequency (lower trust → lower frequency)
- Suppression for burnout or negative feedback streaks

---

## 4.3.4 E2E Scenarios (New)
- Scenario 11 — Smart Re‑Engagement
- Scenario 12 — Habit Drop Recovery
- Scenario 13 — Burnout Prevention
- Scenario 14 — Contextual Coaching Push

---

## Monetization Hooks (Pro / Premium)
- Advanced timing personalization
- Multi‑channel coaching (push + in‑app + voice)
- Weekly AI summary with explained actions and rationale
