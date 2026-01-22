# Entitlement Model (Phase 5)

## Принцип
Entitlement — единственный источник прав доступа к Pro‑функциям. План подписки → набор entitlements → доступ к функционалу.

---

## Feature Keys (пример)
- `ai_coaching_depth`
- `trajectory_simulation`
- `habit_relapse_prediction`
- `pose_realtime`
- `pose_post_analysis`
- `advanced_reports`
- `multi_channel_coach`

---

## Маппинг планов
- **Free**: `pose_post_analysis`, базовый AI, базовые отчёты
- **Pro**: `ai_coaching_depth`, `trajectory_simulation`, `advanced_reports`
- **Coach**: всё Pro + `habit_relapse_prediction`
- **Vision Pro**: всё Pro + `pose_realtime`

---

## Правила доступа
- Проверять entitlements перед вызовом сервисов
- Для Free доступна деградированная версия функций
- Любая AI‑генерация обязана логировать источник entitlement

---

## Guardrails
- Ограничение частоты апсейлов
- Снижение интенсивности при низком trust_score
- Политика мягкого downgrade
