# Phase 7.4 — Implementation Backlog

Принципы: Calm Power Coach, Safety-first, Explainability-first, Premium = усиление.

---

## Sprint 7.4.1 — Manual Flow Hardening
### Goal / Measurements hardening
- UI: state machine, error/recovery, empty, retry
- Service: SoT sync + offline fallback
- DB: RLS checks (user_id), minimal schema guards
- Trust/Safety: anti-shame copy, safe recovery
- E2E: goal → measurements → progress update

### Food Diary final polish
- UI: units display/base, optimistic UX, retry
- Service: idempotency + local cache sync
- DB: unique key & RLS
- Trust/Safety: no data loss on offline
- E2E: add/update/delete + offline sync

### Training Diary final polish
- UI: units + display/base, draft save
- Service: idempotency, cache, rollback
- DB: unique key & RLS
- Trust/Safety: no white screens
- E2E: add/update/delete + trends

---

## Sprint 7.4.2 — Progress & Habits
### Progress Screen v2
- UI: timeline, insights, explainability drawer
- Service: progressAggregatorService snapshot + trends
- DB: snapshot cache, trends
- Trust/Safety: partial data tolerance
- E2E: goal/food/training/measurement impact

### Habits Screen v1
- UI: habits list, streaks, recovery
- Service: habitsService + trust overlay
- DB: habits + habit_logs
- Trust/Safety: no shame, soft recovery
- E2E: create, slip, recover, explainability

---

## Sprint 7.4.3 — Programs Runtime
### Today (Follow Plan)
- UI: day view, complete/skip, feedback
- Service: programUxRuntimeService + explain
- DB: program_sessions, feedback
- Trust/Safety: safety guards, no pressure
- E2E: follow plan → today → adapt

### My Program (Lifecycle)
- UI: phases, versions, why-changes
- Service: programUxRuntimeService
- DB: program_versions, blocks
- Trust/Safety: transparent changes
- E2E: preview → follow → replan

---

## Sprint 7.4.4 — Profile / Subscription / Legal
### Profile
- UI: security, data export, delete
- Service: profileService + entitlement
- DB: user_profiles
- Trust/Safety: privacy + safety copy
- E2E: update profile → reflect

### Paywall / Subscription
- UI: value-first paywall
- Service: entitlementService
- DB: subscription_status, payments
- Trust/Safety: no coercion, clear value
- E2E: subscribe → unlock → restore

### Legal flows
- UI: legal docs + consent
- Service: legalService (stub)
- DB: legal_consents
- Trust/Safety: compliance + clarity
- E2E: consent → gated features

---

## Sprint 7.4.5 — Coach Layer MVP
- UI: text coach in Today/Progress
- Service: coachService (text)
- DB: coach_messages
- Trust/Safety: safety filters
- E2E: relapse → support message

