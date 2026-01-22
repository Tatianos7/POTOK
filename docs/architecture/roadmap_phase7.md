# Roadmap — Phase 7 Knowledge Layer & Programs

## Status
Phase 7.1 Knowledge Base v1 — Production Ready

## 7.1.1 Core Schema & Import (2 weeks)
- Canonical entities (foods/exercises)
- Initial dataset import
- RLS and versioning baseline

## 7.1.2 Normalization & Dedupe (2 weeks)
- Normalizers (name/brand/units)
- Alias tables
- Dedupe rules and collisions

## 7.1.3 AI Enrichment (2–3 weeks)
- Nutrient completion
- Exercise risk tags
- Pose template enrichment

## 7.1.4 UX Search & Voice (2 weeks)
- Multilingual search
- Barcode + voice flows
- Explainability links in UI

## 7.1.5 Knowledge Evolution Layer (2–3 weeks)
- Нутриентное версионирование и diff‑история
- Авто‑обновление канона + confidence decay
- Пользовательские правки + HITL арбитраж
- Подготовка к Phase 7.2 (AI‑программы поверх базы)

## Phase 7.2 — Intelligent Programs Layer

### 7.2.1 Program Generation Core (2 weeks)
- Генерация nutrition/training программ из KB + user_state
- Версионирование программ и explainability
- Guard + trust + confidence‑aware decisions

### 7.2.2 Adaptation & Safety Engine (2–3 weeks)
- Адаптация по отклонениям и усталости
- Безопасный re‑plan, хранение истории
- Медицинские/травматологические блокировки
- Explainability v4 для причин изменений
- E2E 83–95

### 7.2.3 Program Delivery & UX Layer (2 weeks)
- Delivery API для UI (дни/фазы/блоки)
- Версии для пользователя + diff
- Explainability UI + Adaptation Timeline
- Entitlement gating (Free/Pro/Vision Pro)
- E2E 96–110

## Phase 7.3 — Product Experience & Monetization

### 7.3.1 UX Runtime & State (2 weeks)
- UX state machine + DTO contracts
- Offline read‑only + paywall gating
- E2E 111–120

### 7.3.2 Monetization & Pricing UX (2 weeks)
- Upgrade flow + pricing surface
- Explainability paywall rules
- E2E 121–130

### 7.3.3 Product UX & Daily Experience (3–4 weeks)
- Full daily journey: Goal → Program → Today → Loop
- Trust/Safety UX rules + explainability
- Vision Pro & voice hooks readiness
- Sprints 7.3.3.1–7.3.3.4
