# Локальная репетиция выравнивания прав — 28 октября 2026

## Почему потребовался этот шаг

Владелец подтвердил 213 effective table privilege differences — все extra_on_restored, только anon/authenticated; отсутствующих прав и различий service_role в проверенном scope не было. В трёх проверенных таблицах владелец/выдавший права postgres, прямые anon/authenticated ACL, обе клиентские роли nonsuper/nobypass. Это совместимо с описанным Supabase расширением прав при restore из-за target default grants; происхождение всех 213 нельзя выводить только из трёх примеров. Предыдущая более разрешающая локальная среда не доказывает работоспособность с production grants. Данные/Storage результаты сохраняются, но этот permission-parity gate остаётся открытым. В рабочий POTOK эти лишние права не выдавать.

## Offline инструмент

`rights-rehearsal.mjs` не имеет network, database connection, Docker/subprocess, apply или commit capability.

- `--prepare-private BACKUP_DIR` проверяет три исходных SHA и фиксированные имена, создаёт новую 0700 папку rights-parity-* и 0600 capture.sql. Ничего не исполняет и не меняет дампы.
- capture.sql — BEGIN REPEATABLE READ READ ONLY/ROLLBACK с bounded timeouts. Возвращает только catalog metadata: actor/context/role flags, public table owner/RLS scope, effective matrix трёх API ролей × восьми PG17 table privileges, direct postgres grant provenance и ACL fingerprint. Никаких пользовательских записей/credentials/role passwords.
- Одинаковый capture независимо выполняется через фиксированный исходный restored Docker container и CLI Management API точного POTOK project-ref. Raw JSON остаются на компьютере. Helper не удостоверяет endpoint по неподписанному JSON: independently trusted capture paths обязательны.
- `--plan-local-rollback EVIDENCE_DIR LOCAL_JSON TARGET_JSON` проверяет свежесть до 15 минут/минуты будущего skew, разные snapshots/files, actor postgres nonsuper, origin, PG17, read-only/repeatable-read, клиентские nonsuper/nobypass роли, отсутствие трёх candidate namespaces и ровно 81 reviewed public ordinary table, owner postgres/RLS true. Все 1944 table/role/privilege tuples обязательны; дубль/пропуск/unknown privilege останавливает.
- Локальный client TRUNCATE должен уже быть false. Остальные расхождения — только точные 213 extra anon/authenticated grants, каждое напрямую от postgres. Missing rights, service drift или inherited-only provenance требуют отдельного разбора. Сверяется не только count: exact tuples обязаны совпасть с последним приватным table-rights-details.*/differences.json. При любом расхождении плана нет.
- Проверяются неизменность исходных дампов и байтов capture.sql. Новый SQL-план записывается отдельно 0700/0600; старые результаты не перезаписываются.

## Что делает сгенерированный local-only.sql

Единственный предназначенный путь исполнения — psql ON_ERROR_STOP в `supabase_db_POTOK_BACKUP_2026-10-24`. Не использовать candidate с 12 committed исправлениями/A-B аккаунтами, Management API, SQL Editor или hosted database. Сначала сохранить/проверить private plan. Generic scripts не могут доказать physical endpoint; фиксированный Docker caller обязателен.

План создаёт только session-local temporary snapshot ACL, затем BEGIN; до первого REVOKE проверяет actor/version/role flags, возраст обоих capture, отсутствие candidate namespaces, точный текущий ACL fingerprint и исходную effective matrix. Далее выполняет только 213 конкретных REVOKE, без GRANT/CASCADE/COMMIT/DML/смены ролей/defaults. Проверяет всю target effective matrix с сохранением false клиентского TRUNCATE; service TRUNCATE/MAINTAIN и остальные privileges не исключаются. Потом ROLLBACK и отдельная проверка исходных ACL fingerprint/effective matrix. TEMP snapshot удаляется.

При ошибке ON_ERROR_STOP закрывает psql connection, незавершённая транзакция откатывается; успешный marker после ROLLBACK обязателен. Старый snapshot или изменённая permission baseline требуют свежего чтения/разбора, не обхода проверки. SQL не меняет пользовательские данные, auth-флаги или генератор. Локальные broad grants остаются прежними после репетиции: это проверка возможности сузить права, **не** committed repair, не приёмка приложения и не hosted release approval.

## Верификация и оставшиеся условия

Unit contracts проверяют точные 213 REVOKE/отсутствие GRANT/COMMIT, неверные роли/actor/схему/provenance, missing/service drift, stale/reused captures, exact private difference set, source hash protection и private output permissions. Native CI создаёт новую fixed disposable loopback PG17 fixture DB с 81 синтетической таблицей; получает настоящие capture, проверяет временную parity, успешный rollback, rollback после позднего сбоя/разрыва соединения и stop до REVOKE при drift. Driver отправляет session-local setup до BEGIN отдельным запросом, воспроизводя transaction boundary построчного psql: отправка всего файла одним SQL API пакетом может включить TEMP setup в откат. Поэтому SQL Editor/Management API не являются путём исполнения этого плана. Синтетический результат не заменяет Mac запуск.

На момент подготовки никакой local REVOKE не выполнялся, рабочий POTOK/Staging не менялись. Для следующего шага нужен только fresh metadata capture на доступном компьютере. После доказанной локальной rollback parity остаётся отдельно подготовить среду фактической приёмки с корректными правами и оценить затронутые сценарии; не считать старые более разрешающие тесты достаточными и не повторять весь прежний этап автоматически. Managed/config/recovery и конкретный target-bound approved release остаются условиями; #222 guard неизменен. Последовательность владельца прежняя: security → фейерверк → планы питания → настоящие квитанции #198.
