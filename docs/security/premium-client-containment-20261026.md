# Premium client containment — 26 октября 2026

Узкое исправление после аудита #204 (`ffcf001489324927798851dbe2611e0ad6ec4cf3`). Не новая SQL-миграция, не реализация покупок и не закрытие всего security этапа.

## Новый клиентский контракт

`EntitlementService` больше не считает старые tier/flags достаточным доказательством платного доступа. `canAdaptProgram`, `canExplain`, `canRealtimePose` требуют одновременно:

- флаг **именно этой функции** равен boolean `true`;
- существующий `has_verified_entitlement_v1('premium')` вернул boolean `true` без RPC error;
- текущий пользователь совпадает с ожидаемым до и после асинхронных чтений.

Старые flags могут только дополнительно ограничить функцию; они не выдают Premium. Отдельного authority/store, membership, grant или backfill не добавлено. Verified admin не заменяет Premium. Пространственный режим использует `can_spatial`; voice и pro/vision_pro tier больше не подменяют его. `plan` в pose DTO остаётся совместимой меткой старого тарифа, а не разрешением; известны только free/pro/vision_pro, неизвестные значения маркируются free. Возвращаемые pose flags нормализованы к строгим boolean.

Free generation/view-plan сохраняет существующий default при отсутствии/null `can_view_plan`. Явный false закрывает его, строки/числа и malformed flags container не превращаются в true. Null/primitive/array entitlement response отклоняется как некорректный. Изменение этого Free-контракта или активация новой генерации сюда не входят.

Отсутствующий predicate, false/null/string result или RPC error не дают платного разрешения. Исключения транспорта/потеря Auth/смена аккаунта отклоняют Promise; обхода на legacy grant нет. После `get_entitlements` и raw `get_paywall_state` проверяется текущий account, включая вызовы без явно переданного userId. Это проверка идентичности на границах ответа, не общий session epoch/cancellation протокол и не защита от всех A→B→A гонок в иных сервисах.

## Совместимость и явные ограничения

Raw `getEntitlements` и `getPaywallState` сохраняют JSON DTO/legacy содержимое ради совместимости и explainability. Они **не являются доказательством paid authority**; raw paywall может ещё говорить unlocked при отзыве verified Premium. Защищаемые клиентские действия должны использовать capability helpers, а сервер — собственную проверку. Этот шаг не переписывает DTO в подтверждённую оплату и не выдаёт tier из ledger.

Выданный verified Premium без соответствующих legacy feature flags остаётся ограничен. Это консервативная промежуточная совместимость, не готовая синхронизация тарифов. Продуктовую матрицу узких возможностей/preview и серверную модель их выдачи нужно завершить до релиза. Исторические rows нельзя ни считать оплаченными, ни массово удалять по этому изменению.

Никакая клиентская проверка не заменяет server-side authorization защищённых записей/SECURITY DEFINER/RLS цепочек. Они остаются отдельным следующим gate. Profile normalize/verified AuthContext не меняются; PLAN != FACT, Graph v1 и inactive generator/Edge сохраняются. Проверка квитанций остаётся #198 после генерации планов.

## Проверки

12 isolated actual-service regressions: запрет старого тарифа/voice/legacy flags без verified права; строгие boolean; положительные точные флаги с verified правом; malformed/error/missing predicate; некорректные DTO/containers; поздние ответы entitlement/predicate/paywall после смены аккаунта; mismatch/RPC rejection; Free preservation. Исходники транспилируются locked TypeScript, default Supabase отключён, транспорт синтетический, сетевых подключений нет. Ранее диагностический тест #204 теперь проверяет безопасный результат; небезопасное поведение не сохраняется ради зелёного CI. Старые четыре account-scope compatibility tests также включены в CI.

Расширен существующий **фиксированный unlinked local Supabase** API job #203. В нём транспилируется настоящий EntitlementService и использует реальный Auth/PostgREST. Legacy pro со всеми нужными flags при пустом ledger отказывает. Owner-controlled synthetic grant только premium (не admin) разрешает три exact feature helper; revoke с тем же JWT сразу отказывает, хотя legacy tier остаётся pro и profile has_premium=false. Два новых append-only события учитываются в независимых SQL final checks (API 4, после браузера 6). Предыдущие profile/photo/catalog/history/actual Login/Profile/AuthProvider сценарии продолжают выполняться. Нет payment provider, настоящих покупателей, новых hosted permissions или реальной выдачи прав.

CI необходимо подтвердить на exact commit до заявления об успехе. Восемь SQL inputs/SHA/порядок и prepared restored runner не изменены. Этот тест не заменяет полную приватную 112-table restored проверку, persistent acceptance на ней, fresh hosted drift/recovery и одобрение exact Production batch.
