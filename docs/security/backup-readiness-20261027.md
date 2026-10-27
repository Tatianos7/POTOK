# Проверка актуальности логической копии — подготовка 27 октября 2026

Основа — #223 `72e89c5c2ec944f7921abc9f9355437c45d70e89`. В этом шаге подготовлен локальный инструмент, а не новая резервная копия. Частные файлы владельца на Mac не доступны; их актуальность этим шагом **не подтверждена и не опровергнута**. Уже пройденные восстановление, 112 таблиц/14888 строк, FK и 63 Storage-файла остаются доказательствами того конкретного этапа. Поздняя работа владельца не повторяется и не считается провалом.

## Установлен текущий именованный scope

Только чтением Supabase metadata получен `scripts/security/backup-readiness/inventory-20261027.json`: **14:23:33 по Москве**, 116 физических таблиц auth/public/storage, точные имена/типы/колонки/generated flags. Пользовательских записей, ключей и значений по строкам в этом файле нет.

Для сравнения логических данных используются все требуемые таблицы, кроме четырёх явных исключений:

| Таблица | Причина отдельного учёта |
| --- | --- |
| auth.schema_migrations | История managed Auth migrations; не восстанавливать как данные приложения |
| storage.migrations | История managed Storage migrations; не восстанавливать как данные приложения |
| storage.buckets_vectors | Явное исключение в используемом Supabase backup command |
| storage.vector_indexes | Явное исключение в используемом Supabase backup command |

[Supabase ограничивает изменения managed migration tables](https://github.com/orgs/supabase/discussions/34270); [официальный backup/restore пример](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) отдельно исключает vector-таблицы. Внутренняя реализация CLI 2.122.0 здесь не считается установленной: публичный ref исходников по ожидаемому пути не был доступен. Вместо предположений о фильтрах CLI проверяются фактические COPY-targets/columns конкретного data.sql.

На текущем snapshot ожидаются 112 логических COPY-таблиц (26/81/5), но совпадение только этих чисел недостаточно. Утилита требует точные имена и insertable columns; подмена другой таблицей при том же количестве блоков, пропуск, дубль, неизвестная колонка или partitioned scope останавливают проверку. Позднее изменение схемы требует нового рассмотренного inventory, а не обхода ошибки.

Вне этого logical scope обнаружены realtime.messages, realtime.schema_migrations, realtime.subscription и vault.secrets. Отдельное read-only чтение COUNT показало 0 сообщений, 0 подписок и 0 Vault secrets на момент проверки. Значения секретов не читались. Это наблюдение не обещает пустоту в будущем и не заменяет рассмотрение Realtime, encryption root key, extensions, configuration и private schemas перед recovery.

## Реализован инструмент без DB/restore capability

`prepare.mjs --prepare-private PRIVATE_BACKUP_DIR`:

1. Читает только roles.sql/schema.sql/data.sql и SHA256SUMS.txt по фиксированным именам. Проверяет SHA, регулярные файлы/отсутствие symlink, уникальный manifest. Исходные файлы не меняет.
2. Потоком разбирает COPY headers/columns, считает строки и проверяет число полей. Не декодирует/печатает пользовательские значения и не исполняет SQL. Повреждённые/незавершённые COPY, неожиданные DML/psql-команды и дубли останавливают подготовку. Этот parser не является общим SQL-аудитором или доказательством восстановимости schema.sql/roles.sql.
3. Проверяет exact table/column scope относительно рассматриваемого inventory и повторно сверяет входные файлы.
4. Создаёт новый приватный подкаталог `backup-readiness-*` (0700), scope.json и compare-readonly.sql (0600). Существующие результаты/архивы/дампы не перезаписываются. В stdout — только количество таблиц/строк и путь приватной папки; ни записи, ни их fingerprints не печатаются.

Сбор и выполнение запросов не автоматизированы: нет Database URL, пароля, Docker/CLI subprocess, network, apply, restore или обычного подключения к Production. Позже, при доступе к компьютеру, подготовленный запрос выполняется двумя независимо проверенными способами: на **исходном восстановленном baseline** и текущем POTOK. Не использовать `potok_security_candidate_2026-10-26`: там установлены исправления и намеренно оставлены тестовые A/B аккаунты.

## Что доказывает приватное сравнение

Одинаковый query исполняется в REPEATABLE READ READ ONLY, с фиксированными UTC/datestyle/float-format, bounded timeouts и row_security=off. Последняя настройка не выдаёт обход RLS: неподходящий актёр получает ошибку вместо скрытого сравнения урезанного набора. Запрос не возвращает исходные записи: только текущий metadata inventory, row counts и агрегированные SHA256 мультимножеств по **явным COPY-колонкам**. Повторы строк сохраняются; физический порядок не влияет. execution_reason не исключается неявно.

Обе стороны в том же read snapshot возвращают inventory всех auth/public/storage таблиц: новый table/column не остаётся незамеченным за одним только сравнением старого списка. Типы/generated metadata выбранных таблиц также сравниваются, включая пустые таблицы.

`prepare.mjs --compare-private PRIVATE_EVIDENCE_DIR RESTORED_JSON TARGET_JSON` проверяет:

- binding к точным входным SHA/scope/inventory, байты запроса, неизменность исходных backup files и соответствие текущей reviewed policy;
- два разных файла и разные timestamps, read-only/repeatable-read PG17 context, корректный формат hashes/counts, exact таблицы и колонки обеих сторон;
- свежесть каждого наблюдения до 15 минут (плюс не более минуты clock skew в будущем). Это консервативный protocol limit, а не доказательство отсутствия новых записей после сравнения. При истечении повторяется только чтение, не установка/восстановление;
- ожидаемое число строк из data.sql на восстановленной стороне, равенство counts, column shapes и content hashes на обеих сторонах.

Два JSON должны быть получены независимыми доверенными capture paths. Неподписанный JSON сам по себе не удостоверяет реальную среду: переданный по ошибке/подделанный результат нельзя превращать в release approval. Запросы не одновременны; окно фактического выпуска и финальные проверки отдельны.

Результат хранится в новом приватном comparison-подкаталоге. stdout содержит только status/tables/mismatch count. `CONTENT_MISMATCH_STOP` не является разрешением синхронизировать, чистить, подгонять counts или перезаписывать Production. `LOGICAL_SCOPE_CONTENT_MATCH_AT_OBSERVATIONS` подтверждает только выбранные данные на моменты наблюдений; mayApply/releaseReady остаются false.

Ни один исход не доказывает совпадение полных schema/RPC/ACL/политик, sequences, Storage binaries, Auth/API/Realtime settings, encrypted-root configuration или filesystem/cloud decrypt recovery. Даже при совпадении строк нельзя восстановить широкие local default grants в рабочую базу. [Supabase отдельно предупреждает о target default privileges при restore](https://supabase.com/docs/reference/cli/supabase-db-dump); restored ACL mismatch нужно расследовать как restore-contract issue, а не автоматически считать потерей/устареванием исходных данных.

## Как это сокращает следующую работу

Дату 24 октября не используем как единственную причину выбросить копию. После получения компьютера выполняется приватная сверка с уже восстановленным baseline. Если строки/структуры выбранных колонок совпадают, это сохраняет ценность существующего восстановления, но ещё нужны свежая metadata/config/Storage/recovery сверка и конкретное окно. Если есть расхождения, подготовить новую копию изменившегося состояния и подтвердить её восстановление, сохранив старую. Ничего не переустанавливается или перезаписывается автоматически.

Сами дампы, SQL fingerprints, Auth данные, Storage файлы и ключи не загружать в публичный GitHub или чат. Там публикуются только код, metadata-only scope, контракты и технический результат. Исходные локальные manifests/зашифрованная облачная копия сохраняются.

## Верификация текущего изменения

11 локальных тестов: COPY escaping/null/quoted identifiers, повреждения, exact scope, неизвестные таблицы, одинаковые counts/разный content, schema type drift, reused/stale/malformed receipts, неподходящий snapshot context, private permissions, сохранение исходных файлов и отсутствие утечек в stderr.

В disposable native PG17 CI генерируется настоящий SQL и проверяются typed JSON, Unicode/control chars/nulls/дубликаты, независимость от порядка, tamper при тех же counts, drift типа пустой таблицы и появление неизвестной таблицы. Это синтетический стенд, **не** сверка Mac/Production. CI также сохраняет предыдущие 19 tests, review-packet verification/native guard и root build; exact-head результаты закрепляются в Draft PR.

## Условие допуска следующего пакета

Пакет #222 и клиент #221 неизменны. Новый backup-content evidence — дополнительное обязательное условие перед конкретным target-bound batch, а не apply token. До него, approved managed rehearsal/config compatibility, всех остальных проверок и точного одобрения владельца release guard не снимается. Сейчас исходный backup не открывался, приватные fingerprints Production не собирались, новая копия не создавалась. Для фактической сверки требуется доступ к компьютеру с исходными приватными файлами.

## Владельческие результаты и отдельная диагностика сохранённых снимков

27 октября владелец выполнил подготовку приватных файлов, затем независимые read-only captures через psql исходного restored container и Supabase CLI Management API точного POTOK project-ref. Это вывод владельческого терминала, не прямой доступ ассистента к дампам. Подтверждены protocol binding, PG17.6, read-only/repeatable-read. Строгий compare остановился: restored inventory содержит 118 таблиц против 116 на POTOK. Именованное различие — только storage.iceberg_namespaces и storage.iceberg_tables; отдельный локальный read-only COUNT показал 0/0. Отдельные saved-data и исправленный metadata diagnostics дали 112 таблиц, 0 data differences, 0 column/kind/partition differences. Counts и hashes данных сравнивались с фактическим COPY scope и ожидаемыми строками; структура — по tuples [name,type,generated], а не сериализованным объектам с зависящим от transport порядком ключей. Полное DDL/ACL/FK/политики этим не сравнивались.

Источник имён дополнительных таблиц — официальный Supabase Storage v1.80.2, commit db42280506a07a165376219b2d6ac7bc92ccdfcc, migrations/tenant/0038-iceberg-catalog-flag-on-buckets.sql; дальнейшие миграции могут изменять определения. Это не доказывает происхождение конкретных локальных объектов только по имени. Пустота двух таблиц проверялась отдельно от старого snapshot; её нельзя переносить в новый snapshot автоматически. Ничего не удалять и не добавлять blanket exclusions.

`review.mjs --review-private EVIDENCE_DIR RESTORED_JSON TARGET_JSON` — новый offline диагностический режим. Повторно проверяет исходные роли/схему/data bytes, reviewed inventory, scope binding и точные байты канонического generated query; сохраняет отдельный 0700/0600 report. Выдаёт различия выбранных данных/структуры и полный список локальных добавлений. Два знакомых имени только классифицируются как требующие независимой проверки. Target scope остаётся строгим; unknown extras явно отмечаются STOP. Никакие дополнительные таблицы из strict compare не удаляются, исходные receipts не нормализуются и время не подменяется. Старые наблюдения допускаются только как историческая диагностика с freshAtReview=false; strictComparisonPassed, extrasEmptinessVerified, mayApply, releaseReady всегда false. `core.mjs`, `prepare.mjs`, inventory и generated SQL не меняются.

`review.mjs --verify-local-storage BACKUP_DIR` — отдельная offline проверка локальных файлов относительно двух старых manifests. Требует ровно 63 уникальных объекта в трёх известных buckets (22/3/38), точный physical file set, размер из обоих manifests и SHA256 каждого файла. Поддерживает только ранее подтверждённую вложенную CLI раскладку storage-files/bucket/bucket/object; не ищет файл по другому пути и не уплощает папки. Traversal, symlink, отсутствующий/лишний файл, duplicate manifest entry и same-size tamper останавливают проверку без вывода содержимого/путей/хешей. Исходники не меняются, создаётся новый приватный report. Это проверка сохранности локальной копии, не download/reupload и не доказательство текущих Storage binaries. Локальные manifests сами по себе не являются независимо аутентифицированным remote receipt.

Дальше отдельно нужны свежий, независимо привязанный local-extra emptiness/metadata capture, актуальные Storage binaries, schema/RPC/ACL/sequences/config и recovery compatibility, после чего — target-bound reviewed release. Результат 112/0/0 сохраняет ценность копии и не требует повторной установки кандидата или восстановления из-за двух пустых служебных таблиц. Нельзя менять guard #222, восстанавливать широкие default grants или считать этот diagnostic разрешением внедрения. Поздние владельческие результаты не объявляются не выполненными из-за разрыва чата.
