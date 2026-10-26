# Серверные Premium paths: paywall и оставшиеся program gates

Следующий ограниченный шаг после клиентского исправления #205 (`55915bc6643fab52a2df90236a61a940104ed2b6`). Публичные исходники и синтетическая тестовая база; никаких private hosted definitions/ACL snapshots/пользовательских строк в этом документе нет. Этот пакет не изменяет Production/Staging и не является разрешением на выпуск.

## Исправляемый серверный путь

В `phase7_3_2_monetization.sql` старый `get_paywall_state` мог возвращать `locked=false` по сохранённому флагу, когда verified Premium отсутствовал или уже отозван. Клиентский #205 этого JSON-ответа ещё не менял. Новый review-only `scripts/security/server-premium/paywall-review.sql` отдельно закрывает это расхождение:

- signed own-account reader из #196 сохраняется; чужой UUID, отсутствующая identity/подписанная роль отвергаются;
- adaptation/explainability/spatial требуют verified Premium и boolean `true` именно can_adapt/can_explain/can_spatial;
- старый tier, admin, voice или строка `"true"` не заменяют нужное разрешение;
- неизвестный/null feature возвращает locked с unsupported_feature, без разрешающего default;
- отзыв проверяется живым authority reader при следующем запросе с тем же JWT;
- старые известные DTO keys/signature/default p_user_id сохраняются: locked/required_tier/reason либо locked=false/tier. Tier остаётся совместимым legacy display value, не доказательством оплаты;
- функция становится **SECURITY INVOKER**, с пустым search_path и квалифицированными вызовами. Она не читает приватный ledger напрямую и не добавляет privileged endpoint. EXECUTE остаётся только authenticated.

Preflight требует PG17 nonsuperuser postgres/session postgres, точные публично вычисленные source MD5/return types/ownership/security/config старого paywall, guarded get_entitlements и трёх существующих trusted readers, а также закрытые reader/private ledger/issuer API boundaries. Для исходного paywall допускается только NULL config либо точный public, pg_temp из tracked 20260311_security_advisor_hardening.sql; новое тело всё равно получает пустой pinned path. Неизвестные тела/config/гранты останавливают пакет. Ledger должен принадлежать postgres с RLS/FORCE RLS, API роли не получают приватный schema/table/issuer доступ. Это не полноценная повторная верификация всех constraints/triggers/issuer implementations; prerequisite — проверенная #201 authority и свежая общая сверка release состояния.

В файле всегда ROLLBACK. Только фиксированная одноразовая local fixture заменяет его на COMMIT. Это отдельный follow-up, **не скрытый девятый элемент** `accumulated/inputs.mjs`: восемь pinned SQL, SHA и prepared restored runner #202 не меняются. Будущий финальный release должен включить отдельную версию и повторить полную совместную приёмку. Старый anonymous verifier с контрактом SECURITY DEFINER нельзя повторять после превращения этого reader в INVOKER.

## Прямые program reads/writes — ещё OPEN

Полностью воспроизводятся публичные `phase7_2_programs.sql`, `phase7_2_2_adaptation.sql`, `phase7_2_3_delivery.sql` с минимальным synthetic user_goals dependency. Тест намеренно даёт legacy table DML grants, не выдавая их за снимок hosted прав. Существующие owner policies проверяют владение; Premium в них не проверяется. Шесть delivery RPC — SECURITY INVOKER и опираются на табличные права/RLS.

На source fixture собственник без Premium всё ещё может получить полное объяснение через `get_program_explainability`, `get_program_day_details` и прямой SELECT program_explainability; чужой аккаунт в проверенном сценарии не получает строк. Это обходит клиентское сокращение результата до decisionRef: сервер уже вернул full guard_notes/knowledge_refs. И после исправленного locked paywall собственник с DML может напрямую обновить свою program_version и записать program_adaptations. **Paywall не является проверкой полномочий этих операций.** Последний native/embedded case явно OPEN и доказывает, что эта проблема данным пакетом не исправлена.

Это source reproduction с вымышленными данными, не выполненная атака к Production и не доказательство полного hosted parity. Глобального запрета прямых program operations здесь нет: первоначальная Free generation пишет в те же parent/phase/block/day/version/explainability объекты, адаптация также меняет sessions и parent version, а Free delivery использует decisionRef/summary. Простая проверка только adaptation log оставляет обход через прямой UPDATE; общий запрет всех таблиц без замены нарушает Free/дневник/исполнение. Не добавлять SECURITY DEFINER ради обхода permission errors и не выдавать blanket GRANT ради совместимости.

Следующий серверный пакет должен отдельно определить и проверить:

1. Безопасный Free summary/decisionRef против полного explainability во всех прямых/вложенных read paths, включая get_program_days и прямую таблицу. Не полагаться на post-fetch redaction в JS. Проверить также пересечения program UUID/type и RLS-chain semantics.
2. Разделение обычного исполнения/Free generation от изменения защищённого plan/adaptation состояния; caller ownership, verified capability и exact feature flag на атомарной границе. Простая client-check и paywall не заменяют её.
3. Trusted admission/recovery/идемпотентность и сохранность истории, прежде чем убирать прежние права. Данные не переписывать и не считать PLAN фактом еды. Новую генерацию/Edge этим review не активировать.
4. Pose/spatial persistence и внешние/dynamic callers; локальная обработка камеры и запись наблюдений не автоматически равны платной операции. Нужна реальная классификация защищаемого действия, не запрет по имени таблицы.

## Проверки и границы

Десять embedded PG17 cases: legacy unlocked/empty ledger; полный review ROLLBACK; body/path/PUBLIC grant drift; committed invoker/own-account/anon/service checks; owner Premium grant/revoke с теми же claims и без изменения профиля/tier; strict feature flags/admin/voice; unknown feature/identity/metadata; точный tracked hardening search_path из 20260311_security_advisor_hardening.sql; безопасный отказ повторного применения; OPEN direct program read/write reproduction. Native PG17 job повторяет те же случаи.

Combined local Supabase API job сначала устанавливает исходные восемь кандидатов; затем отдельно проверяет legacy unlocked, применяет paywall follow-up и требует locked. При synthetic owner Premium grant проверяет unlocked для трёх features, при revoke с тем же JWT — locked. Проверяются чужой UUID и anon/service denial; предыдущие actual EntitlementService/Login/Profile/AuthProvider/photo/catalog/history сценарии остаются. Fresh SQL connection проверяет exact новый body/owner/security/config и старые общие postconditions. Секреты/OTP не публикуются, hosted проекты не доступны этому фиксированному unlinked harness.

CI результаты нужно подтвердить на exact commit. Full 112-table restored/private application acceptance, свежий recovery, provenance/retention/account deletion и exact hosted release approval остаются отдельными gates. Проверка настоящих квитанций — #198 после meal-plan generation. Ни успешный paywall тест, ни OPEN diagnostic не закрывают весь security этап и не означают готовность к фейерверку.
