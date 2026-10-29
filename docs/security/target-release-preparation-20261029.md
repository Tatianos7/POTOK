# Подготовка рабочего выпуска POTOK — 29 октября 2026

## Что уже подтверждено

Локальная приёмка сохранена в `local-acceptance-checkpoint-20261029.md`:
владелец получил PRIVATE_PROGRAM_UI_OK в program-ui-izBBNW на пакете 8706594,
с точным cleanup и сохранностью исходных данных/прав/Storage. Её не повторяем.
Generator/Edge и настоящая проверка платежей остаются выключенными.

Свежие обращения к POTOK dtsdnhbcwpbfrhcazqkb выполнены только чтением:
metadata preflight — 29 октября 08:58:00 по Москве, отдельный inventory — около
09:00–09:03. Пользовательские строки/ключи/серверные файлы не запрашивались.
Проект ACTIVE_HEALTHY, PG17.6; actor postgres, nonsuperuser/BYPASSRLS,
replication role origin. Public metadata SHA-256 совпал с наблюдением 27 октября:
427466d34aa57984cb4449a3532ece63ece1d27b61f6ccdfbea86c5cf4c878af.

Сохраняются 81 public-таблица, клиентский TRUNCATE на 63 и запись четырёх
защищённых полей профиля. Три candidate namespace и execution_reason отсутствуют.
Это baseline-shaped состояние; совпадение метаданных не доказывает совпадение
пользовательских строк или свежесть backup. Сам пакет на рабочей базе не применён.

Полный наблюдённый physical inventory выбранных трёх схем — 116 таблиц:
27 auth / 81 public / 8 storage. Прежние 112 COPY-таблиц — другой scope с четырьмя
явными исключениями managed-таблиц. Новый план блокировок перечисляет все 116;
Новая read-only проверка прав ниже установила, что uniform strong lock для всех
116 недоступен ordinary managed actor. Старый outline остаётся заблокированным
историческим артефактом; не считать его исполняемым выпуском.

## Конкретные подготовленные артефакты

В `scripts/security/release-packet/`:

- `target-observation-20261029.json`: metadata-only наблюдение и advisor summary.
- `target-plan.mjs`: чистый offline builder, один fixed target, exact manifest
  двенадцати SQL/совместимого клиента 996a81c и принятый private package 8706594.
- `target-plan-20261029.json`: порядок, 116 таблиц/владельцев, SHARE ROW EXCLUSIVE,
  lock timeout 3s и statement timeout 120s, actor/version/data/authority contracts,
  оставшиеся prerequisites и консервативные recovery decisions.
- `target-envelope.review.sql`: BEGIN/locks/ROLLBACK и безусловный STOP до locks.
  В нём порядок будущих операций, а не исполняемые metadata/source/final checks
  или twelve-body forward. Удаление STOP не делает его готовым выпуском.
- `row-guard.mjs` и `target-rows.before/after.review.sql`: фрагменты будущей одной
  одобренной транзакции. До изменений запоминают имена старых колонок, counts и
  SHA-256 полного отсортированного мультимножества строк во временной таблице;
  после — сверяют их. Новая nullable execution_reason не меняет проверяемое старое
  содержимое. Same-count tamper/extra rows/missing scope останавливают проверку.
- `target-package-manifest-20261029.json`: SHA-256 четырёх подготовленных артефактов.

Builder не имеет DB/HTTP/Docker/credentials/apply runner. SQL fragments не являются
самостоятельной командой: нужен отдельный approved outer transaction, успешные
locks и metadata/shape/source checks. Хеши строк не печатаются и не публикуются.
Проверка строк не доказывает сохранность sequences, Vault/Realtime/других схем,
Storage binaries, конфигурации или отсутствие побочных эффектов вне этого scope.
Будущий final package обязан явно покрыть их либо обоснованно исключить.

Старый forward.review.sql с REVIEW_ONLY_NO_TARGET_APPROVAL/ROLLBACK, 12 source
pins и source/client manifest неизменны. Новых hosted migration/COMMIT/restore
команд нет. Никакой готовности выпуска из локального pass автоматически нет.

## Порядок оставшейся работы

1. **Backup и recovery перед окном.** Приватно подтвердить свежий полный scope,
   db/roles/Storage binaries, конфигурацию, дату и recovery point; отдельно учесть
   изменения после 24 октября. Проверить возможность восстановления в отдельной
   среде без затирания рабочей базы. Старые подтверждённые тесты не переисполнять
   ради маркера, но свежесть новой рабочей копии не подменять старой приёмкой.
2. **Managed boundary.** Согласовать подходящую репетицию pg_trgm с managed hook,
   extra_search_path/HTTP exposure и доступностью locks под ordinary postgres.
   Сейчас pg_trgm 1.6/public/supabase_admin, 47 members. Резервные defaults другого
   владельца не править через повышение роли. Официальный supported путь и
   ограничения: https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema .
3. **Точный forward/reconciliation и окно клиента.** На этих evidence собрать
   отдельный полный runner/batch, fixed connection identity, свежий metadata scope
   под locks, row guards, точные 12 bodies, final source/rights/empty-authority
   checks, COMMIT и независимый read-only reconciliation после нового соединения.
   Указать client commit/full release tree и обновление старых вкладок; Pages
   публикация — часть одобряемого выпуска. Этот шаг ещё не выполнен артефактами
   envelope. Пока для source preparation Mac не нужен.
4. **Одобрение готового выпуска и рабочая приёмка.** Предъявить владельцу target,
   exact forward hash/client/window/recovery; только после конкретного одобрения
   применять. Подтвердить committed state отдельным соединением, API cache,
   own/foreign profile/photo/catalog/program, PLAN != FACT, права и содержимое.
   Затем согласованный фейерверк, генерация питания, квитанции #198.

## Recovery решения уже закреплены

| Исход | Действие |
| --- | --- |
| Не начинали / preconditions не прошли | Не применять; исправить причину и повторно подготовить точный пакет |
| Подтверждён ROLLBACK | Проверить исходные metadata/content и закрытие транзакции; не повторять автоматически |
| Связь потеряна около COMMIT | Новое read-only соединение, reconciliation полного state/source/content; никакого повторного apply до выяснения |
| COMMIT подтверждён, API/UI не прошли | Сохранить containment и совместимый клиент; точный forward repair под причину |
| Нужен restore | Отдельное решение по recovery target, новым записям и db/auth/storage consistency; сначала отдельная среда |

Старые широкие GRANT, старый unsafe client и entitlement issuance не являются
восстановлением. Автоматического destructive down/restore нет.

## Оставшиеся advisory-категории

Свежий security advisor повторяет пять категорий; package не обещает удалить
каждое предупреждение. Search-path функции требуют отдельного source review;
leaked-password настройка рассматривается с учётом email-OTP/тарифа, без смены
тарифа или включения другого способа входа автоматически.

| Категория | Записей | Официальная справка |
| --- | --- | --- |
| Mutable function search_path | 8 | https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable |
| Extension in public | 1 | https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public |
| Anon definer EXECUTE | 8 | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable |
| Authenticated definer EXECUTE | 8 | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable |
| Leaked password protection | 1 | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection |

## Верификация

13 local source/recovery/target tests прошли; old twelve-source packet --verify и
воспроизводимость новых artifacts --verify прошли. Native CI отдельно проверяет
STOP до locks и данные в disposable PG17: nullable addition, same-count tamper,
row counts/scope, порядок и duplicates, полный ROLLBACK. Положительный native
результат фиксируется в Draft PR после фактического завершения; тесты не выполняют
новые locks/content scans на POTOK и не доказывают managed release/recovery.

## Fresh private backup owner progress

Owner pre-release-backup-2026-10-29.eDWkmR: roles.sql 358 B, schema.sql 243 KiB,
data.sql 7.9 MiB; all three original SHA256 checks passed. New read-only Storage
inventory reports 63 objects (22/3/38), and all three CLI downloads finished.
Последующие owner results подтвердили файлы и свежее локальное SQL восстановление;
точный перечень закрытого и ограничений — fresh-recovery-checkpoint-20261029.md.

fresh-storage-files.mjs --verify-downloaded BACKUP compares the saved inventory
with a fresh independent post-download capture, enforces exact doubled-bucket CLI
layout, safe regular paths, exact file set/sizes and unique object identities,
streams SHA256 and detects size/mtime/ctime changes during hashing. Only after
all checks does it write new storage-manifest.json/storage-sha256.json with wx;
private errors are not printed. Synthetic success/negative cases passed. A SHA
computed from a downloaded file is local integrity evidence, not an independent
provider checksum. Storage id/path/version/size восстановленной базы совпали с
файловой копией; COPY content 112/14888 и 117 FK прошли. Полная конфигурация проекта,
sequence states и внешняя переносимая копия этим не подтверждаются. Ни installer,
ни завершённая application acceptance не повторяются.

## Точный оставшийся lock boundary — 29 октября, 13:49:57 по Москве

Только BEGIN READ ONLY/ROLLBACK: role postgres nonsuperuser, 116 physical tables.
Нужный сильный режим разрешён по MAINTAIN/UPDATE/DELETE/TRUNCATE для 112 таблиц.
Для auth.schema_migrations, storage.migrations, storage.buckets_vectors,
storage.vector_indexes есть SELECT, но ни одного из этих четырёх прав.
MAINTAIN проверен отдельно: false для всей четвёрки. Старый uniform SHARE ROW
EXCLUSIVE outline не выполнился бы; на рабочей базе LOCK не пробовали.

[PostgreSQL 17 LOCK](https://www.postgresql.org/docs/17/sql-lock.html) разрешает
любой режим при MAINTAIN/UPDATE/DELETE/TRUNCATE, но SELECT даёт только ACCESS SHARE.
Не запрашиваем reserved-role membership и не меняем ACL managed таблиц ради locks.

lock-admission.mjs — offline review, привязанный к новому exact inventory/actor
observation. Предлагает 112 SHARE ROW EXCLUSIVE / четыре ACCESS SHARE в общем
детерминированном порядке. Не удаляет ни одну таблицу из inventory или будущих
116 old-column row checks. Изменение любого права/owner/таблицы, включая новую
ограниченную таблицу, останавливает построение; runtime fallback отсутствует.
managed-locks.review.sql безусловно останавливается до locks и делает ROLLBACK.

ACCESS SHARE не блокирует записи managed сервисов. Поэтому предложение не
объявлено release-ready: для четвёрки нужно явное решение о provider-maintenance
окне/границе и свежая проверка на фактическом соединении. Нельзя незаметно заменить
сильный lock слабым и продолжать обещать полную заморозку строк. Native CI отдельно
проверяет именно эту разницу двумя соединениями; это не hosted rehearsal.

Управляемый механизм pg_trgm по-прежнему согласован: public / 47 members,
postgres — effective member supabase_privileged_role, pg_trgm allowlisted,
reserved public TRUNCATE defaults=2. Они не удаляются через повышение роли;
SQL_BOUNDARY_VERIFIED по прежнему check.sql допускает их при отсутствии platform
объектов/extensions в public и unsafe собственных/default grants.

Новый catalog source scan нашёл только `%` внутри RAISE сообщений rls_auto_enable,
а не реальный trgm caller; прежний корректный source preflight именно такие
ложные совпадения исключает. Это не parser/runtime proof для внешних клиентов.
pgrst.db_extra_search_path/db_schemas в SQL setting catalog не раскрыты (NULL/[]).
Следовательно полный актуальный config/HTTP/managed ALTER не объявлены проверенными.
Connected Supabase tools не предоставляют read-PostgREST-config метод.

## Подтверждение двух полей API владельцем — 29 октября

Два снимка Dashboard проекта POTOK / main / PRODUCTION получены и прочитаны.
Это отдельный источник от SQL setting catalog, а не вывод значений из NULL.

| Поле Dashboard | Видимое значение |
| --- | --- |
| Exposed schemas | graphql_public, public; обе отмечены, 2 of 2 |
| Extra search path | public, extensions |
| Automatically expose new tables | включено |
| Max rows | 1000 |

Недостающие два поля теперь подтверждены owner Dashboard evidence. extensions
присутствует в extra search path и не выбрана exposed schema; переключатели не
изменялись. Это согласуется с назначением переноса pg_trgm: extension objects
доступны для разрешения имён, без отдельной публикации schema как Data API.
Не путать search path с правом вызова функций или RLS/GRANT. Включённое automatic
exposure не выключать отдельно в обход согласованного пакета; оно не отменяет
необходимость точных GRANT/REVOKE и RLS и не является гарантией безопасности.

Снимки не являются полным config export, runtime HTTP проверкой после переноса
или фактически выполненным managed ALTER. Project ref не читается в кадре;
привязка к именованному проекту основана на владельческом контексте и видимом
POTOK/main/PRODUCTION. Перед одобренным применением actual connection/target
проверяются отдельно. Повторно запрашивать эти же два снимка без причины не нужно.

Проверки exact runtime/source head 4b9d68b завершены: release/native workflow
40861109899 (job 123404274017) и root workflow 40861109906 — success. Native marker
MANAGED_LOCK_NATIVE_OK подтвердил запрет strong lock при SELECT-only, возможность
concurrent write при ACCESS SHARE, блокировку writer сильным режимом и сохранение
table ACL. Этот раздел — только фиксация owner evidence/CI; исходники и прежние
SQL artifacts не изменены, hosted apply остаётся не выполненным.
