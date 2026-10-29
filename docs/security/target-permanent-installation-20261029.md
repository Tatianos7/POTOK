# Постоянное внедрение: точный пакет на согласование

## Что подготовлено

Это продолжение того же security milestone, а не новый продуктовый этап.
`target-forward.mjs` работает только офлайн (`--write-review` / `--verify`),
не содержит подключения или режима применения. SQL-файлы ниже сами исполнимые:
их нельзя запускать до отдельного согласия на постоянное применение.

- `target-twelve-forward.pending-approval.sql`: одна транзакция, те же 12 тел,
  те же baseline/locks/rows/sequences/final-rights checks, теперь один `COMMIT`.
- `target-twelve-postcommit.readonly.sql`: новое независимое соединение,
  `BEGIN READ ONLY`, точные shapes/owners, сохранённые final source/rights checks,
  SQL boundary и пустая authority. Возвращает JSON `deployment_check` со статусом
  `TARGET_TWELVE_COMMITTED_CONTRACTS_OK`, завершает `ROLLBACK`.
- `target-twelve-forward-manifest.json`: SHA256 обоих SQL, исходные 12 pins,
  клиентский pin, ограничения, допуск и порядок восстановления.

Исходный rollback-файл SHA256
`96aa896dbd00855ecd3750e0ef2fd57ab50eeb6aa74579f737a5247e1d627592`
не меняется. В permanent-файле изменены только header и последний done/terminator;
от начала BEGIN до последнего done-block байты совпадают с репетицией. Старый
`forward.review.sql` и его запретительный guard также сохранены без изменений.
Комментарии внутри 12 исходных тел остаются историческим provenance их review
источников; новый пакет не выдаёт прежнее согласие на репетицию за COMMIT approval.

## Что меняется для приложения

Порядок: TRUNCATE containment → защищённые поля профиля → anonymous RPC → права
метаданных фото → клиентские финансовые записи → private authority → каталог и
история → pg_trgm в extensions → paywall reader → scoped program read → история
программ → quarantine небезопасной legacy generation. Оплата/выдача premium по
настоящей квитанции и генератор не активируются. Authority остаётся пустой.
Обычные права профиля/фото и ограниченные program status/annotations проверяются.

Клиентский совместимый pin: `996a81c30906000b9cb6ffe88456a98b55cb692f`, файлы/hash
в исходном manifest. Пакет не публикует клиент, не сливает PR и не переключает
hosting. Старый клиент может вызывать уже закрытые legacy writes; до применения
нужно зафиксировать текущее состояние клиента и окно его совместимой публикации.
Нет основания заявлять, что Production уже использует этот pin.

## Фактическая репетиция владельца

29 октября владелец передал результаты CLI 2.122.0 с fixed linked project
`dtsdnhbcwpbfrhcazqkb`: PROJECT_BINDING_OK, оба точных SQL hash OK,
REHEARSAL_EXIT=0 и AFTER_CHECK_EXIT=0. Приватный каталог:
`hosted-rollback.6LnsvT`. Проверка четырёх файлов не нашла TARGET_* сообщений.
Это owner-reported успешные exit statuses, не сохранённые NOTICE receipts.
Не выдумывать увиденные SQL markers, время COMMIT/ROLLBACK либо raw execution log.
Запуск не повторять ради отсутствующих NOTICE. После него постоянное внедрение
ещё не выполнялось. Предыдущий connector transport failure отдельно сохранён.

## Условия перед постоянным применением

1. Подтверждена расшифровка свежего архива от 29 октября и его зашифрованная копия
   вне Mac. Сейчас это ещё не подтверждено; исходный 24 октября не заменять.
2. Зафиксировано окно без редактирования/других deploy/provider maintenance и
   решение по совместимому клиенту. Возможны ожидания входа, дневника и загрузок.
3. Владелец видит exact SQL hash/project/COMMIT и отдельно разрешает применение.
   Общее согласие «подготовь этап» этого не заменяет.
4. Непосредственно перед запуском — fixed target/version/hash и независимый
   исходный readonly admission. Drift ведёт к остановке, не смене baseline.

112 SHARE ROW EXCLUSIVE и 4 managed ACCESS SHARE сохранены. Четыре managed таблицы
не заморожены от provider writes. Sequence divergence останавливает до COMMIT,
но sequence increments сами не transactional: никогда не сбрасывать их значениями
из старой копии. Это не обещание нулевого риска или точного времени блокировок.

## Проверки и неопределённый исход

До COMMIT проверяются все 116 исходных таблиц по старым колонкам/счётчикам/хешам,
состояния sequences и final contracts. Допускается только nullable execution_reason.
После COMMIT новый readonly файл проверяет выбранные постоянные contracts/shape;
это не новый полный content proof, не HTTP и не вся функциональность приложения.
Явный JSON нужен, чтобы не полагаться на доставку NOTICE.

При ошибке до COMMIT транзакция откатывается; независимым baseline after-file
проверить состояние. При потере ответа не повторять apply: выполнить baseline и
committed-contract readonly проверки, сопоставить результат; оба fail означают
неизвестное/изменённое состояние, сохранить отчёты и остановиться.

После COMMIT автоматического inverse-скрипта нет. Остановить публикацию и запись,
сохранить текущие данные/состояние; подготовить и отдельно согласовать узкое
исправление вперёд либо восстановление metadata. Свежая проверенная копия — источник
восстановления, не разрешение затереть новые записи. Нельзя автоматически удалять
private schemas, возвращать широкие GRANT, сбрасывать sequences или восстанавливать
старые данные поверх более новых. До отдельного клиентского/HTTP post-acceptance
и подтверждения внешней копии весь security milestone не объявляется завершённым.
