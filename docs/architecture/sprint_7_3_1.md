# Sprint 7.3.1 — UX Runtime & State (Architecture)

## Goal
Согласовать runtime‑слой UX: состояния, переходы, DTO, offline‑fallback и paywall‑гейты.

## Scope
- State machine: plan delivery → day execution → feedback → adapt.
- DTO для Today / My Program / Progress / Why this plan.
- Offline read‑only режим с кешем.
- Entitlement gating для Explainability + Adaptation.

## UX States
- `loading`, `ready`, `offline_readonly`, `blocked`, `paused`
- `today_completed`, `today_skipped`, `adaptation_pending`

## Contracts
- Program overview: версия + статус + план на сегодня.
- Explainability summary: короткий reason_code + ссылка “почему”.
- Progress cards: adherence + streak + trend.

## E2E (111–120)
Фокус Sprint 7.3.1: основная доставка + offline + paywall.

## Definition of Done
- DTO контрактированы.
- State machine задокументирован.
- Offline‑readOnly и paywall‑gating описаны.
