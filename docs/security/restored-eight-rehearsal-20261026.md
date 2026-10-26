# Полная локальная копия: rollback-репетиция восьми кандидатов

Подготовленный инструмент: `scripts/security/accumulated/restored.mjs`. 26 октября владелец предоставил успешный `EIGHT_RESTORED_REHEARSAL_OK` на приватной копии (112 таблиц / 14888 строк), включая content и metadata rollback. Это не независимый доступ к backup и не приёмка последующих #206–209. CI проверяет генерацию и поток выполнения этого SQL только на синтетических таблицах. Это подготовка следующей приёмки, не свидетельство её прохождения и не разрешение внедрения.

## Среда и входы

- Компьютер владельца с Node.js 22+ и локальным Docker Engine/Desktop; Mac не обязателен. Этот процесс не использует Supabase CLI login/link или hosted DB URL.
- Отдельно восстановленная копия исходного backup от 24 октября: папка `POTOK_BACKUP_2026-10-24` с неизменёнными roles.sql/schema.sql/data.sql и SHA256SUMS.txt. Инструмент не расшифровывает архив и не выполняет restore. Пароль от зашифрованной копии хранится отдельно и вводится только локально при восстановлении.
- Healthy локальный контейнер `supabase_db_POTOK_BACKUP_2026-10-24` на Supabase Postgres 17, с полными данными backup, normal triggers и существующим nonsuperuser postgres/BYPASSRLS owner channel. Копия изолирована от обычной работы приложения. Схема должна соответствовать точным preflights кандидатов; при drift процесс остановится.
- Проверенный checkout exact commit из соответствующего Draft PR, включая inputs.mjs/checks.mjs/restored.mjs. Не брать произвольную новую вершину ветки вместо согласованного commit. Сам запуск делается из папки backup командой Node на абсолютный путь `scripts/security/accumulated/restored.mjs` внутри проверенного checkout с единственным аргументом `--run-restored-local`.

Первоначальный прогон выполнен владельцем; следующий расширенный сценарий описан в `restored-twelve-rehearsal-20261026.md`. Команды давать только для exact проверенного инструмента и установленного расположения backup. Не просить backup или пароль в чат и не отправлять их в GitHub Actions.

## Что происходит

1. Проверяется точный аргумент и имя исходной папки, локальный Docker endpoint (unix socket или локальный Windows named pipe; удалённые ssh/tcp contexts отклоняются).
2. Пересчитываются три SHA-256 из строгого manifest. Из COPY-блоков data.sql извлекаются таблицы и counts: ровно 112 таблиц, 14888 строк, распределение auth 26/public 81/storage 5. Иная версия backup требует отдельной адаптации, а не отключения guards.
3. Проверяются имя, ID, image, running/healthy фиксированного контейнера. Дальше используется его captured ID, не повторный поиск по имени.
4. Восемь публичных SQL-файлов скачиваются по неизменяемым commit и проверяются по SHA-256. Снимается только проверенный внешний transaction wrapper. Hosted API/SQL не вызываются, профиль/authority никому не назначаются.
5. Внутри копии строятся TEMP-only эталоны: counts и SHA-256 полного содержимого каждой таблицы backup (с сохранением дубликатов), metadata namespaces/relations/columns/functions/defaults/policies/constraints/triggers/event triggers/roles/memberships/extensions/indexes/types. Для metadata учитываются public/auth/storage/extensions и две authority namespaces. Значения и результаты не выгружаются в лог или репозиторий.
6. В одной транзакции выполняется точная группа из inputs.mjs. Проверяются итоговые effective permissions и шесть authority/gate source contracts. Store должен остаться пустым. Затем снова сверяется содержимое всех таблиц backup и выполняется ROLLBACK.
7. Проверяется возврат metadata и содержимого к начальному состоянию, normal trigger state, а после SQL — неизменность трёх backup hashes. TEMP эталоны удаляются. В новую private локальную папку сохраняются только сгенерированный SQL и публичная матрица входов; исходные backup-файлы не перезаписываются.

Порядок стриминга psql важен: TEMP эталоны создаются до внешнего BEGIN, затем идёт единственная транзакция кандидатов, после её ROLLBACK — сверка. В CI эти три части исполняются отдельными protocol calls, чтобы не выдать неэквивалентную multi-statement implicit transaction за psql-приёмку. Проверяется и случай подмены содержимого при неизменном количестве строк.

## Результат и ограничения

Успех требует нулевого exit code и маркеров `EIGHT_CHECKS_OK`, `EIGHT_ROLLBACK_OK`, `EIGHT_RESTORED_REHEARSAL_OK`. При ошибке ON_ERROR_STOP прекращает SQL; незавершённая транзакция откатывается при закрытии psql. Никакой успех не заявляется, preflight не ослабляется и права не повышаются. Для незавершённой проверки после ROLLBACK повторяют диагностику исходного состояния, а не применяют patch вручную.

Этот runner не проверяет бинарные Storage-файлы, не доказывает происхождение backup одним его checksum, не проводит persistent committed/UI приёмку, не моделирует внешние клиенты/платежи и не закрывает provenance/retention/erasure/другие Premium gates. Он не меняет отсутствующую схему Staging для видимости parity. Для pg_trgm остаётся различие между обычным PostgreSQL и платформенными Supabase hooks: права из metadata — не доказательство и не запрет managed SET SCHEMA; сам owner-runner лишь испытывает реальную локальную копию с ROLLBACK.

Следом нужны отдельная persistent приёмка всей группы и приложения на копии, свежая read-only drift проверка рабочей цели, recovery/monitoring и точное одобрение Production batch. Не заменять финальный ROLLBACK на COMMIT и не использовать этот инструмент как deploy-команду.
