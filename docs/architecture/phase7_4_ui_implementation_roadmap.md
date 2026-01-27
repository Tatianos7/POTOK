# Phase 7.4 — Full UI Implementation Roadmap

## A) UI Implementation Scope
**Экраны и системы**
- Goal & Measurements
- Food Diary (Manual)
- Training Diary
- Today (Follow Plan)
- My Program
- Progress v2 (Life Timeline)
- Habits
- Profile
- Subscription & Paywall
- Coach Layer

## B) Runtime Layers
**State management**
- UI state machine (Manual / Follow Plan / trust / confidence).

**Navigation model**
- Manual Mode: Goal → Measurements → Diaries → Progress → Habits.
- Follow Plan: Preview → Follow → Today → Diaries → Progress.

**Data sync**
- Diaries ↔ Programs ↔ Progress.
- Habits ↔ Progress ↔ Trust.

**Explainability**
- Drawer for Today/Progress/My Program.

**Trust & Safety signals**
- Low trust / fatigue / risk UI states.

**Entitlement gating**
- Paywall entry points for Today/Program/Explainability.

## C) Sprint Breakdown

### Sprint 7.4.1 — Core Manual UX
**Goal:** стабильный manual flow без Premium.
**Screens:** Goal, Measurements, Food Diary, Training Diary (manual).
**Services:** user_goals, measurements, diaries.
**E2E:** 141, 148, 151–156, 166.
**DoD:** Manual flow end‑to‑end работает без плана.

### Sprint 7.4.2 — Follow Plan UX
**Goal:** активация плана и Today runtime.
**Screens:** Today, My Program (preview + follow/cancel).
**Services:** programDeliveryService, programUxRuntimeService.
**E2E:** 143–150, 167, 170.
**DoD:** Follow Plan активирует Today, синхронизация дневников.

### Sprint 7.4.3 — Progress & Habits
**Goal:** life‑timeline + streak layer.
**Screens:** Progress v2, Habits.
**Services:** progress aggregation, habits logs.
**E2E:** 151–165.
**DoD:** Progress агрегирует источники, habits влияют на trust.

### Sprint 7.4.4 — Profile, Paywall, Legal
**Goal:** account + monetization readiness.
**Screens:** Profile, Subscription, Paywall, Legal.
**Services:** entitlementService, billing events.
**E2E:** 171–185.
**DoD:** paywall/restore/cancel/legal flows стабильны.

### Sprint 7.4.5 — Coach Layer
**Goal:** long‑term engagement UX.
**Screens:** Coach layer overlays.
**Services:** trust/adaptation/coach messaging.
**E2E:** 186–210.
**DoD:** relapse/return loops работают, soft support.

## D) Release Path
**Alpha (internal)**
- Manual Mode: Goal / Measurements / Food / Training / Progress.
- Explainability drawer (минимум).
- Offline fallback (core).

**Beta**
- Programs: My Program + Today runtime.
- Adaptation & explainability.

**Public MVP**
- Coach layer MVP (text).
- Monetization + Paywall.
- Trust & Safety hardening.

**Readiness Metrics**
- DAU/WAU retention
- Crash‑free rate
- Conversion to Premium
- Support ticket load
