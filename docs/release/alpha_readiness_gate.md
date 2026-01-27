# Alpha Readiness Gate — Phase 7.4

## UX readiness
- Полный Manual Mode путь без белых экранов
- Все состояния: empty/loading/active/error/recovery/success
- Calm Power Coach tone во всех ключевых сообщениях

## Data consistency
- SoT определён на каждом экране
- Idempotency для дневников
- Согласованность units (base/display)

## Trust & Safety
- Anti-shame копирайтинг
- Без forced logout при ошибках
- Recovery flow на каждом экране

## Explainability coverage
- Explainability bundle доступен для Today/Progress/Program/Paywall
- UI рендерит причины изменений и ограничений

## Offline resilience
- Local cache для Goal/Measurements/Diaries/Progress
- Offline → retry → revalidate path работает

## Monetization gating
- Premium gates не ломают Manual Mode
- Paywall объясняет ценность, не давит

## Legal/Privacy compliance
- Политики и согласия доступны
- Consent сохраняется и проверяется
