# Сверка восстановления и прав — 27 октября 2026

Этот шаг — read-only диагностика и уточнение provenance; Production/Staging, 12 SQL-кандидатов и клиент не изменены. Исторические локальные результаты не повторяются из-за потерянной синхронизации чата.

## Полученные доказательства

- Владелец подтвердил: 112 таблиц совпали по сохранённым data counts/hashes и именам/типам/generated колонок. Это selected scope на моменты snapshots, не атомарный backup всех настроек.
- 63 старых локальных Storage файла прошли exact-set/size/SHA256. Затем из точного POTOK project-ref CLI с --experimental скачал три bucket в новую папку; все 63 новых файла прошли тот же verifier против старых manifests. Исходники/remote objects не менялись. Результат подтверждается владельческим выводом, не прямым доступом ассистента к файлам. Локальный verifier оставляет remoteBinariesVerified=false по дизайну; отдельный CLI capture не превращает DB+Storage в атомарный snapshot.
- Полные raw public metadata fingerprints различаются. По шести выбранным категориям relations/routines/policies MATCH; columns/table_acl/defaults требуют разбора. Это не полная DDL/ACL/index/config сверка. Routines fingerprint включает signature/owner/security/config/ACL/prosrc-MD5, но не все pg_proc properties; нельзя называть его полной эквивалентностью функций.
- Локальный исходный restored container имеет client TRUNCATE=0, рабочий POTOK=63; обе стороны public tables=81, protected profile write columns=4. Это соответствует видимому раннему локальному COMMIT первого truncate containment кандидата. Называть этот контейнер полностью неизменённой permission baseline или повторно ставить пакет ради baseline нельзя. Данные остаются прежними; private candidate с 12 исправлениями и A/B пользователями — другой контейнер.
- Предыдущая вспомогательная column diagnostic ошибочно включила pg_attribute для indexes, а не только table columns. Четыре missing-name записи относятся к двум index tuples user_profiles_pkey/user_profiles_user_idx: старое внутреннее user_id против id_user. Отдельные реальные pg_get_indexdef, valid/ready на Production и владельческой локальной стороне совпали: btree(id_user), первичный индекс unique, оба valid/ready. На Production indkey ссылается на базовую колонку id_user. Это не повод переименовывать колонку, переписывать системный каталог или пересоздавать индекс. Проверка двух индексов не заменяет все constraints/index definitions.

## Узкая проверка оставшихся прав

`scripts/security/backup-readiness/restore-rights-review.sql` выполняет только catalog SELECT в BEGIN READ ONLY/ROLLBACK, фиксирует search_path и timeouts. Все восемь PG17 table privileges сравниваются по effective permissions anon/authenticated/service_role для всех public ordinary/partitioned tables. Отдельно исключены ровно anon/authenticated TRUNCATE tuples, поскольку они уже изменены первым локальным кандидатом. Service TRUNCATE, MAINTAIN и остальные разрешения не пропускаются. Нулевой локальный client TRUNCATE выводится отдельно, а не предполагается.

Default ACL нормализован через aclexplode с owner/schema/object-kind/recipient/grantor/privilege/grantable, без зависимости от порядка ACL text. Исключены только postgres/public defaults TRUNCATE для anon/authenticated — точный эффект первого кандидата. GLOBAL, extensions, reserved-owner defaults и все прочие privileges остаются в сравнении. Это диагностическое моделирование известного изменения, не ослабление строгого backup compare. Исходные receipts/дампы/ACL не меняются.

Референс — реальное только-чтение POTOK 27 октября 2026 **21:32:35 по Москве**. SQL сравнивает с датированными metadata hashes, не с обещанием неизменности Production в будущем. На самом target обе проверки дали true, client TRUNCATE=63; локальный результат ещё нужно получить. При false — разобрать отличия, не выдавать blanket GRANT и не подгонять хеш. При true — подтверждены только эти selected effective table/default rights с учётом двух точных исключений, mayApply/releaseReady всегда false. Column/routine ACL, schema/sequence privileges, роли, политики и настройки — отдельные scope; часть ранее проверена fingerprints, но этот SQL их не охватывает. Права администратора и service_role не выдаются.

## Порядок следующих действий

1. Получить локальный результат узкой проверки прав. Зафиксировать оставшиеся отличия или подтверждённую эквивалентность с первым локальным containment.
2. Завершить уже предусмотренную recovery/config совместимость и managed rehearsal по существующим gates, сохранив позднюю владельческую приёмку как выполненную по сообщению владельца до сверки доказательств. Не начинать восстановление/OTP/browser tests заново автоматически. Settings/SMTP/JWT/encryption provenance нельзя вывести из совпадения public таблиц; секреты в чат не передавать.
3. Подготовить конкретный target-bound forward/recovery и окно client-first из #221/источников 12 кандидатов. #222 остаётся guarded source-review SQL, не apply; не удалять guard и не менять ROLLBACK на COMMIT как процедуру выпуска. Не активировать generator/issuer и не восстанавливать unsafe defaults.
4. Выполнить только точно согласованное внедрение и фактическую проверку результата. После завершения согласованного security этапа — обещанный фейерверк, затем генерация планов питания, платежи отдельно #198.

## Проверка исходника

Финальный SQL реально исполнен на POTOK только чтением: обе reference comparisons true, 81 public tables, client TRUNCATE=63, mayApply/releaseReady=false. Дополнительный native CI использует только fixed disposable loopback PG17, создаёт три fixture role и проверяет: синтетическая база не совпадает с production reference, query не меняет catalog/roles/defaults. Ни один успех не означает владельческий локальный запуск или release approval.
