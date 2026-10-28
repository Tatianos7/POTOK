# Двенадцать исправлений после выравнивания прав — 28 октября 2026

## Уже подтверждено владельцем

LOCAL_RIGHTS_PARITY_TEMPORARY_OK и LOCAL_RIGHTS_PARITY_ROLLBACK_OK из #227: в исходном восстановленном Docker container точные 213 лишних прав временно сняты, вся выбранная effective matrix совпала с target с сохранением запрета клиентского TRUNCATE, затем исходный ACL восстановлен. Это владельческий вывод терминала. Production/Staging не менялись. После ROLLBACK лишние локальные права остались; committed permission repair и application acceptance с production grants не утверждаются.

## Следующий узкий gate

`strict-twelve.mjs --plan-strict-local EVIDENCE_DIR LOCAL_JSON TARGET_JSON` создаёт новый приватный SQL-план. Нужны новые независимо снятые read-only snapshots по тому же capture.sql из #227: старые snapshots не продлеваются. Общая проверка `privateRollbackPlan` повторно сверяет source hashes, capture bytes, свежесть/actor/version/roles/owner/RLS, все 1944 rights и точные 213 tuples с сохранённым differences.json. Рефакторинг общего verifier сохраняет существующий CLI/guards и rollback SQL, нового apply режима нет.

Затем инструмент загружает только 12 публичных источников по существующим exact commit/SHA, проверяет исходные четыре runner modules по прежним SHA и COPY scope 112 таблиц/14888 строк, включая точные имена 81 public table. Никаких DB/Docker subprocess, передачи private files или credentials по сети. Public fetch не означает network-offline; все URL фиксированы existing registries, redirects запрещены. Отчёт и SQL — новые 0700/0600 файлы, старые результаты и дампы не перезаписываются.

Сборка сохраняет **байты тел всех 12 кандидатов и существующих final/content/metadata checks**. В одну BEGIN/ROLLBACK транзакцию входят:

1. Existing parity preflight до первого REVOKE: свежесть, точный ACL и baseline effective matrix.
2. Ровно 213 временных REVOKE и подтверждение target selected matrix; без выдачи новых прав.
3. Все 12 прежних candidate bodies и их final effective permissions, source contracts, empty authority и original-content проверки.
4. Общий ROLLBACK.
5. Existing twelve metadata/content rollback checks, затем existing parity ACL/effective matrix rollback checks и STRICT_TWELVE_ROLLBACK_OK.

Session-local TEMP snapshots создаются до BEGIN. Предназначенный caller — только psql ON_ERROR_STOP в исходном local restored container с проверенными Docker endpoint/image/volume; не один SQL API пакет, SQL Editor или Management API. Отправка setup до BEGIN отдельными запросами в native driver воспроизводит psql boundary. Успех без всех трёх TWELVE_CHECKS_OK, TWELVE_ROLLBACK_OK и STRICT_TWELVE_ROLLBACK_OK не принимать. При ошибке connection close откатывает незавершённую транзакцию; повтор автоматически не запускается.

#222 forward.review.sql/guard/manifest не используются как apply и не меняются. Ни один COMMIT не добавляется, candidate definitions и их порядок не меняются. Новая nullable execution_reason исключается только существующим old runner способом с отдельной проверкой NULL; day_date и все прочие оригинальные данные остаются в hashes.

## Верификация и пределы

Unit contracts проверяют порядок parity-before-candidates, единую transaction boundary, сохранение обоих rollback verifiers, запрет COMMIT/psql metacommands и точное вхождение всех 12 реальных закреплённых source bodies. Existing 44 contracts продолжаются.

Новый native case в существующем twelve fixture создаёт недостающие padding tables до 81, снимает fixture-only PUBLIC blanket grants, делает явные client grants и моделирует 213 избыточных разрешений на padding tables. Настоящие metadata capture/parity и все 12 закреплённых кандидатов исполняются вместе, затем сравнивается исходный synthetic metadata/content snapshot. Это проверяет реальную PostgreSQL композицию, но **не** реальный состав private 213 grants или затронутые application paths — для этого нужен владельческий прогон на полной копии. Уже существующие двенадцать native cases и private commit/recovery проверки сохраняются; исходные runner modules не меняются.

## Дальнейшая приёмка

Этот rollback gate не создаёт постоянно ограниченную API/UI среду. После владельческого результата отдельно определить безопасный способ проверки затронутых путей в корректно ограниченной private candidate среде, сохранив существующие Auth/A-B аккаунты и late owner evidence. Не объявлять приложение принятым по SQL marker, не пересоздавать старую среду или повторять всё восстановление автоматически. Полный security этап ещё не завершён; release требует прежних managed/config/recovery и точного target-bound одобрения. Следом по согласованному порядку — фейерверк, планы питания, затем платежи #198.
