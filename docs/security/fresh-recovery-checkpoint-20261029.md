# Проверенная свежая копия и фиксированная граница этапа — 29 октября 2026

Источник — фактические владельческие результаты терминала, не самостоятельный
доступ агента к приватным файлам Mac. Не публиковать дампы, файлы пользователей,
ключи, пароли, полные private logs и fingerprints содержимого строк.

## Закрыто — не повторять

- 12 кандидатов совместно прошли локальную репетицию и проверку отката. На
  отдельном исправленном кандидате прошли Auth A/B, профиль, diary/photo writes,
  реальные Storage binaries и program SDK; nutrition MyProgram UI прошёл в
  program-ui-izBBNW. Подробная граница — local-acceptance-checkpoint-20261029.md.
- Свежие роли, application schema и data от 29 октября прошли SHA256; 63 файла
  из трёх buckets скачаны, exact set/size/local SHA проверены. Независимые
  Storage inventories до/после скачивания совпали.
- Отдельно выгружена текущая структура managed auth/storage: CREATE TABLE IF NOT
  EXISTS означает, что первоначальный узкий счётчик CREATE TABLE был неверен;
  уточнённая проверка дала 27 auth / 8 storage, SHA256 сохранён.
- Новая изолированная PG17.6 база с новым томом, network=none,
  listen_addresses пусто, cron.launch_active_jobs=off. Первые проблемы прав
  пустого тома и выбора HBA исправлены только в этом контейнере. Ни исходная
  копия, ни исправленный кандидат не перезаписывались.
- Встроенный bootstrap даёт только 5 auth tables. Полные свежие managed схемы
  поэтому восстановлены отдельно, вместе с roles/application schema/data.
  Schema rehearsal с ROLLBACK прошёл. Следующая загрузка стала видна из нового
  соединения: 27 auth / 81 public / 8 storage = 116 таблиц.
- FRESH_RESTORED_ROW_COUNTS_OK: 112 COPY tables, 14888 / 14888 rows, mismatches=0.
- FRESH_RESTORED_COPY_CONTENT_OK: те же 112 таблиц / 14888 строк; отсортированное
  COPY-содержимое и списки колонок совпали, multiplicity сохранена, mismatches=0.
- FRESH_RESTORED_FOREIGN_KEYS_OK: checked=117, failed=0, violations=0, origin.
  Старое число 120 относится к другой локальной схеме; не объявлять одинаковым
  полный FK inventory без отдельного сравнения определений.
- FRESH_STORAGE_DB_FILE_BINDING_OK: 63 объекта, buckets и все сохранённые
  id/path/version/size metadata восстановленной базы совпали с файловой копией.
- Aggregate исходных прав: 81 public / 63 client TRUNCATE, все четыре protected
  profile fields ещё writable, storage policies=11, anon/authenticated не
  superuser и не BYPASSRLS. Это baseline до исправлений, не protected release.
  Aggregate не подменяет полное сравнение ACL/defaults/routine/policy definitions.
- RESTORE-CHECKPOINT.json записан на Mac; свежий архив 53 MiB создан, gzip и
  SHA256 проверки прошли. Оригинальная копия от 24 октября сохраняется.

## Перенос пока не завершён

Шифрование/проверка расшифровки пока не подтверждены. Неудачные попытки не считать
FRESH_ENCRYPTED_BACKUP_VERIFIED. Облачная загрузка и обратное скачивание ещё не
подтверждены. Показанную пользователем в чате автогенерированную фразу не
использовать повторно и не сохранять в репозитории. Напоминание на 29 октября
20:00 Europe/Moscow создано; оно не является доказательством выполнения.

Новый SQL restore не подтверждает полный backup всего проекта Supabase:
sequence states отдельно не сопоставлены; настройки API/Auth/SMTP/Edge/Vault,
другие схемы, managed migration history и новое Storage HTTP восстановление
не объявлены проверенными. Эти ограничения уже перечислены в частном receipt.

## Конечная граница согласованного security milestone

Точный согласованный пакет установлен на рабочий target, совместимый клиент
опубликован, ограниченные рабочие postchecks прошли, проверенная резервная копия
сохранена вне Mac. Затем фейерверк → генерация питания → квитанции #198.

Не добавлять к этому этапу новые продуктовые улучшения и не переоткрывать
завершённые local gates. Показывать закрытые результаты отдельно от конкретной
оставшейся причины остановки. Не обещать «последнюю команду» без готового пакета.

## Оставшийся конкретный выпуск

Вопросы managed relocation/API и доступности locks, точный connection-bound
forward/reconciliation, client window и одобрение target/hash/recovery остаются
частью прежнего release gate. Hosted apply/merge/deploy не выполнены. До точного
одобрения владельца рабочий проект допускает только чтение.
