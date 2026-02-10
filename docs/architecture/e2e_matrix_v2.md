# E2E Test Matrix v2 (Canonical)

## Scope
Scenarios 1–7 cover Auth, Goals, Food, Workout, Recipes, AI, Reports, Progress, Habits, Resilience with DB/RLS/Service/AI assertions and deterministic acceptance criteria.

---

# Scenario 7.4 — Premium Runtime Wiring (v2)

**Today (Follow Plan)**
- Happy: active program → Today shows plan + explainability.
- Fatigue/Pain: guard notes → safety copy + recovery path.
- Offline: cached snapshot → revalidate on retry.

**My Program (Timeline)**
- Preview → Follow → Adapt → Replan flow.
- Explainability shows reasons for changes (nutrition/training/habits/pain/fatigue).
- Low confidence → conservative copy.

**Paywall / Entitlements**
- Block → explain → upgrade → unlock.
- Restore purchase → access restored.
- Grace period → allow view, warn.

**Profile / Subscription**
- Subscription lifecycle (free → active → grace → expired).
- Legal: consent, delete account, export data.
- Offline: cached profile + retry.

# Scenario 1.1 — Auth & Profile (v2)

**DB Assertions (SQL)**
- `auth.users.id` exists for every session.
- `user_profiles.user_id` is `UUID NOT NULL` and FK → `auth.users(id)`.
- `user_profiles.user_id` is unique (1:1 profile).

**RLS Assertions**
- `user_profiles`:
  - `USING (auth.uid() = user_id)`
  - `WITH CHECK (auth.uid() = user_id)`

**Service Assertions**
- `AuthContext` uses Supabase session; no local auth.
- Profile read/write uses `auth.uid()` only.
- No localStorage write fallback.

**AI Assertions**
- None (Auth/Profile only).

**Failure Simulation**
- No session: profile read returns empty/denied.
- RLS denial if `user_id` mismatches.

**Expected Transitions**
- `unauthenticated → authenticated → profile_loaded`.

**Invariants**
- `user_id = auth.uid()` in all profile operations.

**Allowed States**
- `unauthenticated`, `authenticated`, `profile_loaded`.

**Forbidden States**
- `authenticated` without valid `auth.uid()`.

---

# Scenario 1.2 — Goals (v2)

**DB Assertions (SQL)**
- `user_goals.user_id` FK to `auth.users(id)`.
- Unique constraint on `user_goals.user_id` (one active goal).

**RLS Assertions**
- `user_goals`:
  - `USING (auth.uid() = user_id)`
  - `WITH CHECK (auth.uid() = user_id)`

**Service Assertions**
- `goalService` upserts by `user_id` only.
- Validation for macros, dates, plan_type.

**AI Assertions**
- Goal save queues `ai_recommendations` (request_type: `goal_bootstrap`).

**Failure Simulation**
- Invalid macros → validation error.
- RLS denial if mismatch.

**Expected Transitions**
- `no_goal → goal_saved → ai_queued`.

**Invariants**
- One active goal per user.
- All goal writes scoped to `auth.uid()`.

**Allowed States**
- `goal_draft`, `goal_active`.

**Forbidden States**
- Multiple active goals for one user.

---

# Scenario 1.3 — AI Bootstrap (v2)

**DB Assertions (SQL)**
- `ai_recommendations.user_id` FK → `auth.users(id)`.
- `status` in {`queued`,`running`,`validating`,`completed`,`outdated`,`failed`}.
- `input_hash` for dedupe.

**RLS Assertions**
- `ai_recommendations`: `USING/WITH CHECK auth.uid() = user_id`.

**Service Assertions**
- `aiRecommendationsService.queueDayRecommendation` uses `input_hash` and dedupe.
- `markRunning/Completed/Failed` respect status machine.

**AI Assertions**
- queued → running → validating → completed.

**Failure Simulation**
- Duplicate queue with same input_hash → no new row.
- Processing error → `failed` with `error_message`.

**Expected Transitions**
- `queued → running → validating → completed|failed`.

**Invariants**
- Deduped by `(user_id, input_hash)`.

**Allowed States**
- queued, running, validating, completed, outdated, failed.

**Forbidden States**
- completed without result or model_version.

---

# Scenario 2.1 — Food Diary: Day Lifecycle (v2)

**DB Assertions (SQL)**
- `food_diary_entries.user_id` FK → `auth.users(id)`.
- Indexes: `(user_id, date, meal_type)`.

**RLS Assertions**
- `food_diary_entries`: `USING/WITH CHECK auth.uid() = user_id`.

**Service Assertions**
- Day open loads only by `(user_id, date)`.
- Add/remove entry writes Supabase only.

**AI Assertions**
- `closeDay` queues `ai_recommendations`.

**Failure Simulation**
- Offline: read-cache only, no write fallback.
- RLS denial → explicit error.

**Expected Transitions**
- `empty → partial → completed → analyzed`.

**Invariants**
- Non-negative macros.
- Day sums match entries.

**Allowed States**
- empty, partial, completed, analyzed.

**Forbidden States**
- analyzed without completed.

---

# Scenario 2.2 — Favorites & Notes Consistency (v2)

**DB Assertions (SQL)**
- `favorite_products`: unique `(user_id, product_name)`.
- `meal_entry_notes.meal_entry_id` unique, FK → `food_diary_entries.id`.

**RLS Assertions**
- `favorite_products` and `meal_entry_notes` enforce `auth.uid()`.

**Service Assertions**
- Favorites: upsert only; no duplicates.
- Notes: upsert by `meal_entry_id`.

**AI Assertions**
- None directly; triggers if day changes.

**Failure Simulation**
- Double add favorite → no dup.
- Note on missing meal_entry_id → reject.

**Expected Transitions**
- `favorite_added`, `note_added` events.

**Invariants**
- 1 favorite per product per user.
- 1 note per diary entry.

**Allowed States**
- favorite present/absent; note present/absent.

**Forbidden States**
- Multiple notes per entry.

---

# Scenario 2.3 — Day Reopen & Recalculation (v2)

**DB Assertions (SQL)**
- Updates to entries update `updated_at`.

**RLS Assertions**
- Updates restricted to owner.

**Service Assertions**
- Reopen day recomputes totals.
- Prior AI marked `outdated` on change.

**AI Assertions**
- Change after completion → `outdated`, requeue.

**Failure Simulation**
- Reopen with missing day → error.

**Expected Transitions**
- `completed → reopened → partial → completed → re-queued`.

**Invariants**
- Outdated AI on any day change.

**Allowed States**
- reopened, partial, completed, analyzed.

**Forbidden States**
- completed with outdated AI still `completed`.

---

# Scenario 3.1 — Workout Day Lifecycle (v2)

**DB Assertions (SQL)**
- `workout_days` unique `(user_id, date)`.
- `workout_entries.workout_day_id` FK → `workout_days.id`.

**RLS Assertions**
- `workout_days` and `workout_entries`: `auth.uid()`.

**Service Assertions**
- `getOrCreateWorkoutDay` uses upsert.
- `addExercisesToWorkout` writes Supabase only.

**AI Assertions**
- `closeDay` queues `ai_training_plans`.

**Failure Simulation**
- Duplicate day create → single row.

**Expected Transitions**
- `empty → partial → completed → analyzed`.

**Invariants**
- Day ownership enforced by RLS.

**Allowed States**
- empty, partial, completed, analyzed.

**Forbidden States**
- entries without valid workout_day_id.

---

# Scenario 3.2 — Exercise Selection & Muscle Mapping (v2)

**DB Assertions (SQL)**
- `exercise_muscles` links exercises to muscles.
- Indexes: `(exercise_id)`, `(muscle_id)`.

**RLS Assertions**
- Exercises readable by authenticated users; writes by owners only if user-created.

**Service Assertions**
- Deduped exercise list with normalized muscle names.

**AI Assertions**
- None.

**Failure Simulation**
- Duplicate exercise names → dedupe in service layer.

**Expected Transitions**
- `category_selected → exercises_loaded`.

**Invariants**
- Consistent muscle naming per filter.

**Allowed States**
- list_loaded, filter_applied.

**Forbidden States**
- duplicate exercise with and without muscle.

---

# Scenario 3.3 — Load Progress & Recalculation (v2)

**DB Assertions (SQL)**
- `workout_entries` contains sets/reps/weight non-negative.

**RLS Assertions**
- Reads scoped to owner.

**Service Assertions**
- Progress aggregation per exercise and date range.
- Recalculation after update.

**AI Assertions**
- Progress change can trigger training insights queue.

**Failure Simulation**
- Missing data points → graceful aggregation.

**Expected Transitions**
- `progress_requested → aggregated → displayed`.

**Invariants**
- Aggregates based on owner data only.

**Allowed States**
- aggregated, updated.

**Forbidden States**
- cross-user aggregation.

---

# Scenario 4.1 — Recipe Lifecycle (v2)

**DB Assertions (SQL)**
- `recipes.user_id` FK to `auth.users(id)`.
- `recipe_ingredients` linked to `recipes`.

**RLS Assertions**
- User can read/write own recipes; read public core.

**Service Assertions**
- Create/update/delete recipe with validation.

**AI Assertions**
- Recipe change can mark meal plans outdated.

**Failure Simulation**
- Invalid ingredient → reject.

**Expected Transitions**
- `draft → saved → edited → used_in_day`.

**Invariants**
- Recipe belongs to one owner.

**Allowed States**
- draft, saved, edited, archived.

**Forbidden States**
- recipe without owner.

---

# Scenario 4.2 — Favorites & Collections (v2)

**DB Assertions (SQL)**
- `favorite_recipes` unique `(user_id, recipe_id)`.
- `recipe_collections` unique `(user_id, recipe_id)`.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Upsert for favorite/collection.

**AI Assertions**
- None.

**Failure Simulation**
- Double favorite → no dup.

**Expected Transitions**
- `favorite_added`, `collection_added`.

**Invariants**
- No duplicates per user.

**Allowed States**
- favorite present/absent.

**Forbidden States**
- duplicates.

---

# Scenario 4.3 — Recipe Usage in Food Diary (v2)

**DB Assertions (SQL)**
- `food_diary_entries` can reference `recipe_id` (if used).

**RLS Assertions**
- Owner only.

**Service Assertions**
- Recipe usage expands macros correctly.

**AI Assertions**
- Day changes → AI outdated/requeue.

**Failure Simulation**
- Recipe deleted → handle gracefully.

**Expected Transitions**
- `recipe_added_to_day → recalculated`.

**Invariants**
- Macros consistent with recipe ingredients.

**Allowed States**
- used_in_day, updated.

**Forbidden States**
- mismatched macros.

---

# Scenario 7.4.2 — Habits Engine (v2)

**DB Assertions (SQL)**
- `habits.user_id` FK → `auth.users(id)`.
- `habit_logs` unique `(user_id, habit_id, date)`.

**RLS Assertions**
- `habits`, `habit_logs` enforce `auth.uid()`.

**Service Assertions**
- streak/recovery computed without негативных блокировок.
- relapse → recovery transition without data loss.

**AI Assertions**
- explainability bundle uses `habit_logs` + `habit_state`.

**Failure Simulation**
- Offline → local streak cache, no data loss.

**Expected Transitions**
- `inactive → active → streak → slip → recovery → stabilized`.

**Invariants**
- No shame states; only recovery support.

**Allowed States**
- active, streak, slip, recovery, stabilized.

**Forbidden States**
- forced reset to zero after slip.

---

# Scenario 7.4.3 — Progress Intelligence (v2)

**DB Assertions (SQL)**
- `progress_trends` upsert by `(user_id, period_start, period_end)`.

**RLS Assertions**
- `progress_trends` owner-only.

**Service Assertions**
- EMA, slope metrics are deterministic.
- partial data does not break aggregation.

**AI Assertions**
- explainability bundle contains data_sources + confidence.

**Failure Simulation**
- Offline snapshot → no white screen.

**Expected Transitions**
- `snapshot_ready → trend_ready → explainable`.

**Invariants**
- No silent fail; must return empty state or fallback.

**Allowed States**
- empty, partial, ready.

**Forbidden States**
- silent fail without UI feedback.

# Scenario 7.4.4 — UI Runtime State Machine (v2)

**DB Assertions (SQL)**
- None (runtime state machine).

**RLS Assertions**
- All reads still scoped to auth.uid in underlying services.

**Service Assertions**
- UI state transitions deterministic.
- Offline fallback for all key screens.

**AI Assertions**
- Explainability bundle always present if metric shown.

**Failure Simulation**
- Offline → cached snapshot
- Trust drop → blocked state with safe copy

**Expected Transitions**
- `loading → active → error → recovery → active`

**Invariants**
- No white screen.
- Every error has recovery path.

**Allowed States**
- empty, loading, active, error, recovery, blocked, premium-locked.

**Forbidden States**
- silent error without UI.

# Scenario 4.4 — Recipe Plans & Goal Matching (v2)

**DB Assertions (SQL)**
- `ai_meal_plans` with `input_hash`, `model_version`.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Meal plan generation uses goals + recipe data.

**AI Assertions**
- Plan generation → queued → completed.

**Failure Simulation**
- Missing goals → fail with message.

**Expected Transitions**
- `plan_requested → queued → completed|failed`.

**Invariants**
- Plan references current goals.

**Allowed States**
- queued, running, completed.

**Forbidden States**
- completed without goals reference.

---

# Scenario 5.1 — AI Explainability (v2)

**DB Assertions (SQL)**
- `explainability` stored per AI row.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Explainability attached to result.

**AI Assertions**
- Explainability includes sources and reasoning.

**Failure Simulation**
- Missing explainability → fail validation.

**Expected Transitions**
- `completed → explainability_attached`.

**Invariants**
- No completed AI without explainability.

**Allowed States**
- completed_with_explainability.

**Forbidden States**
- completed_without_explainability.

---

# Scenario 5.2 — AI Quality Gates & Hallucination Guard (v2)

**DB Assertions (SQL)**
- `guard_status` recorded (pass/fail).

**RLS Assertions**
- Owner only.

**Service Assertions**
- Validation runs before `completed`.

**AI Assertions**
- Guard rejects unsafe content.

**Failure Simulation**
- Hallucinated values → `failed` with reason.

**Expected Transitions**
- `running → validating → completed|failed`.

**Invariants**
- Guard must pass for completed.

**Allowed States**
- validating, completed, failed.

**Forbidden States**
- completed without guard pass.

---

# Scenario 5.3 — AI Versioning & Reproducibility (v2)

**DB Assertions (SQL)**
- `model_version` and `input_hash` stored.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Reproducible input context saved.

**AI Assertions**
- Same input_hash → same output (or cached).

**Failure Simulation**
- Missing input_context → reject.

**Expected Transitions**
- `queued → running → completed` with versioned output.

**Invariants**
- Reproducible context for all AI outputs.

**Allowed States**
- completed_versioned.

**Forbidden States**
- completed without model_version.

---

# Scenario 5.4 — AI Feedback Loop (v2)

**DB Assertions (SQL)**
- `ai_feedback` table (user_id, ai_id, rating, comment).

**RLS Assertions**
- Owner only.

**Service Assertions**
- Feedback attaches to AI record.

**AI Assertions**
- Feedback influences future ranking.

**Failure Simulation**
- Multiple feedback entries → dedupe.

**Expected Transitions**
- `completed → feedback_submitted`.

**Invariants**
- One feedback per AI recommendation per user.

**Allowed States**
- feedback_submitted.

**Forbidden States**
- multiple feedback per ai_id.

---

# Scenario 6.1 — Report Snapshot Lifecycle (v2)

**DB Assertions (SQL)**
- `report_snapshots` keyed by `(user_id, period_start, period_end)`.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Snapshot generation idempotent.

**AI Assertions**
- Optional interpretation queued.

**Failure Simulation**
- Duplicate request → return existing snapshot.

**Expected Transitions**
- `requested → generating → ready`.

**Invariants**
- One snapshot per period per user.

**Allowed States**
- requested, generating, ready.

**Forbidden States**
- ready without aggregates.

---

# Scenario 6.2 — Report Aggregates & Precomputation (v2)

**DB Assertions (SQL)**
- Aggregates precomputed for selected periods.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Uses indexes, no seq scan on user tables.

**AI Assertions**
- None.

**Failure Simulation**
- Missing data → partial aggregates with warnings.

**Expected Transitions**
- `aggregates_computed → snapshot_ready`.

**Invariants**
- Aggregates based on owner data only.

**Allowed States**
- aggregates_ready.

**Forbidden States**
- aggregates without user scope.

---

# Scenario 6.3 — Report AI Interpretation (v2)

**DB Assertions (SQL)**
- `ai_recommendations` tied to report snapshot id.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Interpretation uses snapshot aggregates.

**AI Assertions**
- Explainability required.

**Failure Simulation**
- Snapshot missing → AI request rejected.

**Expected Transitions**
- `ready → ai_queued → ai_completed`.

**Invariants**
- Interpretation only for ready snapshots.

**Allowed States**
- ai_completed.

**Forbidden States**
- ai_completed without snapshot.

---

# Scenario 7.1 — Offline & Pending Write Recovery (v2)

**DB Assertions (SQL)**
- Pending writes are recorded with `idempotency_key`.

**RLS Assertions**
- Pending writes are user scoped.

**Service Assertions**
- Retry queue with dedupe; exactly-once on reconnect.

**AI Assertions**
- AI queued after recovery.

**Failure Simulation**
- Long offline, multiple retries, partial sync.

**Expected Transitions**
- `offline → pending → retry → synced`.

**Invariants**
- Exactly-once write semantics.

**Allowed States**
- pending, retrying, synced.

**Forbidden States**
- duplicate writes after recovery.

---

# Scenario 7.2 — Retry, Backoff & Circuit Breaker (v2)

**DB Assertions (SQL)**
- No partial writes for failed ops.

**RLS Assertions**
- Unchanged.

**Service Assertions**
- Exponential backoff; breaker open/half-open/closed.

**AI Assertions**
- AI retries respect rate limits.

**Failure Simulation**
- Cascading timeouts; breaker opens.

**Expected Transitions**
- `closed → open → half-open → closed`.

**Invariants**
- No infinite retries.

**Allowed States**
- open, half-open, closed.

**Forbidden States**
- open without cooldown.

---

# Scenario 7.3 — Conflict Detection & Resolution (v2)

**DB Assertions (SQL)**
- Version field or `updated_at` used for optimistic locking.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Conflict detected on stale version.

**AI Assertions**
- None.

**Failure Simulation**
- Parallel writes; stale update rejected.

**Expected Transitions**
- `conflict_detected → resolved`.

**Invariants**
- No lost update without detection.

**Allowed States**
- conflict_detected, resolved.

**Forbidden States**
- silent overwrite.

---

# Scenario 7.4 — Rate-Limit & Abuse Protection (v2)

**DB Assertions (SQL)**
- Rate limit counters per user.

**RLS Assertions**
- Owner only.

**Service Assertions**
- Token bucket or leaky bucket enforcement.

**AI Assertions**
- AI requests throttled by user + system limits.

**Failure Simulation**
- Excessive calls blocked.

**Expected Transitions**
- `allowed → throttled → allowed`.

**Invariants**
- Fairness across users.

**Allowed States**
- allowed, throttled.

**Forbidden States**
- unlimited AI requests.

---

# Scenario 7.5 — Observability, Audit & SLO (v2)

**DB Assertions (SQL)**
- Audit log for critical writes.

**RLS Assertions**
- Audit read limited to owner.

**Service Assertions**
- Metrics for latency, error rate.

**AI Assertions**
- Trace IDs stored for AI requests.

**Failure Simulation**
- SLO breach triggers alerts.

**Expected Transitions**
- `normal → degraded → recovered`.

**Invariants**
- Error budget respected.

**Allowed States**
- normal, degraded.

**Forbidden States**
- no observability for AI.

---


# Scenario 11 — Smart Re‑Engagement (v2)

**DB Assertions (SQL)**
- `notification_triggers.user_id` FK → `auth.users(id)`.
- `notification_events.status` in {`queued`,`sent`,`delivered`,`opened`,`ignored`}.

**RLS Assertions**
- `notification_*` tables: `USING/WITH CHECK auth.uid() = user_id`.

**Service Assertions**
- Trigger creation is idempotent per user + trigger_type + day.
- Cooldown windows enforced before event creation.

**AI Assertions**
- Message generated through AI Coaching Layer with explainability.

**Failure Simulation**
- No session → no trigger creation.
- Cooldown active → no event sent.

**Expected Transitions**
- `idle → trigger_scored → event_queued → sent|suppressed`.

**Invariants**
- No more than 1 re‑engagement notification per cooldown window.

**Allowed States**
- idle, trigger_scored, event_queued, sent, suppressed.

**Forbidden States**
- repeated sends during active cooldown.

---

# Scenario 12 — Habit Drop Recovery (v2)

**DB Assertions (SQL)**
- `notification_triggers.context_ref` references habit log (or derived context).

**RLS Assertions**
- Trigger + event are owner‑scoped.

**Service Assertions**
- Detect adherence drop from `habits` / `habit_logs`.
- Trigger prioritization respects `user_attention_profile`.

**AI Assertions**
- Coaching message references goal_trajectory and recovery plan.

**Failure Simulation**
- Missing habit data → no trigger.

**Expected Transitions**
- `adherence_drop → trigger_scored → event_queued → sent`.

**Invariants**
- Recovery triggers never mention other users or rankings.

**Allowed States**
- trigger_scored, event_queued, sent.

**Forbidden States**
- social comparison messaging.

---

# Scenario 13 — Burnout Prevention (v2)

**DB Assertions (SQL)**
- `notification_suppression` created when fatigue exceeds threshold.

**RLS Assertions**
- Suppression entries owner‑scoped.

**Service Assertions**
- Negative feedback streak sets suppression window.
- Frequency reduced as trust declines.

**AI Assertions**
- No motivational pressure while suppression active.

**Failure Simulation**
- Feedback negative for N events → suppression applied.

**Expected Transitions**
- `fatigue_detected → suppressed → cool_down → eligible`.

**Invariants**
- Suppression blocks all non‑critical notifications.

**Allowed States**
- suppressed, cool_down, eligible.

**Forbidden States**
- sending during suppression.

---

# Scenario 14 — Contextual Coaching Push (v2)

**DB Assertions (SQL)**
- `user_attention_profile` exists with timezone + preferred hours.

**RLS Assertions**
- Attention profile owner‑scoped.

**Service Assertions**
- Timing selects within preferred hours.

**AI Assertions**
- Coaching message references current `user_state` context.

**Failure Simulation**
- Missing timezone → default to safe hour window.

**Expected Transitions**
- `context_available → scheduled → sent`.

**Invariants**
- No sends outside preferred window (unless critical).

**Allowed States**
- scheduled, sent.

**Forbidden States**
- non‑critical sends outside preferred hours.

---

# Scenario 15 — Pose Session Capture (v2)

**DB Assertions (SQL)**
- `pose_sessions.user_id` FK → `auth.users(id)`.
- `pose_frames.pose_session_id` FK → `pose_sessions(id)`.

**RLS Assertions**
- Pose tables scoped by session ownership.

**Service Assertions**
- Session created per workout_entry + exercise.
- Frames are batched; no user_id stored in child tables.

**AI Assertions**
- Pose session metadata added to AI context.

**Failure Simulation**
- Camera denied → no session created.

**Expected Transitions**
- `session_started → frames_streamed → session_closed`.

**Invariants**
- Frames cannot exist without a session.

**Allowed States**
- session_started, streaming, closed.

**Forbidden States**
- orphan frames.

---

# Scenario 16 — Real‑Time Technique Coaching (v2)

**DB Assertions (SQL)**
- `pose_feedback_events` linked to `pose_sessions`.

**RLS Assertions**
- Feedback events owner‑scoped via session.

**Service Assertions**
- Real‑time feedback only when confidence ≥ threshold.

**AI Assertions**
- Coaching message uses joint angle deviation + stability score.

**Failure Simulation**
- Low confidence → feedback suppressed.

**Expected Transitions**
- `frames_streamed → guard_checked → feedback_emitted|suppressed`.

**Invariants**
- No feedback on low‑confidence pose.

**Allowed States**
- feedback_emitted, suppressed.

**Forbidden States**
- feedback without guard pass.

---

# Scenario 17 — Injury Risk Guard (v2)

**DB Assertions (SQL)**
- `pose_guard_flags` created on risk detection.

**RLS Assertions**
- Guard flags owner‑scoped via session.

**Service Assertions**
- Risk thresholds per exercise + joint.

**AI Assertions**
- Guard overrides coaching, only safety message allowed.

**Failure Simulation**
- Angle exceeds threshold → risk flag.

**Expected Transitions**
- `risk_detected → guard_flagged → safety_message`.

**Invariants**
- Safety overrides all other coaching.

**Allowed States**
- guard_flagged, safety_message.

**Forbidden States**
- performance coaching during risk.

---

# Scenario 18 — Post‑Set Coaching + Progress (v2)

**DB Assertions (SQL)**
- `pose_quality_scores` stored per session.

**RLS Assertions**
- Scores owner‑scoped via session.

**Service Assertions**
- Post‑set summary computed from session metrics.

**AI Assertions**
- Feedback linked to goal_trajectory and future plan tweaks.

**Failure Simulation**
- Missing scores → no post‑set summary.

**Expected Transitions**
- `session_closed → summary_generated → ai_coaching_event`.

**Invariants**
- Summaries require pose_quality_score.

**Allowed States**
- summary_generated, ai_event_logged.

**Forbidden States**
- summary without metrics.

---

# Scenario 19 — Free → Pro upgrade (v2)

**DB Assertions (SQL)**
- `subscriptions.user_id` FK → `auth.users(id)`.
- `billing_events.idempotency_key` unique.

**RLS Assertions**
- `subscriptions`, `billing_events` owner‑scoped.

**Service Assertions**
- Webhook processing idempotent.
- Upgrade creates entitlements.

**AI Assertions**
- None directly; impacts gating.

**Failure Simulation**
- Duplicate webhook → no duplicate entitlements.

**Expected Transitions**
- `free → upgrade_pending → pro_active`.

**Invariants**
- One active plan per user.

**Allowed States**
- free, upgrade_pending, pro_active.

**Forbidden States**
- multiple active plans.

---

# Scenario 20 — Feature unlock by entitlement (v2)

**DB Assertions (SQL)**
- `entitlements.enabled = true` grants feature access.

**RLS Assertions**
- Entitlements owner‑scoped.

**Service Assertions**
- Feature checks use entitlements only.

**AI Assertions**
- AI requests include entitlement context.

**Failure Simulation**
- Missing entitlement → fallback to free mode.

**Expected Transitions**
- `locked → unlocked`.

**Invariants**
- No Pro‑feature access without entitlement.

**Allowed States**
- locked, unlocked.

**Forbidden States**
- unlocked without entitlement.

---

# Scenario 21 — AI depth increases after upgrade (v2)

**DB Assertions (SQL)**
- Entitlement change recorded.

**RLS Assertions**
- Owner‑scoped only.

**Service Assertions**
- AI depth increases with entitlement.

**AI Assertions**
- Increased context + longer plan horizon.

**Failure Simulation**
- Upgrade rollback → AI depth downgraded.

**Expected Transitions**
- `basic_ai → pro_ai`.

**Invariants**
- Depth must match active entitlement.

**Allowed States**
- basic_ai, pro_ai.

**Forbidden States**
- pro_ai without entitlement.

---

# Scenario 22 — Guarded upsell (v2)

**DB Assertions (SQL)**
- Upsell events logged with cooldown.

**RLS Assertions**
- User‑scoped logs.

**Service Assertions**
- Cooldown enforced.
- No upsell during burnout.

**AI Assertions**
- Tone adjusted by trust score.

**Failure Simulation**
- Multiple triggers → single upsell per cooldown.

**Expected Transitions**
- `eligible → shown → cooldown`.

**Invariants**
- No spam; no pressure loops.

**Allowed States**
- eligible, shown, cooldown.

**Forbidden States**
- repeated upsell in cooldown.

---

# Scenario 23 — Trust‑adaptive pricing nudges (v2)

**DB Assertions (SQL)**
- Trust score stored in `ai_trust_scores`.

**RLS Assertions**
- Trust scores owner‑scoped.

**Service Assertions**
- Frequency reduced for low trust.

**AI Assertions**
- Messaging softens as trust decreases.

**Failure Simulation**
- Trust < threshold → nudge suppressed.

**Expected Transitions**
- `high_trust → gentle_nudge → suppress`.

**Invariants**
- No aggressive pricing nudges.

**Allowed States**
- gentle_nudge, suppress.

**Forbidden States**
- pushy nudge at low trust.

---

# Scenario 24 — Vision Pro tier unlocks Pose realtime (v2)

**DB Assertions (SQL)**
- Entitlement `pose_realtime` enabled for Vision Pro.

**RLS Assertions**
- Entitlements owner‑scoped.

**Service Assertions**
- Realtime pose requires entitlement; free users get post‑analysis.

**AI Assertions**
- Coaching confidence scaled by trust + entitlement.

**Failure Simulation**
- Entitlement missing → realtime disabled.

**Expected Transitions**
- `pose_post_only → pose_realtime`.

**Invariants**
- No realtime without Vision Pro.

**Allowed States**
- post_only, realtime.

**Forbidden States**
- realtime without entitlement.

---

# Scenario 25 — Realtime session start (Pro) (v2)

**DB Assertions (SQL)**
- `pose_sessions.user_id` FK → `auth.users(id)`.

**RLS Assertions**
- Pose tables owner‑scoped via `pose_sessions`.

**Service Assertions**
- `entitlementService.canRealtimePose()` must be true.

**AI Assertions**
- None directly at start.

**Failure Simulation**
- Missing entitlement → realtime denied.

**Expected Transitions**
- `session_request → session_started`.

**Invariants**
- Realtime only for Pro/Vision Pro.

**Allowed States**
- session_started.

**Forbidden States**
- realtime without entitlement.

---

# Scenario 26 — Free user gets post‑analysis only (v2)

**DB Assertions (SQL)**
- Pose data stored without realtime overlay requirement.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Free users: `processFrame` records, but no overlay.

**AI Assertions**
- Post‑analysis only after session ends.

**Failure Simulation**
- Free user tries realtime → denied.

**Expected Transitions**
- `session_closed → post_analysis_generated`.

**Invariants**
- No live overlay for Free.

**Allowed States**
- post_only.

**Forbidden States**
- realtime for Free.

---

# Scenario 27 — Incorrect squat → red overlay (v2)

**DB Assertions (SQL)**
- `pose_deviations` record for deviation.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Template matcher flags deviation.

**AI Assertions**
- Overlay generated (red).

**Failure Simulation**
- Low confidence → overlay suppressed.

**Expected Transitions**
- `frame_processed → deviation_flagged → red_overlay`.

**Invariants**
- Red overlay requires Pro/Vision + safe confidence.

**Allowed States**
- red_overlay.

**Forbidden States**
- red overlay at low confidence.

---

# Scenario 28 — Correct form → green overlay (v2)

**DB Assertions (SQL)**
- No critical deviations.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Template matcher validates technique.

**AI Assertions**
- Overlay generated (green).

**Failure Simulation**
- Entitlement missing → no overlay.

**Expected Transitions**
- `frame_processed → validated → green_overlay`.

**Invariants**
- Green overlay only if entitlement allowed.

**Allowed States**
- green_overlay.

**Forbidden States**
- green overlay for Free.

---

# Scenario 29 — Unsafe knee valgus → coaching suppressed, safety warning (v2)

**DB Assertions (SQL)**
- `pose_guard_flags` created with high severity.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Guard overrides coaching.

**AI Assertions**
- Only safety warning allowed.

**Failure Simulation**
- Guard fails → no coaching.

**Expected Transitions**
- `risk_detected → guard_flagged → safety_warning`.

**Invariants**
- Safety override beats coaching.

**Allowed States**
- safety_warning.

**Forbidden States**
- coaching during guard failure.

---

# Scenario 30 — Low trust_score → delayed feedback (v2)

**DB Assertions (SQL)**
- `ai_trust_scores` used for gating.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Trust below threshold → delay feedback.

**AI Assertions**
- Cue generated only after threshold recovery.

**Failure Simulation**
- Trust low → no realtime cue.

**Expected Transitions**
- `low_trust → delayed_feedback`.

**Invariants**
- No realtime cue under low trust.

**Allowed States**
- delayed_feedback.

**Forbidden States**
- realtime cue at low trust.

---

# Scenario 31 — 3D squat depth validation (v2)

**DB Assertions (SQL)**
- 3D depth metrics stored per session.

**RLS Assertions**
- Pose 3D data owner‑scoped.

**Service Assertions**
- Depth range validated for squat template.

**AI Assertions**
- Coaching references depth deviation.

**Failure Simulation**
- Depth unavailable → fallback to 2D.

**Expected Transitions**
- `3d_ready → depth_validated`.

**Invariants**
- Depth validation only if 3D pipeline ready.

**Allowed States**
- depth_validated.

**Forbidden States**
- depth output without 3D.

---

# Scenario 32 — Asymmetric load detection (v2)

**DB Assertions (SQL)**
- Left/right imbalance recorded.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Asymmetry threshold triggers warning.

**AI Assertions**
- Cue references compensation side.

**Failure Simulation**
- Noisy signal → no warning.

**Expected Transitions**
- `asymmetry_detected → warning`.

**Invariants**
- No warning on low confidence.

**Allowed States**
- warning.

**Forbidden States**
- warning with low confidence.

---

# Scenario 33 — Bar path deviation (v2)

**DB Assertions (SQL)**
- Bar path vector stored (if detected).

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Deviation > threshold → flagged.

**AI Assertions**
- Cue references path correction.

**Failure Simulation**
- No bar detected → skip.

**Expected Transitions**
- `path_tracked → deviation_flagged`.

**Invariants**
- Bar path only if detected.

**Allowed States**
- deviation_flagged.

**Forbidden States**
- bar path when not detected.

---

# Scenario 34 — Unsafe lumbar shear warning (v2)

**DB Assertions (SQL)**
- Shear proxy stored with high risk.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Guard blocks coaching on red risk.

**AI Assertions**
- Only safety warning.

**Failure Simulation**
- Shear spike → block cues.

**Expected Transitions**
- `risk_detected → guard_blocked`.

**Invariants**
- No coaching under red risk.

**Allowed States**
- guard_blocked.

**Forbidden States**
- coaching with red risk.

---

# Scenario 35 — Vision Pro realtime 3D overlay (v2)

**DB Assertions (SQL)**
- Entitlement `pose_realtime` enabled.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Device gating: Vision Pro required.

**AI Assertions**
- Realtime 3D overlay only for Vision Pro.

**Failure Simulation**
- Non‑Vision device → realtime denied.

**Expected Transitions**
- `vision_device → realtime_3d_on`.

**Invariants**
- Realtime 3D only on Vision Pro.

**Allowed States**
- realtime_3d_on.

**Forbidden States**
- realtime_3d_on without device.

---

# Scenario 36 — Pro post‑analysis 3D replay (v2)

**DB Assertions (SQL)**
- 3D replay stored for Pro.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Pro users get post‑analysis 3D.

**AI Assertions**
- AI summary uses 3D metrics.

**Failure Simulation**
- Free user → fallback to 2D.

**Expected Transitions**
- `session_closed → 3d_replay_ready`.

**Invariants**
- 3D replay only for Pro/Vision.

**Allowed States**
- 3d_replay_ready.

**Forbidden States**
- 3d_replay for Free.

---

# Scenario 37 — Guard blocks coaching on injury risk (v2)

**DB Assertions (SQL)**
- Risk score stored, guard flag set.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Coaching blocked when risk red.

**AI Assertions**
- Safety‑only warning.

**Failure Simulation**
- Risk spike → no cue.

**Expected Transitions**
- `risk_red → coaching_blocked`.

**Invariants**
- No coaching under red risk.

**Allowed States**
- coaching_blocked.

**Forbidden States**
- coaching with red risk.

---

# Scenario 38 — Trust‑adaptive cue frequency in 3D mode (v2)

**DB Assertions (SQL)**
- `ai_trust_scores` used.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Cue frequency reduced for low trust.

**AI Assertions**
- Trust controls cadence.

**Failure Simulation**
- Trust < threshold → cues delayed.

**Expected Transitions**
- `low_trust → delayed_cues`.

**Invariants**
- No rapid cues at low trust.

**Allowed States**
- delayed_cues.

**Forbidden States**
- high‑frequency cues at low trust.

---

# Scenario 45 — On‑device inference without internet (v2)

**DB Assertions (SQL)**
- On‑device logs stored locally and synced later.

**RLS Assertions**
- Sync writes scoped to `auth.uid()`.

**Service Assertions**
- No network → on‑device inference only.

**AI Assertions**
- None (offline).

**Failure Simulation**
- Full offline session.

**Expected Transitions**
- `offline → local_inference → deferred_sync`.

**Invariants**
- No cloud dependency for core inference.

**Allowed States**
- local_inference, deferred_sync.

**Forbidden States**
- cloud‑only inference when offline.

---

# Scenario 46 — Safety stop offline (v2)

**DB Assertions (SQL)**
- Safety event buffered locally.

**RLS Assertions**
- Sync writes scoped to `auth.uid()`.

**Service Assertions**
- Guard v4 triggers stop without network.

**AI Assertions**
- Only local safety cue.

**Failure Simulation**
- Offline + danger state.

**Expected Transitions**
- `danger → safety_stop`.

**Invariants**
- Safety overrides network availability.

**Allowed States**
- safety_stop.

**Forbidden States**
- coaching during danger offline.

---

# Scenario 47 — Vision Pro spatial cue (v2)

**DB Assertions (SQL)**
- Spatial cue events logged.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Vision Pro mode enables spatial cues.

**AI Assertions**
- Spatial vector hints generated.

**Failure Simulation**
- Non‑Vision device → no spatial cue.

**Expected Transitions**
- `vision_mode → spatial_cue`.

**Invariants**
- Spatial cues only on Vision Pro.

**Allowed States**
- spatial_cue.

**Forbidden States**
- spatial_cue on non‑Vision devices.

---

# Scenario 48 — Latency under 100ms (v2)

**DB Assertions (SQL)**
- Latency metrics recorded locally.

**RLS Assertions**
- Owner‑scoped on sync.

**Service Assertions**
- End‑to‑end < 100ms for edge.

**AI Assertions**
- None.

**Failure Simulation**
- CPU throttle → degrade quality.

**Expected Transitions**
- `normal → degraded_quality`.

**Invariants**
- Degrade, do not exceed latency.

**Allowed States**
- normal, degraded_quality.

**Forbidden States**
- latency > 100ms without degradation.

---

# Scenario 49 — Entitlement gating edge mode (v2)

**DB Assertions (SQL)**
- Entitlements applied locally.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Free: post‑analysis only.

**AI Assertions**
- No realtime voice for Free.

**Failure Simulation**
- Entitlement missing → downgrade mode.

**Expected Transitions**
- `pro → realtime`, `free → post`.

**Invariants**
- No realtime for Free.

**Allowed States**
- realtime, post.

**Forbidden States**
- realtime for Free.

---

# Scenario 50 — Trust‑adaptive silence on device (v2)

**DB Assertions (SQL)**
- Trust score cached locally.

**RLS Assertions**
- Owner‑scoped on sync.

**Service Assertions**
- Low trust → silence.

**AI Assertions**
- Motivation disabled when trust low.

**Failure Simulation**
- Trust below threshold.

**Expected Transitions**
- `low_trust → silent_mode`.

**Invariants**
- No motivational cues when trust low.

**Allowed States**
- silent_mode.

**Forbidden States**
- motivation at low trust.

---

# Scenario 51 — Battery‑safe degradation (v2)

**DB Assertions (SQL)**
- Power mode state stored.

**RLS Assertions**
- Owner‑scoped on sync.

**Service Assertions**
- Battery low → reduce model complexity.

**AI Assertions**
- Cues downgraded (no heavy inference).

**Failure Simulation**
- Low battery signal.

**Expected Transitions**
- `normal → power_saver`.

**Invariants**
- Never exceed battery threshold.

**Allowed States**
- power_saver.

**Forbidden States**
- full inference on low battery.

---

# Scenario 52 — Cloud sync after session (v2)

**DB Assertions (SQL)**
- Session logs synced after reconnect.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Retry sync on connectivity restore.

**AI Assertions**
- Explainability generated post‑sync.

**Failure Simulation**
- Offline session then online.

**Expected Transitions**
- `offline → sync_pending → synced`.

**Invariants**
- No data loss on reconnect.

**Allowed States**
- sync_pending, synced.

**Forbidden States**
- drop without sync.

---

# Scenario 53 — Explainability from on‑device logs (v2)

**DB Assertions (SQL)**
- Logs contain sufficient context.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Explainability generated from edge logs.

**AI Assertions**
- Explainability references local metrics.

**Failure Simulation**
- Partial logs → degrade explainability.

**Expected Transitions**
- `logs_ready → explainability_ready`.

**Invariants**
- Explainability requires logs.

**Allowed States**
- explainability_ready.

**Forbidden States**
- explainability without logs.

---

# Scenario 54 — Guard override blocks coaching (v2)

**DB Assertions (SQL)**
- Guard override flagged.

**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Guard v4 blocks coaching.

**AI Assertions**
- Safety‑only cue.

**Failure Simulation**
- Danger state.

**Expected Transitions**
- `danger → coaching_blocked`.

**Invariants**
- No coaching when guard override.
**Allowed States**
- coaching_blocked.

**Forbidden States**
- coaching when danger.

---

# Scenario 55 — Pro vs Vision Pro capability split (v2)

**DB Assertions (SQL)**
- Entitlements split Pro/Vision.
**RLS Assertions**
- Owner‑scoped.

**Service Assertions**
- Vision Pro gets spatial cues; Pro gets 2D voice.

**AI Assertions**
- Spatial cues only for Vision Pro.

**Failure Simulation**
- Vision entitlement missing.

**Expected Transitions**
- `vision_entitled → spatial_mode`.

**Invariants**
- No spatial mode without Vision entitlement.

**Allowed States**
- spatial_mode.

**Forbidden States**
- spatial_mode on Pro.
---

# Scenario 56 — Add food via barcode (v2)

**DB Assertions (SQL)**
- Barcode resolves to canonical_food_id.

**RLS Assertions**
- User‑scoped when saved as user item.

**Service Assertions**
- OCR/Barcode pipeline normalizes name and unit.

**AI Assertions**
- KB link attached to entry.

**Failure Simulation**
- Unknown barcode → fallback to manual entry.

**Expected Transitions**
- `scan_success → normalized → saved`.

**Invariants**
- Canonical ID required when resolved.

**Allowed States**
- saved.

**Forbidden States**
- saved without canonical when resolved.

---

# Scenario 57 — AI normalizes brand product (v2)

**DB Assertions (SQL)**
- Alias saved with normalized brand/name.

**RLS Assertions**
- User‑scoped alias writes.

**Service Assertions**
- Dedupe on `(normalized_name, normalized_brand)`.

**AI Assertions**
- Normalization references KB version.

**Failure Simulation**
- Conflicting alias → flagged for review.

**Expected Transitions**
- `raw_input → normalized → deduped`.

**Invariants**
- Single canonical target per alias.

**Allowed States**
- normalized, deduped.

**Forbidden States**
- alias linked to multiple canonicals.

---

# Scenario 58 — Allergy guard (v2)

**DB Assertions (SQL)**
- Allergens stored on canonical foods.

**RLS Assertions**
- User allergy profile user‑scoped.

**Service Assertions**
- Guard blocks unsafe suggestions.

**AI Assertions**
- Explainability includes allergy trigger.

**Failure Simulation**
- Missing allergy data → default safe block.

**Expected Transitions**
- `unsafe_detected → blocked`.

**Invariants**
- No recommendation violating allergy profile.

**Allowed States**
- blocked.

**Forbidden States**
- unsafe recommendation.

---

# Scenario 59 — Exercise technique gold standard (v2)

**DB Assertions (SQL)**
- Canonical pose template exists per exercise.

**RLS Assertions**
- Templates read‑only for users.

**Service Assertions**
- Pose Coach loads gold standard template.

**AI Assertions**
- Coaching references template ID.

**Failure Simulation**
- Missing template → degrade to generic template.

**Expected Transitions**
- `exercise_selected → template_loaded`.

**Invariants**
- Gold standard immutable by user.

**Allowed States**
- template_loaded.

**Forbidden States**
- user‑modified template.

---

# Scenario 60 — Pose correction uses KB (v2)

**DB Assertions (SQL)**
- Pose events link to canonical_exercise_id.

**RLS Assertions**
- Pose data user‑scoped.

**Service Assertions**
- Corrections derived from KB biomechanics.

**AI Assertions**
- Explainability references KB rule.

**Failure Simulation**
- KB missing → fallback to guard‑only.

**Expected Transitions**
- `pose_frame → correction`.

**Invariants**
- Corrections reference KB or guard.

**Allowed States**
- correction.

**Forbidden States**
- correction without source.

---

# Scenario 61 — Ambiguous food resolution (v2)

**DB Assertions (SQL)**
- Multiple candidates logged for review.

**RLS Assertions**
- User input scoped to `auth.uid()`.

**Service Assertions**
- Conflict resolver prompts user choice.

**AI Assertions**
- No auto‑select without confidence threshold.

**Failure Simulation**
- Two equal matches → require manual selection.

**Expected Transitions**
- `ambiguous → user_selected → saved`.

**Invariants**
- Explicit user confirmation required.

**Allowed States**
- saved.

**Forbidden States**
- auto‑saved without confirmation.

---

# Scenario 62 — Unsafe exercise blocked (v2)

**DB Assertions (SQL)**
- Contraindication tag exists in KB.

**RLS Assertions**
- User injury profile scoped to `auth.uid()`.

**Service Assertions**
- Guard blocks exercise selection.

**AI Assertions**
- Explainability references contraindication.\n+
**Failure Simulation**
- Missing contraindication data → fallback safe‑block.

**Expected Transitions**
- `unsafe_detected → blocked`.

**Invariants**
- Unsafe exercise never scheduled.\n+
**Allowed States**
- blocked.

**Forbidden States**
- scheduled unsafe exercise.

---

# Scenario 63 — Conflicting macros merge (v2)

**DB Assertions (SQL)**
- Conflicting macro sources stored with confidence.\n+
**RLS Assertions**
- Source records scoped to `auth.uid()` when user‑created.\n+
**Service Assertions**
- Merge policy selects golden record or flags review.\n+
**AI Assertions**
- Explainability references chosen source + confidence.\n+
**Failure Simulation**
- Two trusted sources disagree → human review required.\n+
**Expected Transitions**
- `conflict_detected → review_pending` or `merged`.\n+
**Invariants**
- No silent merge when conflict is high.\n+
**Allowed States**
- review_pending, merged.\n+
**Forbidden States**
- merged without confidence.\n+
---

# Scenario 64 — Brand vs generic resolution (v2)

**DB Assertions (SQL)**
- Brand family mapped to generic fallback.\n+
**RLS Assertions**
- User‑scoped for user brands.\n+
**Service Assertions**
- Resolver selects brand when confidence high, else generic.\n+
**AI Assertions**
- Explainability cites brand/generic choice.\n+
**Failure Simulation**
- Missing brand data → fallback to generic.\n+
**Expected Transitions**
- `brand_input → resolved`.\n+
**Invariants**
- Fallback always available.\n+
**Allowed States**
- resolved.\n+
**Forbidden States**
- unresolved without fallback.\n+
---

# Scenario 65 — Medical contraindication override (v2)

**DB Assertions (SQL)**
- Contraindications stored per user profile.\n+
**RLS Assertions**
- Strict user‑scoped access.\n+
**Service Assertions**
- Contraindication overrides recommendations.\n+
**AI Assertions**
- Explainability includes contraindication tag.\n+
**Failure Simulation**
- Missing contraindication data → safe‑block.\n+
**Expected Transitions**
- `contraindication_detected → blocked`.\n+
**Invariants**
- Medical override beats AI suggestion.\n+
**Allowed States**
- blocked.\n+
**Forbidden States**
- recommendation despite contraindication.\n+
---

# Scenario 66 — Excel import with conflicts (v2)

**DB Assertions (SQL)**
- Conflicts logged with source metadata.

**RLS Assertions**
- Import scoped to `auth.uid()` for user datasets.

**Service Assertions**
- Conflicts routed to review queue.

**AI Assertions**
- No auto‑merge without confidence threshold.

**Failure Simulation**
- Duplicate rows with conflicting macros.

**Expected Transitions**
- `imported → conflicts_detected → review_pending`.

**Invariants**
- Conflicts must be resolved before canonicalization.

**Allowed States**
- review_pending.

**Forbidden States**
- canonicalized with unresolved conflicts.

---

# Scenario 67 — Canon update re‑evaluates past logs (v2)

**DB Assertions (SQL)**
- Canon version bump recorded.

**RLS Assertions**
- User logs remain scoped.

**Service Assertions**
- Backfill recalculates aggregates with new canon.

**AI Assertions**
- Explainability references new version.

**Failure Simulation**
- Version bump with missing mapping.

**Expected Transitions**
- `version_bumped → backfill → updated_logs`.

**Invariants**
- Canon update does not break history.

**Allowed States**
- updated_logs.

**Forbidden States**
- broken links to canonical IDs.

---

# Scenario 68 — AI explanation references canonical source (v2)

**DB Assertions (SQL)**
- Explanation includes canonical source ID + version.

**RLS Assertions**
- Owner‑scoped access.

**Service Assertions**
- Explainability payload always includes source.

**AI Assertions**
- Response contains source + confidence.

**Failure Simulation**
- Missing source metadata → block publish.

**Expected Transitions**
- `analysis_ready → explanation_ready`.

**Invariants**
- No explanation without source.

**Allowed States**
- explanation_ready.

**Forbidden States**
- explanation without source.

---

# Scenario 69 — Unsafe food blocked by medical profile (v2)

**DB Assertions (SQL)**
- Medical profile stored with allergens/intolerances.

**RLS Assertions**
- Strict user‑scoped access.

**Service Assertions**
- Guard blocks unsafe foods.

**AI Assertions**
- Explainability references medical block.

**Failure Simulation**
- Missing profile data → safe‑block.

**Expected Transitions**
- `unsafe_detected → blocked`.

**Invariants**
- Unsafe food never recommended.

**Allowed States**
- blocked.

**Forbidden States**
- recommendation despite medical profile.

---

# Scenario 70 — Cross‑country unit mismatch resolution (v2)

**DB Assertions (SQL)**
- Units normalized to canonical ontology.

**RLS Assertions**
- Owner‑scoped on user records.

**Service Assertions**
- Resolver converts oz/cup/ml to grams with density.

**AI Assertions**
- Explainability notes unit conversion.

**Failure Simulation**
- Missing density → fallback to manual input.

**Expected Transitions**
- `unit_mismatch → converted`.

**Invariants**
- Canonical units required for storage.

**Allowed States**
- converted.

**Forbidden States**
- stored with mixed units.

---

# Scenario 71 — Canon update → version history available (v2)

**DB Assertions (SQL)**
- `knowledge_version_snapshots` содержит `entity_id` и `version`.
- `knowledge_version_diffs` содержит diff между версиями.

**Service Assertions**
- История версий доступна по canonical ID.
- Возвращается diff_summary.

**Expected Transitions**
- `versioned → history_available`.

---

# Scenario 72 — Confidence decay снижает доверие (v2)

**DB Assertions (SQL)**
- `knowledge_confidence_decay.effective_confidence` уменьшается по времени.

**AI Assertions**
- При `effective_confidence < 0.60` AI блокируется guard‑слоем.

**Expected Transitions**
- `trusted → caution → blocked`.

---

# Scenario 73 — User override → HITL → новая версия (v2)

**DB Assertions (SQL)**
- `knowledge_user_overrides` создаётся со `status=pending`.
- HITL создаёт `knowledge_human_reviews`.
- Новый snapshot с `version+1` создаётся после `accept`.

**Expected Transitions**
- `override_submitted → pending → accepted → version_created`.

---

# Scenario 74 — Auto‑update безопасно пересчитывает дневники (v2)

**DB Assertions (SQL)**
- `knowledge_auto_updates` завершается со статусом `completed`.
- `knowledge_backfill_jobs` фиксирует затронутые даты.

**Expected Transitions**
- `auto_update → backfill → diary_consistent`.

---

# Scenario 75 — AI‑программа использует verified‑версию (v2)

**DB Assertions (SQL)**
- AI вход содержит `knowledge_version` и `verified=true`.

**Expected Transitions**
- `program_request → verified_knowledge → plan_generated`.

---

# Scenario 76 — Program generation (nutrition) from KB (v2)

**DB Assertions (SQL)**
- `nutrition_programs` создан с `knowledge_version_ref`.

**AI Assertions**
- Используются только verified версии.

**Expected Transitions**
- `inputs_valid → program_generated`.

---

# Scenario 77 — Program generation (training) with phases (v2)

**DB Assertions (SQL)**
- `program_phases` и `program_microcycles` связаны с `training_programs`.

**Expected Transitions**
- `skeleton_created → sessions_scheduled`.

---

# Scenario 78 — Explainability per decision (v2)

**DB Assertions (SQL)**
- `program_explainability` содержит ссылки на KB версии.

**Expected Transitions**
- `decision_made → explanation_attached`.

---

# Scenario 79 — Guard blocks unsafe directives (v2)

**DB Assertions (SQL)**
- `program_guard_events` фиксирует `danger`.

**Expected Transitions**
- `unsafe_detected → blocked`.

---

# Scenario 80 — Trust‑adaptive depth (v2)

**AI Assertions**
- Глубина программы снижается при низком trust_score.

**Expected Transitions**
- `low_trust → simplified_plan`.

---

# Scenario 81 — Confidence decay reduces aggressiveness (v2)

**AI Assertions**
- При низком confidence снижается интенсивность.

**Expected Transitions**
- `decay_detected → conservative_plan`.

---

# Scenario 82 — Constraint change triggers safe re‑plan (v2)

**Service Assertions**
- Создаётся новая версия программы, старая сохраняется.

**Expected Transitions**
- `constraint_change → replan → versioned`.

---

# Scenario 83 — Adaptation on plateau (v2)

**DB Assertions (SQL)**
- `program_adaptations.trigger = plateau`.
- New `program_versions` row created.

**AI Assertions**
- Macro/volume adjusted within safe bounds (±5–10%).

**Expected Transitions**
- `plateau_detected → micro_adjust → versioned`.

---

# Scenario 84 — Overtraining detection (v2)

**DB Assertions (SQL)**
- `program_guard_events.risk_level = danger` or `caution`.

**Service Assertions**
- Deload or pause injected.

**Expected Transitions**
- `overtraining_detected → guard_flagged → deload_or_pause`.

---

# Scenario 85 — Recovery block injection (v2)

**DB Assertions (SQL)**
- `program_blocks.block_type = deload` added to active phase.

**AI Assertions**
- Explainability references recovery rationale.

**Expected Transitions**
- `fatigue_spike → recovery_block_injected`.

---

# Scenario 86 — Trust‑adaptive replan (v2)

**AI Assertions**
- `plan_depth = basic` when trust below threshold.
- Adaptation cooldown increased.

**Expected Transitions**
- `trust_drop → simplified_replan`.

---

# Scenario 87 — Guard‑forced stop (v2)

**DB Assertions (SQL)**
- `program_guard_events` created with `blocked_actions`.
- Program status set to `paused` or `safe_mode`.

**Expected Transitions**
- `risk_detected → guard_stop`.

---

# Scenario 88 — Confidence‑based nutrition adjustment (v2)

**AI Assertions**
- Effective confidence reduces calories/macros conservatively.

**Expected Transitions**
- `confidence_drop → conservative_plan`.

---

# Scenario 89 — KB update triggers safe re‑plan (v2)

**DB Assertions (SQL)**
- New `program_versions` with updated `knowledge_version_ref`.
- Old snapshot preserved.

**Expected Transitions**
- `kb_version_bump → replan → snapshot_preserved`.

---

# Scenario 90 — Adherence drop simplification (v2)

**Service Assertions**
- Plan simplified (fewer sessions or maintenance days).

**Expected Transitions**
- `adherence_drop → simplified_plan`.

---

# Scenario 91 — Skipped days trigger replan (v2)

**DB Assertions (SQL)**
- `program_sessions.status = skipped` recorded.

**Expected Transitions**
- `skipped_streak → replan`.

---

# Scenario 92 — Pose risk blocks training day (v2)

**DB Assertions (SQL)**
- Pose risk event links to program day.

**Expected Transitions**
- `pose_risk → training_blocked`.

---

# Scenario 93 — Fatigue trend reduces volume (v2)

**AI Assertions**
- Volume reduced by 10–20% with rationale.

**Expected Transitions**
- `fatigue_trend → volume_reduced`.

---

# Scenario 94 — Explainability v4 present (v2)

**DB Assertions (SQL)**
- `program_explainability` contains `reason_code`, `diff_summary`.

**Expected Transitions**
- `adaptation → explanation_attached`.

---

# Scenario 95 — Adaptation history available (v2)

**DB Assertions (SQL)**
- `program_adaptations` links `from_version` → `to_version`.

**Expected Transitions**
- `adapted → history_available`.

---

# Scenario 96 — Program overview fetch (v2)

**Service Assertions**
- `getProgramOverview` returns current program + status.

**PASS**
- Response includes `program_id`, `program_type`, `status`, `program_version`.

**Expected Transitions**
- `request → overview_loaded`.

---

# Scenario 97 — Day card fetch (v2)

**Service Assertions**
- `getProgramDay` returns targets + session_plan + explainability.

**PASS**
- DTO содержит `targets` или `session_plan` + `session_status`.

**Expected Transitions**
- `date_selected → day_card_loaded`.

---

# Scenario 98 — Phase timeline (v2)

**Service Assertions**
- Timeline returns phases and blocks with boundaries.

**PASS**
- Фазы отсортированы по датам, блоки связаны с фазами.

**Expected Transitions**
- `program_loaded → timeline_visible`.

---

# Scenario 99 — Adaptation timeline (v2)

**DB Assertions (SQL)**
- `program_adaptations` entries rendered in order.

**PASS**
- История адаптаций доступна пользователю.

**Expected Transitions**
- `history_opened → adaptation_timeline_visible`.

---

# Scenario 100 — Mark day completed (v2)

**DB Assertions (SQL)**
- `program_sessions.status = completed`.

**PASS**
- Trust score увеличен после completed.

**Expected Transitions**
- `day_completed → adherence_updated`.

---

# Scenario 101 — Skipped day triggers adapt (v2)

**Service Assertions**
- Skips propagate to `adaptProgram()` call.

**PASS**
- Создана новая версия программы.

**Expected Transitions**
- `day_skipped → replan_requested`.

---

# Scenario 102 — User feedback triggers replan (v2)

**Service Assertions**
- `user_feedback` triggers `adaptProgram()`.

**PASS**
- `program_feedback` создан + `program_versions` обновлён.

**Expected Transitions**
- `feedback_submitted → replan_requested`.

---

# Scenario 103 — Trust updates from adherence (v2)

**DB Assertions (SQL)**
- Trust score updated after adherence change.

**PASS**
- `ai_trust_scores.trust_score` изменён.

**Expected Transitions**
- `adherence_changed → trust_updated`.

---

# Scenario 104 — Free tier gating (v2)

**Service Assertions**
- Free users get view‑only + basic day card.

**PASS**
- Explainability details скрыты, доступ только на чтение.

**Expected Transitions**
- `free_request → view_only`.

---

# Scenario 105 — Pro tier: adaptation + explainability (v2)

**Service Assertions**
- Pro enables adaptation + explainability + history.

**PASS**
- Полная explainability и история версий доступны.

**Expected Transitions**
- `pro_request → adaptive_plan_ready`.

---

# Scenario 106 — Vision Pro live adjustments (v2)

**Service Assertions**
- Vision Pro enables spatial coach hooks and live adjustments.

**PASS**
- Ответ включает флаг `vision_pro`/`spatial_ready`.

**Expected Transitions**
- `vision_request → live_adjust_ready`.

---

# Scenario 107 — Explainability UI model (v2)

**DB Assertions (SQL)**
- `program_explainability.decision_ref` present for day view.

**PASS**
- UI модель “Почему так?” формируется из `decision_ref` + `guard_notes`.

**Expected Transitions**
- `day_loaded → explainability_rendered`.

---

# Scenario 108 — Version diff visible (v2)

**Service Assertions**
- Diff summary between versions returned.

**PASS**
- `diff_summary` доступен по версии.

**Expected Transitions**
- `history_viewed → diff_visible`.

---

# Scenario 109 — Status transitions (v2)

**Service Assertions**
- `active ↔ adapted ↔ paused ↔ completed` transitions valid.

**PASS**
- `getProgramStatus` возвращает корректный статус.

**Expected Transitions**
- `status_change → ui_state_updated`.

---

# Scenario 110 — Explainability gating by entitlement (v2)

**Service Assertions**
- Free users see summary; Pro sees full explainability.

**PASS**
- Entitlement gating применяется в delivery‑слое.
**Expected Transitions**
- `free_view → summary_only`, `pro_view → full_explainability`.

---

# Scenario 111 — Onboarding → plan delivery (v2)

**Service Assertions**
- Goal saved → program available in delivery layer.

**Expected Transitions**
- `goal_saved → program_ready`.

---

# Scenario 112 — Today screen loads (v2)

**Service Assertions**
- Today DTO includes plan + status + summary explainability.

**Expected Transitions**
- `app_open → today_ready`.

---

# Scenario 113 — My Program timeline (v2)

**Service Assertions**
- Phases/blocks timeline renders with current version.

**Expected Transitions**
- `program_opened → timeline_ready`.

---

# Scenario 114 — Progress screen updates (v2)

**Service Assertions**
- Adherence + streaks based on completed days.

**Expected Transitions**
- `day_completed → progress_updated`.

---

# Scenario 115 — Why this plan (v2)

**Service Assertions**
- Explainability details shown with KB refs.

**Expected Transitions**
- `why_opened → explainability_full`.

---

# Scenario 116 — Paywall gating (v2)

**Service Assertions**
- Pro features blocked for Free.

**Expected Transitions**
- `free_request → paywall`.

---

# Scenario 117 — Offline read‑only (v2)

**Service Assertions**
- Cached Today/My Program renders without network.

**Expected Transitions**
- `offline → readonly`.

---

# Scenario 118 — Vision Pro spatial hooks (v2)

**Service Assertions**
- Vision Pro returns spatial flags in DTO.

**Expected Transitions**
- `vision_mode → spatial_ready`.

---

# Scenario 119 — Adaptation UX notice (v2)

**Service Assertions**
- Adaptation timeline shows reason_code + diff.

**Expected Transitions**
- `adapted → notice_rendered`.

---

# Scenario 120 — Feedback loop state (v2)

**Service Assertions**
- Feedback triggers pending adaptation state.

**Expected Transitions**
- `feedback_sent → adaptation_pending`.

---

# Scenario 121 — Pause/resume UX (v2)

**Service Assertions**
- UI reflects paused status and resume action.

**Expected Transitions**
- `paused → resume_available`.

---

# Scenario 131 — Free user blocked from adaptation (v2)

**Service Assertions**
- Free tier receives paywall when requesting adapt.

**Expected Transitions**
- `adapt_request → paywall`.

---

# Scenario 132 — Pro user full pipeline (v2)

**Service Assertions**
- Pro tier accesses generation + adaptation + explainability.

**Expected Transitions**
- `pro_request → full_pipeline`.

---

# Scenario 133 — Vision Pro spatial locked (v2)

**Service Assertions**
- Vision Pro spatial features blocked without entitlement.

**Expected Transitions**
- `vision_feature → locked`.

---

# Scenario 134 — Vision Pro spatial unlocked (v2)

**Service Assertions**
- Vision Pro entitlement unlocks spatial features.

**Expected Transitions**
- `vision_entitled → spatial_enabled`.

---

# Scenario 135 — Paywall on explainability (v2)

**Service Assertions**
- Free tier sees summary; detailed explainability paywalled.

**Expected Transitions**
- `explainability_request → summary_only`.

---

# Scenario 136 — Restore purchase (v2)

**Service Assertions**
- Restore action re‑enables entitlements.

**Expected Transitions**
- `restore_request → entitlements_restored`.

---

# Scenario 137 — Guard overrides monetization (v2)

**Service Assertions**
- Guard blocks unsafe actions regardless of tier.

**Expected Transitions**
- `unsafe_action → blocked`.

---

# Scenario 138 — Trust still gates depth (v2)

**Service Assertions**
- Low trust reduces plan depth even on Pro.

**Expected Transitions**
- `low_trust → depth_reduced`.

---

# Scenario 139 — Upgrade after plan generation (v2)

**Service Assertions**
- Paywall shown after plan generation for Free.

**Expected Transitions**
- `plan_generated → paywall`.

---

# Scenario 140 — Billing provider switch (v2)

**Service Assertions**
- App Store / Play billing selection routed by platform.

**Expected Transitions**
- `platform_detected → provider_selected`.

# Scenario 141 — Onboarding completed (v2)

**Service Assertions**
- User profile + goal saved.

**Expected Transitions**
- `onboarding_done → goal_saved`.

---

# Scenario 142 — Goal → Result → Gate (v2)

**Service Assertions**
- Goal saved + nutrition targets saved regardless of entitlement.
- Gate blocks program generation for non‑Premium.

**Expected Transitions**
- `goal_saved → result_shown → gate_checked`.

---

# Scenario 143 — Today available only with active plan (v2)

**Service Assertions**
- Today DTO loads only if Premium + Follow Plan.

**Expected Transitions**
- `follow_plan → today_loaded`.

---

# Scenario 144 — Follow Plan activates Today (v2)

**Service Assertions**
- Follow Plan marks program active + creates program_session for day.

**Expected Transitions**
- `follow_plan → program_active → session_created`.

---

# Scenario 145 — Planned meal completion (v2)

**Service Assertions**
- Planned meal writes to `food_diary_entries` + updates `program_sessions`.

**Expected Transitions**
- `meal_complete → diary_written → session_updated`.

---

# Scenario 146 — Planned workout completion/skip (v2)

**Service Assertions**
- Workout complete/skip writes `training_entries` + `program_sessions`.

**Expected Transitions**
- `workout_complete|skip → diary_written → session_updated`.

---

# Scenario 147 — Feedback triggers adaptation (v2)

**Service Assertions**
- Feedback saved to `program_feedback` and triggers `adaptProgram`.

**Expected Transitions**
- `feedback → adaptation_created`.

---

# Scenario 148 — Program cancelled disables Today (v2)

**Service Assertions**
- Today disabled; diaries remain manual.

**Expected Transitions**
- `program_cancelled → today_disabled`.

---

# Scenario 149 — Paywall shown when locked (v2)

**Service Assertions**
- Paywall appears for Free on gated feature.

**Expected Transitions**
- `locked_feature → paywall`.

---

# Scenario 150 — Explainability shown (v2)
---

# Scenario 151 — Progress aggregates sources (v2)

**Service Assertions**
- Progress aggregates goal + measurements + nutrition + training.

**Expected Transitions**
- `progress_opened → aggregated → rendered`.

---

# Scenario 152 — Plan adherence visible only with Follow Plan (v2)

**Service Assertions**
- Plan adherence appears only for active plan users.

**Expected Transitions**
- `follow_plan → adherence_visible`.

---

# Scenario 153 — Goal change recalculates trajectory (v2)

**Service Assertions**
- Goal update recalculates progress trajectory and forecasts.

**Expected Transitions**
- `goal_updated → trajectory_rebuilt`.

---

# Scenario 154 — Measurements update progress charts (v2)

**Service Assertions**
- New measurement/photo updates progress charts and timeline.

**Expected Transitions**
- `measurement_added → charts_updated`.

---

# Scenario 155 — Nutrition deviation reflected (v2)

**Service Assertions**
- Over/under target macros reflected in nutrition timeline.

**Expected Transitions**
- `diary_updated → nutrition_timeline_updated`.

---

# Scenario 156 — Training PR reflected (v2)

**Service Assertions**
- New PR or volume change reflected in training timeline.

**Expected Transitions**
- `training_logged → training_timeline_updated`.

---

# Scenario 157 — Custom habit created (v2)

**Service Assertions**
- Custom habit saved with frequency + reminders.

**Expected Transitions**
- `habit_created → habit_visible`.

---

# Scenario 158 — Habit archived/removed (v2)

**Service Assertions**
- Habit archived; no longer shows in active list.

**Expected Transitions**
- `habit_archived → habit_hidden`.

---

# Scenario 159 — Streak impacts trust score (v2)

**Service Assertions**
- Habit streak updates trust score inputs.

**Expected Transitions**
- `streak_updated → trust_adjusted`.

---

# Scenario 160 — Relapse triggers adaptation (v2)

**Service Assertions**
- Habit relapse contributes to adaptation/relief decision.

**Expected Transitions**
- `relapse_detected → adaptation_triggered`.

---

# Scenario 161 — Explainability references habits (v2)

**Service Assertions**
- Explainability includes habit factors.

**Expected Transitions**
- `why_opened → habits_explained`.

---

# Scenario 162 — System habits toggle (v2)

**Service Assertions**
- System habit enabled/disabled per user.

**Expected Transitions**
- `habit_toggled → habit_state_updated`.

---

# Scenario 163 — Habit streak recovery (v2)

**Service Assertions**
- Recovery after lapse resets streak but keeps history.

**Expected Transitions**
- `streak_reset → recovery_flow`.

---

# Scenario 164 — Habit affects Progress timeline (v2)

**Service Assertions**
- Habit adherence displayed in Progress timeline.

**Expected Transitions**
- `progress_opened → habits_timeline_rendered`.

---

# Scenario 165 — Habit affects program gating (v2)

**Service Assertions**
- Habit compliance influences plan difficulty or reminders.

**Expected Transitions**
- `habit_compliance → plan_adjusted`.

---

# Scenario 166 — Manual mode full journey (v2)

**Service Assertions**
- Manual mode skips Today but still builds Progress.

**Expected Transitions**
- `manual_selected → diaries_only → progress_updated`.

---

# Scenario 167 — Follow Plan full journey (v2)

**Service Assertions**
- Follow Plan activates Today + auto‑sync to diaries + Progress.

**Expected Transitions**
- `follow_plan → today_active → progress_updated`.

---

# Scenario 168 — Explainability across sources (v2)

**Service Assertions**
- Explainability references Goal/Measurements/Food/Training/Habits.

**Expected Transitions**
- `why_opened → multi_source_explainability`.

---

# Scenario 169 — Trust score affected by adherence (v2)

**Service Assertions**
- Adherence and habit streaks adjust trust.

**Expected Transitions**
- `adherence_changed → trust_recomputed`.

---

# Scenario 170 — Adaptation triggered by cross‑signals (v2)

**Service Assertions**
- Low adherence + fatigue + habit relapse trigger adaptation.

**Expected Transitions**
- `signals_detected → adaptation_triggered`.

---

# Scenario 171 — Profile update saved (v2)

**Service Assertions**
- Profile fields saved and reflected in UI.

**Expected Transitions**
- `profile_edit → profile_saved`.

---

# Scenario 172 — Subscription status shown (v2)

**Service Assertions**
- Current tier and renewal date displayed.
- Paywall shows reason when access is locked.

**Expected Transitions**
- `billing_loaded → subscription_visible`.

---

# Scenario 173 — Payment history visible (v2)

**Service Assertions**
- Billing history and receipts accessible.

**Expected Transitions**
- `payments_opened → history_rendered`.

---

# Scenario 174 — Cancel subscription (v2)

**Service Assertions**
- Subscription canceled, entitlement downgraded after period.

**Expected Transitions**
- `cancel_requested → cancel_scheduled`.

---

# Scenario 175 — Restore subscription (v2)

**Service Assertions**
- Restore flow re‑enables entitlements.

**Expected Transitions**
- `restore_requested → entitlements_restored`.

---

# Scenario 176 — Notifications read/archive (v2)

**Service Assertions**
- Notifications delivered and can be marked read/archived/deleted.

**Expected Transitions**
- `notification_action → status_updated`.

---

# Scenario 177 — Settings permissions update (v2)

**Service Assertions**
- Permissions toggles saved and respected.

**Expected Transitions**
- `settings_changed → permissions_saved`.

---

# Scenario 178 — Privacy toggles (v2)

**Service Assertions**
- Analytics/personalization/AI toggles saved.

**Expected Transitions**
- `privacy_toggle → preference_saved`.

---

# Scenario 179 — Support ticket created (v2)

**Service Assertions**
- Support message saved and listed.

**Expected Transitions**
- `support_sent → ticket_created`.

---

# Scenario 180 — Legal consent recorded (v2)

**Service Assertions**
- User consent stored for required docs.
- Blocking until consent for required legal screens.

**Expected Transitions**
- `consent_given → consent_saved`.

---

# Scenario 181 — Data export requested (v2)

**Service Assertions**
- Data export request queued.

**Expected Transitions**
- `export_requested → export_queued`.

---

# Scenario 182 — Account deletion (v2)

**Service Assertions**
- Account deletion request processed.

**Expected Transitions**
- `delete_requested → account_deleted`.

---

# Scenario 183 — Medical disclaimer accepted (v2)

**Service Assertions**
- Disclaimer acceptance recorded before coaching.

**Expected Transitions**
- `disclaimer_accepted → coaching_enabled`.

---

# Scenario 184 — Promo code applied (v2)

**Service Assertions**
- Promo code applied to subscription.

**Expected Transitions**
- `promo_applied → billing_updated`.

---

# Scenario 185 — Contact details updated (v2)

**Service Assertions**
- Email/phone updated with verification.

**Expected Transitions**
- `contact_update → verified`.

---

# Scenario 186 — Return after skip (v2)

**Service Assertions**
- Soft return flow shown after missed days.

**Expected Transitions**
- `skip_detected → return_flow`.

---

# Scenario 187 — Anxiety reduction cue (v2)

**Service Assertions**
- Coach provides calm, non‑judgmental cue.

**Expected Transitions**
- `anxiety_signal → calming_message`.

---

# Scenario 188 — Pain support (v2)

**Service Assertions**
- Safety‑first message and reduced load suggestion.

**Expected Transitions**
- `pain_reported → safety_support`.

---

# Scenario 189 — Micro‑success praise (v2)

**Service Assertions**
- Positive reinforcement for small wins.

**Expected Transitions**
- `micro_success → praise_shown`.

---

# Scenario 190 — Dialog instead of push (v2)

**Service Assertions**
- In‑app dialog used before push.

**Expected Transitions**
- `low_engagement → dialog_prompt`.

---

# Scenario 191 — Burnout relief (v2)

**Service Assertions**
- Load reduced after fatigue pattern.

**Expected Transitions**
- `fatigue_detected → relief_plan`.

---

# Scenario 192 — Soft re‑activation after pause (v2)

**Service Assertions**
- Gentle restart without penalty.

**Expected Transitions**
- `paused → soft_restart`.

---

# Scenario 193 — Minimal plan on overload (v2)

**Service Assertions**
- Minimal plan recommended on overload.

**Expected Transitions**
- `overload → minimal_plan`.

---

# Scenario 194 — Low trust support (v2)

**Service Assertions**
- Coaching tone softens when trust is low.

**Expected Transitions**
- `trust_low → soft_tone`.

---

# Scenario 195 — Emotional explainability (v2)

**Service Assertions**
- Reasons explained in empathetic tone.

**Expected Transitions**
- `why_opened → emotional_explain`.

---

# Scenario 196 — Anonymous comparison (v2)

**Service Assertions**
- Safe anonymized comparison shown.

**Expected Transitions**
- `comparison_opened → anonymized_view`.

---

# Scenario 197 — Milestone sharing (v2)

**Service Assertions**
- Shareable milestone generated.

**Expected Transitions**
- `milestone_reached → share_ready`.

---

# Scenario 198 — Crisis safe mode (v2)

**Service Assertions**
- Crisis mode reduces demands.

**Expected Transitions**
- `crisis_signal → safe_mode`.

---

# Scenario 199 — Recovery‑first plan (v2)

**Service Assertions**
- Recovery‑first plan delivered.

**Expected Transitions**
- `recovery_needed → recovery_plan`.

---

# Phase 8 — Platform Intelligence & AI Coach (E2E 200–240)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
200 | Возврат через 90 дней | Поднимает долгосрочный дайджест | Карточка "Вспомним путь" | Память по согласию | Не поднимать чувствительные темы | Источники + даты | Дайджест + opt-out
201 | Обновление ценностей/идентичности | Обновляет граф идентичности | Мастер "Что важно сейчас" | Подтверждение изменений | Без навязывания | Что изменилось и почему | Граф обновлен и версионирован
202 | Запрос "что ты помнишь" | Формирует реестр памяти | Экран "Memory Ledger" | Полная прозрачность | Редакция чувствительного | Правила хранения | Реестр доступен
203 | Удаление периода/темы | Пурж + переиндексация | Поток удаления памяти | Мгновенное подтверждение | Жесткое удаление чувствительного | Что удалено | Нельзя восстановить
204 | Конфликт прошлой цели с новой | Запрашивает уточнение | Экран выбора приоритетов | Без давления | Без чувства вины | Причина конфликта | Цель согласована
205 | Использование памяти в совете | Персонализирует совет | Ссылка на прошлый опыт | Явная ссылка на память | Избегать травматичных тем | Указание источника | Можно отключить использование
206 | Сигналы выгорания | Входит в safe-mode | Мягкое снижение нагрузки | Тон мягче | Снижение нагрузки | Какие сигналы | Safe-mode активен
207 | Кризисный триггер в диалоге | Запускает кризисный протокол | Поддержка + ресурсы | Эмпатичные границы | Только поддержка | Почему эскалация | Протокол выполнен
208 | Регресс в прогрессе | Перестраивает план | Narrative о регрессе | Без обвинений | Без агрессии | Контекст тренда | План адаптирован
209 | Сообщение о боли | Блокирует риск | Карточка поддержки боли | Safety-first | Блок опасных действий | Причина блокировки | Риск блокирован
210 | Паттерн низкого настроения | Снижает интенсивность | Режим "низкой энергии" | Добровольный чек-ин | Без давления | Сигналы настроения | Каденс снижен
211 | Запрос на смену цели | Пересбор траектории | Мастер эволюции цели | Пользователь ведет | Плавные шаги | Diff целей | Новая траектория
212 | Смена жизненной фазы | Адаптирует расписание | Таймлайн фазы | Признание контекста | Снижение нагрузки | Маппинг фазы | Расписание обновлено
213 | Травма/инцидент | Переходит в recovery | Recovery-трек | Заботный тон | Блок риска | Риск-обоснование | Только безопасный план
214 | Планируемая пауза | Включает pause-mode | Пауза с датой возврата | Без штрафа | Поддерживающие советы | Причина паузы | Пауза сохранена
215 | Возврат после паузы | Легкий ре-онбординг | Мягкий старт | "Рады возвращению" | Низкая интенсивность | Почему перезапуск | База пересчитана
216 | Совет изменился со временем | Формирует change-log | Экран "Что изменилось" | Явный дифф | Консервативная альтернатива | Причины и коды | Дифф доступен
217 | Смена версии плана | Сравнивает версии | Сравнение v3 vs v2 | История видна | Есть rollback | Источники + confidence | Compare работает
218 | Низкий trust-score | Снижает сложность | Путь восстановления доверия | Прозрачный статус | Без давления | Драйверы trust | План упрощен
219 | Пользователь задает "почему" | Поясняет доказательно | Карточка "Почему" | Ссылки на данные | Без мед. обещаний | Линия данных | Источники указаны
220 | Конфликт метрик во времени | Помечает неопределенность | Уведомление об уверенности | Признание границ | Safe default | Confidence decay | Неопределенность показана
221 | Срыв (slip) | Запускает recovery loop | Маленький следующий шаг | Доброжелательный тон | Без перегруза | Триггер срыва | Recovery путь есть
222 | Повторные срывы | Упрощает план | Сброс ритма | Без стыда | Снижение объема | Причина паттерна | План упрощен
223 | Резкий всплеск мотивации | Ставит безопасные рамки | "Направим энергию" | Границы прозрачны | Предотвратить перегруз | Риск-пояснение | Капы применены
224 | Возврат после срыва | Подкрепляет устойчивость | Narrative о росте | Подчеркивает устойчивость | Ровный темп | Метрики восстановления | Подкрепление показано
225 | Долгое плато | Перефрейм + микроцели | "Плато — фаза" | Поддержка | Без резких действий | Анализ тренда | План плато активен
226 | Калибровка личности коуча | Меняет тон | Настройки тона | Контроль пользователя | Нет давления | Настройки объяснены | Prefs применены
227 | Отказ от совета | Предлагает альтернативы | Выбор из 2 опций | Без наказаний | Только безопасные опции | Трейд-оффы | Альтернатива дана
228 | Долгосрочный этап отношений | Формирует годовой обзор | Year-in-review | Аутентичное признание | Без апсейла | Источники таймлайна | Обзор доступен
229 | Обновление модели коуча | Публикует изменения | Экран "Что нового" | Прозрачность версии | Ограничения поведения | Changelog | Версия показана
230 | Риск дрейфа персоны | Запускает guard-аудит | Уведомление аудита | Последовательность тона | Этические границы | Результат guard | Дрейф заблокирован
231 | Запрос на поддержку сообщества | Предлагает группы | Список opt-in групп | Без рейтингов | Модерация | Критерии подбора | Только opt-in
232 | Запрос сравнения | Анонимные бенчмарки | Безопасное сравнение | Нет стыда | Ограниченные метрики | Источники | Анонимность гарантирована
233 | Эскалация к специалисту | Роутинг к эксперту | Запись на консультацию | Четкие границы | Мед. дисклеймеры | Причина направления | Реферал записан
234 | Инцидент в сообществе | Модерация | Подтверждение жалобы | Защита пользователя | Блок нарушителя | Принятое действие | Кейс закрыт
235 | Настройка поддержки | Меняет частоту контакта | Выбор каденса | Контроль | Без спама | Почему так часто | Каденс сохранен
236 | Подключение wearable | Синхронизирует метрики | Экран успешной связи | Контроль данных | Согласие обязательно | Какие данные используются | Синк активен
237 | Сессия в Vision Pro | Включает spatial coach | Иммерсивные подсказки | Контекст устройства | Guard overlay | Почему подсказка | Spatial режим работает
238 | B2B-подключение | Разделяет профили | Тумблер "Рабочий профиль" | Разделение данных | Нет доступа работодателя | Границы приватности | Скоупы соблюдены
239 | Интеграция с клиникой | Делится отчетом по согласию | Поток share | Явное согласие | Минимально необходимое | Что передано | Согласие записано
240 | Life OS интеграции | Связывает цели жизни | Дашборд жизненных целей | Холистичный фрейм | Без перегруза | Междоменные связи | Связанные цели активны

# Phase 8 — Coach Memory & Relationship (E2E 241–245)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
241 | Накопление доверия | Повышает trust_level | Мягкое подтверждение пути | Доверие растет | Без давления | Почему доверие выросло | Trust updated
242 | Изменение тона коуча | Переключает emotional_mode | Карточка "Тон изменился" | Прозрачность | Без манипуляций | Причины тона | Тон согласован
243 | Память о прошлых целях | Поднимает историю целей | Человеческое напоминание | Контекст по согласию | Без чувствительных деталей | Источники памяти | Цели связаны
244 | Повторный срыв | Усиливает recovery‑поддержку | Мягкий диалог возврата | Без стыда | Safe‑mode при рисках | Причина поддержки | Возврат запущен
245 | Долгосрочная мотивация | Формирует мотивационный цикл | Микро‑вехи на месяцы | Устойчивость | Без перегруза | Логика горизонта | Цикл активен

# Phase 8 — Coach Memory Persistence (E2E 246–250)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
246 | Перезапуск сессии | Загружает долгосрочный профиль | Тон сохранен | Последовательность | Без рисков | История подтверждена | Профиль восстановлен
247 | Старые цели | Поднимает goal history | Напоминание о пути | Контекст | Без давления | Ссылки на историю | Цели связаны
248 | Долгий горизонт | Сдвигает тон | Более спокойный ритм | Доверие выше | Без перегруза | Причины тона | Тон устойчив
249 | Повторяющийся паттерн | Усиливает профилактику | Мягкое предупреждение | Уважение границ | Safe‑default | Источники паттерна | Паттерн учтен
250 | Возврат после отсутствия | Восстанавливает trust curve | Поддержка возвращения | Восстановление доверия | Без давления | Логика восстановления | Доверие восстановлено

# Phase 8 — Coach Runtime Integration (E2E 251–255)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
251 | Прошлый срыв через месяц | Коуч вспоминает факт | Мягкое напоминание | Доверие не рушится | Без стыда | Ссылка на память | Память корректна
252 | Серия пропусков | Меняет тон на осторожный | Спокойная поддержка | Без давления | Safe‑tone | Причина тона | Тон снижен
253 | Доверие низкое | Мягкое восстановление | Поддержка без требований | Trust‑repair | Без рисков | Логика доверия | Доверие растет
254 | Нагрузка снижена | Объясняет причину | Карточка “почему” | Прозрачность | Безопасность | Memory + safety | Объяснение есть
255 | Manual vs Follow Plan | Разный тон и CTA | Персональный путь | Уважение выбора | Без давления | Основание выбора | Режим учтен

# Phase 8 — Coach UI Integration (E2E 256–260)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
256 | Пропуск дня (Today) | Коуч реагирует | CoachMessageCard | Мягкий тон | Без давления | Причина реакции | Реакция видна
257 | Плато (Progress) | Коуч объясняет | CoachTimelineComment + dialog | Уверенность | Safe‑tone | Источник тренда | Объяснение видно
258 | Адаптация плана | Коуч объясняет | CoachExplainabilityDrawer | Прозрачность | Safety‑rails | Memory trace | Объяснение доступно
259 | Прошлый успех | Коуч вспоминает | CoachMessageCard | Доверие растет | Без сравнения | Ссылка на память | Память корректна
260 | Серия пропусков | Коуч меняет тон | CoachNudge + support | Trust‑repair | Без давления | Причина тона | Тон адаптирован

# Phase 8 — Coach Event Integration (E2E 261–270)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
261 | 3 дня пропуска | Тон → support | Мягкий коуч‑слой | Trust‑repair | Без давления | Причина тона | Тон изменен
262 | Восстановление | Память о цикле | CoachMessageCard | Доверие растет | Без стыда | Ссылка на память | Цикл узнан
263 | Плато | Стабилизация | CoachExplainability | Нормализация | Safe‑tone | Объяснение тренда | Плато объяснено
264 | Отмена плана | Сохранение отношений | Support + выбор пути | Уважение | Без давления | Основание решения | Отношения сохранены
265 | Возврат через месяц | Поднимает цели | Welcome‑back | Доверие | Без давления | Память о целях | Цели связаны
266 | Еда залогирована | Реакция коуча | CoachNudge | Мягкая поддержка | Без давления | Контекст еды | Реакция есть
267 | Недобор белка | Подсказка | CoachMessageCard | Без стыда | Safe‑tone | Основание | Подсказка дана
268 | Тренировка завершена | Укрепляет тон | CoachMessageCard | Доверие растет | Без перегруза | История дня | Реакция есть
269 | Пропуск тренировки | Умягчение | CoachMessageCard | Trust‑repair | Без давления | Причина | Тон снижен
270 | Усталость/боль | Safety‑mode | CoachSafetyBanner | Без риска | Safety‑first | Причина | Safety включен

# Phase 8 — Coach Explainability & Premium Gating (E2E 271–280)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
271 | Free vs Premium | Free: короткий ответ, Premium: глубокий | CoachCard | Прозрачность | Без давления | Ясная разница | Гейтинг виден
272 | Месячная память | Коуч вспоминает событие 30 дней назад | CoachMessageCard | Доверие растет | Без стыда | Ссылка на память | Память корректна
273 | Повторный паттерн | Коуч меняет стратегию | CoachDialog | Trust‑repair | Safe‑tone | Причина смены | Тон адаптирован
274 | «Откуда это?» | Коуч объясняет базу | CoachExplainabilityDrawer | Прозрачность | Без риска | Источники данных | Объяснение есть
275 | Перерыв > 14 дней | Мягкое восстановление доверия | CoachMessageCard | Trust‑repair | Без давления | История учтена | Доверие растет
276 | Выгорание | Тон снижен + safety | CoachSafetyBanner | Забота | Safety‑first | Причина | Эскалация корректна
277 | Реальное действие | Мгновенная реакция | CoachNudge | Поддержка | Без давления | Контекст события | Реакция мгновенна
278 | Memory trace | Показ связанной памяти | CoachExplainabilityDrawer | Прозрачность | Без риска | Memory refs | Trace отображён
279 | Trust timeline | Скрыт в Free / виден в Premium | CoachExplainabilityDrawer | Честность | Без давления | Гейтинг доверия | Гейтинг работает
280 | Эмоциональная глубина | Free: нейтрально, Premium: адаптивно | CoachMessageCard | Мягкий тон | Без давления | Причина тона | Тон различается

# Phase 8 — Production Hardening & Alpha Readiness (E2E 281–300)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
281 | Memory cleared | Сброс тона и памяти | CoachMessageCard | Новый старт | Без давления | Память сброшена | Тон reset
282 | Crisis input | Safe‑mode включен | CoachSafetyBanner | Поддержка | Safety‑first | Причина | Crisis handled
283 | Offline runtime | Fallback коуч | CoachNudge | Спокойно | Без риска | Limited explain | Degrade ok
284 | High latency | Graceful response | CoachMessageCard | Без ожидания | Safe‑tone | Без деталей | SLA ok
285 | Memory service down | Simplified coach | CoachMessageCard | Trust‑safe | Без риска | Explainable fallback | Works
286 | Explainability failure | Без деталей | CoachExplainabilityDrawer | Прозрачно | Без риска | “Без деталей” | Copy ok
287 | Premium downgrade | Снижение глубины | CoachMessageCard | Честно | Без давления | Причина | Depth reduced
288 | Trust rebuild | Мягкая динамика | CoachMessageCard | Trust‑repair | Без давления | История учтена | Trust grows
289 | Long absence | Warm return | CoachDialog | Поддержка | Safe‑tone | История учтена | Return ok
290 | Circuit breaker open | Коуч молчит | No coach UI | Без давления | Без риска | — | Silent ok
291 | Emotion calc failure | Neutral tone | CoachMessageCard | Без давления | Safe‑tone | Причина | Neutral ok
292 | Memory TTL | Старые события удалены | CoachExplainabilityDrawer | Честность | Без давления | TTL applied | TTL ok
293 | Data minimization | Сжатие payload | Backend only | Trust‑safe | Safe‑tone | — | Minimize ok
294 | Trust telemetry | Метрики обновлены | — | Observed | — | — | Metrics ok
295 | Explainability latency | Telemetry recorded | — | Observed | — | — | Metrics ok
296 | Memory hits | Telemetry recorded | — | Observed | — | — | Metrics ok
297 | Helpfulness score | Captured | — | Observed | — | — | Metric ok
298 | Engagement loop | Daily return | UX nudge | Support | Safe‑tone | — | Return tracked
299 | Compliance check | Disclaimer route | CoachSafetyBanner | Без давления | Safety‑first | Причина | Disclaimer ok
300 | Alpha readiness | All checks pass | — | Trust‑safe | Safe‑tone | Explainable | Ready

# Phase 8 — User‑Initiated Coach Interaction (E2E 301–305)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
301 | Пользователь вызывает коуча | Ответ по запросу | CoachDialog | Уверенность | Safe‑tone | Trace доступен | Ответ есть
302 | «Почему план изменился» | Разъяснение | Explainability + data_sources | Прозрачность | Без давления | Основание | Пояснение есть
303 | «Почему у меня плато» | Нормализация | Support + explain | Без стыда | Safe‑tone | Источники | Плато объяснено
304 | «Поддержи после срыва» | Мягкая поддержка | CoachDialog | Trust‑repair | Без давления | Причина тона | Тон корректен
305 | Free vs Premium запрос | Разная глубина | CoachDialog | Честность | Без давления | Гейтинг памяти | Разница видна

# Scenario 122 — Blocked day warning (v2)

**Service Assertions**
- Guard‑blocked day shows safety warning.

**Expected Transitions**
- `guard_blocked → warning_shown`.

---

# Scenario 123 — Version diff view (v2)

**Service Assertions**
- User can view diff between versions.

**Expected Transitions**
- `history_opened → diff_ready`.

---

# Scenario 124 — PDF export (v2)

**Service Assertions**
- Program exported to PDF with summary.

**Expected Transitions**
- `export_requested → pdf_ready`.

---

# Scenario 125 — Notification nudge (v2)

**Service Assertions**
- Missed day triggers nudge within safe window.

**Expected Transitions**
- `missed_day → nudge_sent`.

---

# Scenario 126 — Entitlement upgrade unlock (v2)

**Service Assertions**
- Upgrade enables explainability + adaptation.

**Expected Transitions**
- `upgrade → pro_features_enabled`.

---

# Scenario 127 — Vision Pro day preview (v2)

**Service Assertions**
- Spatial preview available in Vision Pro.

**Expected Transitions**
- `vision_preview → spatial_card_ready`.

---

# Scenario 128 — Guard resume after recovery (v2)

**Service Assertions**
- Recovery clears paused status.

**Expected Transitions**
- `recovery_complete → program_resumed`.

---

# Scenario 129 — Monetization funnel analytics (v2)

**Service Assertions**
- Paywall views and upgrades logged.

**Expected Transitions**
- `paywall_viewed → analytics_logged`.

---

# Scenario 130 — Audit trail for plan delivery (v2)

**Service Assertions**
- Delivery events logged with version + user_id.

**Expected Transitions**
- `delivery_event → audit_logged`.

# Phase 8 — Voice Coach Layer (E2E 306–310)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
306 | Premium voice support | Голосовая поддержка после пропуска | Voice coach | Support | Safe‑tone | Причина | Voice ok
307 | Free voice gated | Кнопка заблокирована | Voice button | Честно | Без давления | Пояснение | Gate ok
308 | Safety voice | Тон осторожный | Voice safety | Trust‑safe | Safety‑first | Причина | Safe voice ok
309 | Voice plan explanation | Голос объясняет адаптацию | Voice explain | Прозрачность | Без давления | Источники | Explain ok
310 | Voice disabled | Голос выключен | Settings | Уважение | Без давления | — | Voice off

# Phase 8.2.5.1 — Voice UX, Settings & Trust (E2E 311–320)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
311 | Voice toggle on/off | Настройки сохраняются | Profile | Control | Safe | Почему | Saved
312 | Risk-only | Голос только при риске | Voice | Support | Risk‑only | Сигналы | OK
313 | Free demo | 1 реплика в неделю | Voice demo | Честно | Safe | Причина | Limit
314 | Premium dialog | Голос в диалоге | Dialog | Trust | Safe | Причина | Voice dialog
315 | Silent mode | Голос молчит | Quiet | Respect | Safe | Причина | Silent
316 | Cooldown after ignore | Пауза после игнора | Quiet | Respect | Safe | Причина | Cooldown
317 | Voice explainability | Почему голос | Drawer | Trust | Safe | Voice reason | Visible
318 | Voice tone shift | Тон меняется | Voice | Trust | Safe | Tone reason | OK
319 | Voice in risk | Без давления, кризисный тон | Voice safety | Trust‑safe | Crisis | Причина | OK
320 | Paywall reason | Голос = живое сопровождение | Paywall | Честно | Safe | Объяснение | Copy ok

# Phase 8.2.6 — Decision Companion (E2E 321–340)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
321 | Decision under fatigue | Мягкая поддержка | Decision card | Support | Safety | Почему сейчас | OK
322 | Decision after relapse | Рефрейм без стыда | Decision card | Trust | Safe | Основание | OK
323 | Decision low trust | Возврат контроля | Decision card | Trust repair | Safe | Почему сейчас | OK
324 | Decision to pause | Уважение к паузе | Decision card | Respect | Safe | Альтернативы | OK
325 | Decision to return | Мягкий старт | Decision card | Support | Safe | Основание | OK
326 | Decision cancel premium | Без давления | Paywall | Trust | Safe | Объяснение | OK
327 | Goal change | Уточнение цели | GoalResult | Support | Safe | Альтернативы | OK
328 | Plan cancel | Без обвинений | MyProgram | Trust | Safe | Почему сейчас | OK
329 | Long pause > N days | Без давления | MyProgram | Support | Safe | Основание | OK
330 | Plateau choice | План действия | Progress | Trust | Safe | Основание | OK
331 | Return after pause | Мягкий ритм | Progress | Support | Safe | Альтернативы | OK
332 | Subscription doubt | Рефрейм ценности | Paywall | Trust | Safe | Объяснение | OK
333 | Profile reset | Бережный старт | Profile | Support | Safe | Альтернативы | OK
334 | Decision w/ safety flags | Protect mode | Decision card | Safety | Crisis | Почему | OK
335 | Decision in Manual | Поддержка без давления | Decision card | Respect | Safe | Основание | OK
336 | Decision in Follow Plan | Уточнение шага | Decision card | Trust | Safe | Основание | OK
337 | Premium decision history | История решений | Decision log | Trust | Safe | Следы | OK
338 | Free decision gating | Без памяти | Decision card | Honest | Safe | Причина | OK
339 | Voice decision rationale | Тон объяснён | Explainability | Trust | Safe | Voice | OK
340 | Autonomy preserved | Выбор за пользователем | Decision UI | Respect | Safe | Альтернативы | OK

# Phase 8.3 — Production Hardening & Observability (E2E 341–360)

ID | Trigger | System Reaction | UX | Trust | Safety | Explainability | DoD
---|---|---|---|---|---|---|---
341 | Runtime timeout | Fallback support‑only | No crash | Stable | Safe | Minimal | OK
342 | Memory error | Memory bypass | Calm copy | Trust‑safe | Safe | Limited | OK
343 | Explainability failure | Drawer fallback | UI stable | Trust‑safe | Safe | Disabled | OK
344 | Feature flag off | Coach absent | No UI errors | Neutral | Safe | N/A | OK
345 | Kill switch on | Coach fully bypass | Silent | Neutral | Safe | N/A | OK
346 | Slow network | Offline snapshot | No white screen | Stable | Safe | Deferred | OK
347 | Budget exceeded (response) | Lightweight response | Visible | Calm | Safe | Limited | OK
348 | Budget exceeded (explainability) | Skip explainability | Stable | Trust‑safe | Safe | Off | OK
349 | Overlay timing slow | Telemetry warn | No UI change | Trust‑safe | Safe | N/A | OK
350 | Telemetry event | Logged without PII | Transparent | Safe | Safe | N/A | OK
351 | Memory disabled flag | No memory writes | Support only | Trust‑safe | Safe | Minimal | OK
352 | Dialog disabled flag | Dialog disabled | No crash | Trust‑safe | Safe | N/A | OK
353 | Voice disabled flag | Voice suppressed | Silent | Trust‑safe | Safe | N/A | OK
354 | Decision support disabled | No decision card | Neutral | Trust‑safe | Safe | N/A | OK
355 | Circuit breaker open | Null response | Stable | Trust‑safe | Safe | N/A | OK
356 | Coach error | Logged + fallback | No crash | Trust‑safe | Safe | Minimal | OK
357 | User ignores coach | Cooldown applied | Respectful | Trust‑safe | Safe | N/A | OK
358 | User requests coach | Response logged | Supportive | Trust‑safe | Safe | Explainable | OK
359 | Memory miss | Telemetry miss | No UI change | Trust‑safe | Safe | Minimal | OK
360 | Explainability disabled | UI still works | Stable | Trust‑safe | Safe | Off | OK

# Scaling Invariants
- All reads/writes scoped by `auth.uid()`.
- Indexes for `(user_id, date)` and `(user_id, created_at desc)` on high-traffic tables.
- No `SELECT *` on heavy tables without filters.
- Dedupe via `input_hash` and `idempotency_key`.
- Materialized aggregates allowed after 50k users.
