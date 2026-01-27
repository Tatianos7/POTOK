# Sprint 7.3.2 — Monetization & Subscription Layer (Architecture)

## Goal
Коммерческий контур вокруг программ: подписки, entitlement‑gating, paywall, upgrade/restore и store hooks.

## Subscription Model
- **Free**: просмотр плана + пост‑анализ.
- **Pro**: ежедневные программы, адаптация, explainability, voice, 3D.
- **Vision Pro**: spatial coaching, realtime overlay.

## Entitlement Contracts
- `EntitlementTier`: free | pro | vision_pro | coach
- `EntitlementFlags`:
  - `can_view_plan`
  - `can_adapt`
  - `can_explain`
  - `can_voice`
  - `can_spatial`

## Paywall & Upgrade Flow
**Triggers**
- After plan generation
- On adaptation request
- On explainability request
- On voice/spatial access

**UX Contracts**
- `PaywallState` (context, blocked_feature, tier_required)
- `UpgradeAction` (sku, provider, source_context)
- `RestorePurchase` (provider, receipt_token)

## Access Control Integration
- `program_generation` guarded by entitlement flags
- `program_adaptation` guarded by `can_adapt`
- `program_delivery` gated for explainability depth
- `program_explainability` gated for full detail

## Billing & Store Hooks (Contracts only)
- Apple App Store (SKU, receipt validation)
- Google Play (SKU, purchase token)
- Vision Pro entitlement mapping

## E2E Scenarios (121–140)
См. `docs/architecture/e2e_matrix_v2.md`.

## Definition of Done
- Entitlement contracts зафиксированы.
- Paywall/upgrade/restore UX контракты готовы.
- Gating интегрирован в ключевые program‑слои.
- E2E 121–140 описаны.
