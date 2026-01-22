# Phase 7.3.3 — Product UX & Daily Experience (Architecture)

## Goal
Построить полный пользовательский путь: установка → цель → программа → ежедневное выполнение → прогресс → привычки → мотивация → подписка.

## User Journey Map (Day 0–30)
Day 0: Install → Onboarding → Goal → Program Generation → First Day  
Day 1–7: Daily Loop → Feedback → Adaptation  
Day 8–30: Progress review → Habits reinforcement → Subscription upsell

## Screen Map
- Onboarding
- Goal Setup
- Program Generation
- Today
- My Program
- Food Diary
- Workout / Pose
- Progress
- Habits
- Coach / Insights
- Profile / Subscription

## Navigation Flow
- Bottom tabs: Today / Program / Diary / Progress / Coach
- Profile & Subscription: modal / drawer entry
- Pose: entry from Workout or Today

## Entry Points
Today, Program, Diary, Pose, Progress, Coach, Profile.

## Entitlement Gating
- **Free**: view‑only + post‑analysis.
- **Pro**: adapt + explain + voice + 3D.
- **Vision Pro**: spatial coaching + realtime overlay.

## Trust & Safety UX Rules
- Low trust → reduced guidance frequency.
- Guard danger → pause + safety‑only messaging.
- Medical block → hard stop + explainability.

## Explainability UX
- “Почему сегодня так?” (why_today)
- “Почему план изменился?” (why_changed)
- “Почему пауза/делоуд?” (why_paused)

## Voice / Vision Pro Hooks
- Voice cues gated by entitlement + trust.
- Vision Pro spatial hooks available when `can_spatial=true`.

## Definition of Done
- UX‑контуры и навигация описаны.
- Trust/safety UX правила закреплены.
- Explainability и voice/spatial hooks готовы.
