# Phase 5 — Monetization & Pro Intelligence Layer

## Цель
Сделать монетизацию частью доверительного и этичного продукта: прозрачные планы, безопасные апсейлы, gating функций без давления, с уважением к психологическому состоянию пользователя.

---

## 5.1 Subscription & Entitlement Core

### Планы
- **Free** — базовые дневники, отчёты, post‑analysis по технике (задержка)
- **Pro** — расширенный AI‑коучинг, продвинутые отчёты, умные триггеры
- **Coach** — продвинутая аналитика, планы, поддержка профессионального уровня
- **Vision Pro** — realtime‑Pose, голосовой коуч, расширенная биомеханика

### Таблицы
- `subscriptions`
  - `id`, `user_id`, `plan`, `status`, `current_period_start`, `current_period_end`, `cancel_at`, `created_at`, `updated_at`
- `entitlements`
  - `id`, `user_id`, `feature_key`, `enabled`, `source` (plan/manual), `updated_at`
- `feature_flags`
  - `id`, `feature_key`, `description`, `default_enabled`, `updated_at`
- `billing_events`
  - `id`, `user_id`, `event_type`, `provider`, `payload`, `idempotency_key`, `created_at`

### RLS
- `subscriptions`, `entitlements`, `billing_events`: `auth.uid() = user_id`
- `feature_flags`: read‑only public, без user_id

### Guardrails
- Никаких тёмных паттернов
- Прозрачная цена + функционал
- Лёгкий отказ и понижение плана

---

## 5.2 Pro‑Only AI Intelligence

### Разблокируется по Entitlement
- Глубина AI‑коучинга
- Долгосрочные траектории
- Предсказание рецидивов привычек
- Realtime Pose Coaching (Phase 6)

### AI Gating
- Проверка entitlements перед генерацией
- Учитывать trust_score при доступе к интенсивному коучингу
- Мягкий downgrade функционала, а не жёсткая блокировка UX

---

## 5.3 Economic Safety & Ethics

### Политика давления
- Cooldown на апсейл‑сообщения
- Запрет на upsell в периоды уязвимости
- Запрет на «стыдящие» формулировки

### Защита психики
- Использовать `user_state` + `ai_trust_scores` для снижения интенсивности
- Если `confidence` низкий → только мягкие рекомендации

---

## E2E Scenarios (Phase 5)
- Scenario 19 — Free → Pro upgrade (idempotent, webhook safe)
- Scenario 20 — Feature unlock by entitlement
- Scenario 21 — AI depth increases after upgrade
- Scenario 22 — Guarded upsell (no spam, no pressure)
- Scenario 23 — Trust‑adaptive pricing nudges
- Scenario 24 — Vision Pro tier unlocks Pose realtime

---

## Монетизация без токсичности
- Никаких сравнений с другими пользователями
- Никакой «вины» за бесплатный план
- Мотивация через ценность, а не давление
