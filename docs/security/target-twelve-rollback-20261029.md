# Точная managed-репетиция двенадцати исправлений с откатом

Это следующий конкретный шаг прежнего security milestone. Закрытые Mac tests,
application acceptance и свежее восстановление не повторяются. Новые продуктовые
улучшения, платёжки, генератор и Edge сюда не добавляются.

## Подготовленный результат

target-rehearsal.mjs формирует actual SQL batch, а не старый outline. Он не имеет
DB/HTTP/Docker клиента или apply режима; доступны только --write-review/--verify.
Точные SHA256 двух SQL файлов находятся в target-twelve-rehearsal-manifest.json.
Исходный статус генерации пакета — pending approval. Фактические попытки и
результаты владельца записаны ниже; этот статус не является разрешением COMMIT.

1. target-twelve-rehearsal.pending-approval.sql — одна READ COMMITTED транзакция,
   двенадцать прежних exact bodies, проверки, единственный обязательный ROLLBACK.
   COMMIT отсутствует. Это SQL с временными изменениями рабочей схемы/прав и
   блокировками, поэтому не исполнять только на основании общего «продолжай».
2. target-twelve-after.readonly.sql — отдельная BEGIN READ ONLY транзакция для
   нового соединения после успеха, ошибки или потери связи. Проверяет baseline
   metadata/shape/owners и отсутствие candidate namespaces; завершает ROLLBACK.
   Это metadata reconciliation, не самостоятельный полный content backup proof.

Привязка соединения — внешний аргумент Supabase connector:
supabase.execute_sql(project_id=dtsdnhbcwpbfrhcazqkb, query=exact approved bytes).
Строка project ref в SQL, current_database или custom GUC не доказывают identity.
Не подменять fixed connector target произвольным URL и не выполнять через
непроверенную вкладку SQL Editor. Клиентская публикация этим пакетом не выполняется.

## Что действительно выполняется

- До locks проверяются session/current actor postgres, nonsuperuser/BYPASSRLS,
  PG17.6 exactly, origin, READ COMMITTED, безопасные client role attributes и
  отсутствие частично установленного candidate namespace.
- Текущие SELECT/MAINTAIN/UPDATE/DELETE/TRUNCATE privileges должны совпасть с
  проверенным составом 112 / 4. Автоматического ослабления режима нет.
- Все 116 таблиц перечислены в одном детерминированном порядке. 112 получают
  SHARE ROW EXCLUSIVE, четыре managed таблицы — только ACCESS SHARE. Последние
  не заморожены от provider writes; не заявлять обратного. Не запускать во время
  миграций/обновлений провайдера или другого deployment. Наблюдаемый drift ведёт
  к ошибке; он не игнорируется и не исправляется автоматически.
- После locks проверяются исходный public metadata SHA256 и точные 116 shapes/
  columns/generated flags/owners. Состав соответствует inventory, ни одной
  неучтённой таблицы или partial program install нет.
- В temp evidence сохраняются все старые колонки/row counts/отсортированные
  полные row hashes для 116 таблиц. Пользовательские строки/хеши не печатаются.
- Отдельно снимаются состояния значений/is_called и pg_sequence catalog для
  старых sequences трёх схем. После кандидатов требуются их точные совпадения.
  Sequence increments не transactional: при divergence только STOP, никогда
  setval/reset. Проверка не заменяет ещё не выполненную сверку sequences backup.
- Вставлены неизменённые 12 bodies и прежние source/effective rights/boundary
  checks из exact forward.review.sql. Его исходный guard/file не изменялся;
  новый assembly защищён отдельными настоящими preconditions и pinned SHA.
- Проверяются допустимое единственное добавление nullable execution_reason,
  сохранность old-column данных всех 116 таблиц, отсутствие новых annotations,
  states sequences, final source/rights, пустая authority и SQL boundary.
- После TARGET_TWELVE_REHEARSAL_CHECKS_OK выполняется ROLLBACK. Только затем новое
  соединение запускает independent after-file. Маркер after-file без успешного
  rehearsal marker не доказывает выполнение репетиции.

Первая фаза locks ограничена 3s; исходные pinned candidates сохраняют собственные
lock timeout 3–5s и statement timeout 30–60s. Header statement timeout=120s,
idle-in-transaction timeout=120s. Это не гарантия общей wall-clock длительности.
На время блокировок вход/запись дневника/Storage могут ждать: выбирать окно без
активного редактирования. HTTP/конфигурация API/аккаунты не переключаются.

## Сохранённые исходные условия

Owner Dashboard evidence подтверждает Exposed schemas=public,graphql_public и
Extra search path=public,extensions. Настройки не менялись. Перенос pg_trgm в
extensions по официальному supported managed механизму пока не выполнялся на
hosted. Эта согласованная репетиция должна проверить его, включая Supabase hook,
с точно теми же SQL телами и обычной ролью, и откатить результат.

Файлы Storage/конфигурация провайдера в репетиции не изменяются. Две reserved
supabase_admin default TRUNCATE записи могут остаться; конечный SQL boundary
проверяет отсутствие их platform objects/extensions в public и отсутствие unsafe
собственных/существующих client TRUNCATE. Membership/роль supabase_admin не выдаётся.

## Решения после фактического запуска

При доступных NOTICE успех подтверждается rehearsal marker + ROLLBACK +
independent baseline after-check. Для CLI Management path NOTICE могут не попасть
в отчёт: отдельно сохранять exit statuses и не выдумывать отсутствующие markers.
Сбой до/во время кандидата: независимо проверить baseline, сохранить частные
результаты, разобрать причину; автоматического повтора нет. Потеря соединения:
новое read-only соединение и reconciliation, не предполагать успешный исход.
Этот пакет не содержит COMMIT, но долгую/незавершённую транзакцию всё равно нужно
проверить перед продолжением. Приватные дампы/row hashes/logs не публиковать.

Успешная hosted репетиция не является permanent installation/client deployment.
Для этого нужен отдельный точный forward/client window/recovery approval и
post-commit acceptance. Внешняя зашифрованная копия остаётся владельческой задачей
на вечер; её шифрование/облачное сохранение ещё не подтверждены.

## Разрешённая попытка через connector и независимая сверка

Владелец отдельно разрешил необходимую безопасную репетицию после предъявления
точного SQL SHA256 96aa896dbd00855ecd3750e0ef2fd57ab50eeb6aa74579f737a5247e1d627592.
Permanent deployment/COMMIT/client publication этим не разрешены.

Перед попыткой exact bytes/SHA проверены; get_project вернул POTOK / ACTIVE_HEALTHY /
17.6.1.063. Exact readonly baseline/shape guard прошёл, managed write lock holders
в момент наблюдения=0. Затем единственный вызов execute_sql с exact approved batch
вернул transport error Invalid or expired requestState, без SQL execution receipt.
Не считать его ни SQL failure с известным местом остановки, ни успешной репетицией,
ни доказательством, что сервер вообще начал выполнение. Автоматического повтора нет.

На новом соединении 29 октября 15:01:26 по Москве: pg_trgm/public, candidate
namespaces=[], matching rehearsal sessions=[], other strong write lock holders=[].
Далее exact независимый after-file прошёл и вернул дополнительный readonly marker
TARGET_REHEARSAL_INDEPENDENT_BASELINE_OK: 81 public tables, 63 client TRUNCATE,
origin. Проверки baseline public metadata/116 shapes/owners прошли. Это подтверждает
исходное metadata состояние и отсутствие наблюдаемых зависших locks/транзакции,
не является receipt выполнения twelve candidates и не объявляется новым полным
сравнением содержимого всех строк после transport failure.

Следующий запуск возможен только как отдельно инициированная владельцем попытка
того же exact batch через ранее работающий CLI Management path, с проверкой fixed
linked target/версии/bytes, fresh readonly admission и обязательным independent
after-check даже при ошибке. Приватные stdout/stderr сохранить на Mac, в чат только
exit/status; никаких broad cleanup, изменённых bodies или постоянного применения.

## Результат ручного CLI запуска владельца

Владелец 29 октября передал PROJECT_BINDING_OK, оба SQL hash OK,
REHEARSAL_EXIT=0, AFTER_CHECK_EXIT=0; приватный отчёт `hosted-rollback.6LnsvT`.
В rehearsal.json/log и after.json/log поиск TARGET_* вернул пустые наборы.
Фиксируем успешные owner-reported exit statuses для exact batch и независимого
after-check, а не увиденные NOTICE или полный raw execution receipt. Ради отметок
репетицию не повторяем. Постоянное внедрение не выполнялось; отдельный точный
COMMIT пакет и условия находятся в target-permanent-installation-20261029.md.
