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
права/время получения таких блокировок ordinary managed actor ещё не испытаны.

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
