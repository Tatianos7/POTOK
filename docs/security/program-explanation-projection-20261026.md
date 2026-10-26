# Серверная выдача объяснений программ — 26 октября 2026

Отдельный review-only read пакет после #206 (`973eb9c996ca26f69145578896ee2fe5f1d2195e`). Исходники публичные, fixture данные вымышленные. Production/Staging, платёжный провайдер и генератор не изменяются. Этот пакет не входит автоматически в старую восьмёрку/runner #202.

## Контракт ответа

| Путь | Без verified Premium + exact can_explain | С подтверждённым доступом |
| --- | --- | --- |
| Собственный get_program_explainability | Структурные поля/decision_ref; knowledge_refs/confidence=null; guard_notes содержит только строковый reason_code | Полное объяснение своей программы |
| Собственный get_program_day_details | Обычный день/сеанс сохраняются; вложенное explainability редактируется на сервере по тому же правилу | Полное вложенное объяснение |
| Собственный get_program_days | Сохраняются планы дней/статусы и краткие decision_ref/reason_code | Тот же совместимый summary |
| Прямой SELECT program_explainability | Только id/program_id/program_type/version/decision_ref/created_at с отдельным owner scope | Те же минимальные колонки; full данные только через защищённый RPC |
| Чужой, отсутствующий или неоднозначный UUID | Нет объяснений/дней; day-details содержит null day/session/explainability | То же, Premium не отменяет владение |

Три конкретных поля не должны уходить целиком в Free клиент, чтобы JS затем скрывал их. Возврат null сохраняет поля composite DTO; текстовый reason_code — согласованный существующий Free summary из delivery source/types. Объект/массив вместо reason_code не сериализуется в текст с вложенными подробностями. Metadata старого тарифа/admin не даёт доступа. Отзыв проверяется текущим reader/paywall при следующем запросе с тем же JWT.

## Устройство границы

Публичные три RPC остаются **SECURITY INVOKER**, получают pinned пустой search_path и используют одну серверную projection. Полные SELECT права с таблицы и protected-column SELECT grants удаляются у PUBLIC/anon/authenticated. Минимальные колонковые grants выдаются явно; restrictive SELECT policy независимо проверяет owner/type scope. Effective inherited protected-column доступ не исправляется изменением memberships: если его нельзя убрать локальным REVOKE, кандидат откатывается.

Создаётся fresh `potok_delivery` с двумя маленькими **приватными SECURITY DEFINER** readers: определение однозначного owner/type scope и выдача отредактированного composite. Это отдельная привилегированная read граница для доступа к колонкам, которые не выдаются роли клиента. Она не добавлена как fallback при permission error. Оба reader явно проверяют signed identity/ownership, используют пустой search_path и квалифицированные объекты; второй использует проверенный #206 paywall. В public нет нового SECURITY DEFINER. Schema CREATE никому из API ролей не выдаётся. authenticated получает USAGE и EXECUTE только нужных helpers для вызова из INVOKER facade/RLS; прямой SQL вызов этих helpers обязан выполнять те же проверки. anon/service_role не получают schema/helper access. Приватный authority namespace/ledger/issuer не раскрывается и не дублируется.

`potok_delivery` нельзя добавлять в Exposed schemas. В фиксированной local Supabase проверяются и отсутствие public RPC такого имени, и отказ Content-Profile с PGRST106. Перед hosted rollout нужно отдельно проверить фактический список exposed schemas. Нельзя сделать эту проверку по одному имени schema в SQL.

Полиморфные записи связываются с единственным parent UUID и точным program_type. Если UUID одновременно есть в nutrition_programs и training_programs, read закрывается для обеих сторон вместо выбора произвольного типа или смешивания данных. В трёх проверяемых RPC day/session CTE также используют scope/type; само редактирование explainability не защитило бы остальные части JSON. Это не исправляет все оставшиеся polymorphic policies/RPC вне указанной тройки.

## Допуск и сохранность

`scripts/security/program-reads/review.sql` заканчивается ROLLBACK. Preflight требует nonsuperuser postgres BYPASSRLS на PG17, fresh namespace, исходные public-source hashes/config/security/owner трёх старых RPC и существующих authority/paywall readers, owner/RLS базовых program таблиц и точные имена/типы девяти explanation колонок. Для трёх legacy program RPC допускаются только исходный NULL config либо точный public, pg_temp из tracked 20260311_security_advisor_hardening.sql; неизвестный path по-прежнему запрещён. У paywall #206 до установки также учтён этот точный tracked вариант, без изменения нового тела/публичного контракта. Confidence сохраняет numeric(4,3). Неизвестный source/shape/доступ останавливает установку; replay не является автоматическим upgrade.

Кандидат не меняет строки, параметры плана или профиль, не выдаёт Premium. Existing authenticated/service table DML capabilities и service column SELECT проверяются на сохранность; неожиданный inherited-only service SELECT loss откатывает пакет. Три user-facing RPC становятся authenticated-only; service/anon RPC read compatibility не обещается и требует проверки внешних callers до release. Полные колонковые ответы напрямую не доступны даже verified пользователю — только через scoped reader.

Первоначальная Free generation вставляет explainability без protected RETURNING: этот конкретный insert и обычный day/session read проверяются. Это не полная приёмка прежней генерации. Арифметический UPDATE защищённой колонки, `.select('*')`/RETURNING и внешние прямые consumers должны быть пересмотрены; возвращать blanket SELECT для их совместимости нельзя.

## Что остаётся открытым

- Прямые изменения program_version, program_adaptations и других plan artifacts ещё возможны при старых DML grants. Это сохраняется явно; закрывать их нужно атомарным серверным контрактом, сохранив обычное исполнение/Free пути. Последний тест подтверждает OPEN mutation boundary, не её исправление.
- program_versions.snapshot, generation input_context, иные unstructured payloads, остальные delivery/pose endpoints и внешние writers/readers требуют отдельной классификации. Нельзя по защите трёх колонок обещать полную paid-content изоляцию во всех данных.
- Client caches и account switching в других program сервисах (в том числе отдельная #186 правка) не исправляются этим SQL. Уже полученные полные данные нельзя отозвать с устройства одним серверным REVOKE; cache/UI recovery требует отдельной приёмки. Общий browser job проверяет прежние Login/Profile сценарии, а не полный Program UI.
- Полная private restored 112-table/schema/API/application приёмка, реальный hosted drift, recovery, issuer/provenance/retention и exact batch approval остаются до выпуска. Генератор/Edge не активируются, PLAN != FACT и Graph v1 сохраняются. Платежи — #198 после генерации планов.

## Проверки

13 embedded PG17 cases: старое full раскрытие; полное восстановление metadata/ACL/данных/namespace после ROLLBACK; source/path/inherited-column drift; COMMIT без data/authority mutations; Free projection и direct-column denial; owner verified grant/full и same-claims revoke/mask; foreign scope даже при добавленной broad permissive policy; UUID/type collision и неправильная polymorphic запись; anon/service/null identity/metadata/admin; malformed flag/reason; сохранность конкретного Free insert плюс OPEN plan mutation; совместимость с точным tracked hardening path; безопасный отказ reapply. Native PG17 job повторяет их.

Real local Auth/PostgREST acceptance отдельно ставит read follow-up после восьми кандидатов и #206 paywall, проверяет все три RPC, direct-column/foreign/role/private-schema denial, настоящий Premium grant/full и revoke/mask с тем же JWT. Fresh SQL проверяет тела/security/owner/config/EXECUTE пяти readers и effective columns/schema grants. Предыдущие фактические EntitlementService/Login/Profile/AuthProvider и photo/catalog/history проверки повторяются. Секреты/OTP/status не публикуются; CI результаты нужно подтвердить на exact commit.

Архитектурные источники: https://supabase.com/docs/guides/database/functions и https://supabase.com/docs/guides/database/postgres/row-level-security — private definer с явным ownership и pinned search_path; public invoker; narrow EXECUTE/schema grants. Это не отменяет необходимость проверки каждой функции и её фактических данных.
