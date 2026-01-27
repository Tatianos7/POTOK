# Phase 7.3 — Product Experience & Monetization (Architecture)

## Goal
Стабильный пользовательский опыт вокруг программ: путь пользователя, UX‑контракты, монетизация, delivery‑форматы и коммерческая готовность.

## User Journey Layer
1. Onboarding → Goal
2. Plan Generation → Program Delivery
3. Daily Execution → Feedback
4. Adaptation → Re‑plan
5. Progress → Retention / Monetization

## Screen Model
- **Today**: план дня, действия (start/complete/skip), explainability.
- **My Program**: текущая версия, timeline, статус.
- **Progress**: выполнение, adherence, тренды.
- **Why this plan**: explainability + knowledge refs.
- **Entitlement & Pricing**: Free/Pro/Vision Pro предложения.
- **Account & Legal**: профиль, оплата, уведомления, настройки, поддержка, юридические экраны.

## Entitlement & Pricing
- **Free**: просмотр, статический план, базовые карточки.
- **Pro**: адаптация, explainability, история версий, voice, 3D.
- **Vision Pro**: real‑time coaching + spatial feedback.

## Paywall & Upgrade
- Триггеры paywall: генерация плана, адаптация, explainability, voice/spatial.
- Контракты: `PaywallState`, `UpgradeAction`, `RestorePurchase`.

## Account / Legal Layer
- Профиль: данные, безопасность, подписка, история оплат, документы.
- Уведомления: системные/поддержка/новости, статусы.
- Настройки: разрешения, каналы уведомлений, локализация, privacy toggles.
- Подписка/Оплата: тариф, автопродление, карты, чеки, промокоды.
- Юридические экраны (РФ): политика, оферта, согласия, дисклеймеры.

## Delivery Formats
- In‑app cards (основной формат).
- PDF‑экспорт (вторичный).
- Vision Pro spatial HUD (hook‑архитектура).

## Explainability UX Contracts
- why_today
- why_changed
- why_paused
- why_lowered_intensity

## E2E Coverage (111–130)
Сценарии 111–130 закреплены в `e2e_matrix_v2.md`.

## Definition of Done
- UX‑контуры и монетизация описаны.
- Delivery форматы фиксированы.
- E2E 111–130 добавлены.
