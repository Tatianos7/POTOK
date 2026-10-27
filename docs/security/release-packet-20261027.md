# Пакет ревью внедрения и восстановления — 27 октября 2026

Клиент закреплён на #221 `455deef591456222e08eced30d3a7ba7bf9e242a`, tree `01e84e07e18e211dae7e9649a9909ab5e2b45cc9`. Его шесть exact-head CI успешны; поздняя владельческая работа на Mac сохраняет заявленный статус выполнения и требует сверки доказательств при доступности. Пакет не повторяет её.

## Что подготовлено

- `scripts/security/release-packet/manifest.json`: двенадцать точных ref/path/raw SHA-256, SHA нормализованных SQL-тел, клиентские файлы/версия Node и контрольные суммы артефактов.
- `forward.review.sql`: конкретные двенадцать тел в проверенном порядке в одной транзакции, финальные проверки прав/функций. До первого кандидата стоит безусловная ошибка `REVIEW_ONLY_NO_TARGET_APPROVAL`, в конце ROLLBACK; COMMIT отсутствует. Это читаемый материал ревью, **не миграция или разрешённая репетиция**. Удаление защиты/замена ROLLBACK не являются способом выпуска.
- `preflight.sql`: отдельная read-only проверка метаданных, актёра, известных shapes и fingerprint публичной части схемы. Не читает пользовательские строки, серверные файлы, секреты или ключи.
- `state.mjs`: консервативная классификация preflight и действий при сбое. Ни один результат не разрешает apply, повтор, возврат широких прав/старого клиента или выдачу authority.
- `prepare.mjs --verify`: воспроизводит артефакты только из публичных закреплённых GitHub-источников и проверяет их байты. Нет режима выполнения SQL/DB URL/Docker/восстановления. `--write-review` создаёт лишь локальные файлы.

Порядок SQL: truncate → profile → anonymous RPC → photo upsert → finance → empty authority → catalog/history recompute → pg_trgm → server paywall → program reads → history containment → legacy quarantine. Исходные двенадцать SHA/ref не изменены. Никаких новых `supabase/migrations`, hosted COMMIT, изменения ролей, выдачи прав, генератора/Edge или платежной реализации нет.

## Актуальная read-only сверка POTOK

Supabase connector подтвердил активный проект POTOK `dtsdnhbcwpbfrhcazqkb`. Наблюдение preflight: 27 октября, **13:39:47 по Москве**, session/current actor postgres, не superuser, BYPASSRLS, PG17.6, normal triggers. Только метаданные; исходные строки не выбирались. Машинная сводка — `release-preflight-observation-20261027.json`.

Установлено: 81 public-таблица, девять нужных plan-таблиц имеют ожидаемые postgres ownership/RLS; session сохраняет точный восьмой `day_date date`; execution_reason отсутствует, три candidate namespace отсутствуют. У клиентов остаётся TRUNCATE на 63 таблицах и запись четырёх защищённых profile columns. Это **BASELINE_OBSERVED**, не утверждение, что на hosted уже применены все исправления или что полное содержимое совпадает со старой копией. Частичные прежние изменения не исключаются.

pg_trgm relocatable, но находится в public и принадлежит supabase_admin; ordinary actor owner access отсутствует. Это не доказательство запрета managed SET SCHEMA: hook Supabase может разрешать поддерживаемый путь. Однако действительная hosted-репетиция такого пути в текущем шаге не выполнялась и не заменяется нативным PostgreSQL CI. Повышать роль, менять pg_extension, удалять extension или молча исключать восьмой кандидат запрещено.

`pgrst.db_schemas` не найден в pg_db_role_setting. Это **не** доказательство, что private/extension schemas закрыты HTTP: конфигурация может поступать вне каталога. Нужна отдельная сверка фактической Data API exposure.

Первое метаданное наблюдение показало 27 auth / 81 public / 8 storage физических таблиц. Старые 26/81/5 относятся к COPY-блокам экспортированного data.sql, включая исключения managed-таблиц. Эти показатели нельзя прямо сравнивать и объявлять потерей данных/дрейфом. Для нового выпуска отдельно установить полное покрытие текущего дампа, исключений, Storage binaries и recovery; старые 112/14888 остаются доказательством конкретного восстановления, а не вечным hosted baseline.

Fingerprint публичных метаданных `427466d34aa57984cb4449a3532ece63ece1d27b61f6ccdfbea86c5cf4c878af` — наблюдение для последующей сверки той же процедуры. Он не покрывает пользовательские строки, все role memberships, private schemas, индексы pg_trgm, HTTP settings или полный backup; совпадение не разрешает применение. Перед фактическим окном нужно новое чтение.

## Проверенные advisor-категории и граница пакета

Security advisors вернули следующие пять категорий предупреждений; количество записей категории не означает количество затронутых функций:

- [Function search_path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable): чтением отдельно обнаружены invoker trigger-функции без закреплённого path. Это требует рассмотрения определений; текущие 12 исходников не объявляются универсальным исправлением всех таких предупреждений.
- [Extension in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public): pg_trgm, путь выше.
- [Anon security-definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) и [authenticated security-definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): границы восьми legacy RPC и будущих replacements входят в пакет; effective права и допустимость оставшихся вызовов проверять после применения. Сам definer — не автоматическое доказательство уязвимости или её устранения.
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): Auth setting, не SQL-исправление. Учесть реальную email-OTP модель и тариф/настройки отдельным решением, не менять paid plan или методы входа автоматически.

Новый read-only список имён подтвердил восемь legacy definer RPC с anon/authenticated EXECUTE и invoker функции без search_path. Тела функций не менялись, RPC не вызывались. Нельзя обещать «все предупреждения исчезнут» после 12 шагов.

## Конкретный порядок допуска и внедрения

1. Повторно закрепить клиент/12 SQL/actual target и сравнить свежие source/metadata. При частичной установке/дрейфе остановиться и разработать отдельный forward repair; raw installer не переиспользовать.
2. Зафиксировать актуальный приватный backup/Storage scope, пароль и восстановление полной копии. Не переносить 112/14888 на новую базу и не коммитить данные/отпечатки строк в публичный репозиторий.
3. Проверить supported managed pg_trgm и reserved defaults на отдельно одобренной подходящей копии; сверить полные preconditions/исходники/эффективные GRANT/RLS и HTTP schema boundary. В этой ревизии такой hosted write не разрешён и не выполнен.
4. На основе конкретных доказательств подготовить отдельный target-bound forward batch: одна транзакция, actor/version/source checks, полный актуальный набор locks и bounded timeouts, исходные content fingerprints под блокировками, все 12 тел и финальные effective/source/content/empty-authority проверки до COMMIT. Ни guarded review.sql, ни старый private installer такими пакетами автоматически не становятся.
5. Согласовать этот точный forward hash, target, клиентский commit, клиентское окно и recovery с владельцем. До этого apply-блокировка не снимается. Merge в master запускает Pages: это часть выпуска, не просто сохранение ревью.
6. Обновить используемые клиенты/вкладки до #221-compatible версии в согласованном окне; на старой схеме day actions явно недоступны. После одобренного SQL отдельно подтвердить committed состояние **новым соединением**, HTTP cache и own/foreign actions, статус/reason, неизменность plan/history/FACT и обычные login/profile/photo/catalog пути. Старые вкладки обновить; unsafe grants не возвращать.

## Что делать при сбое

| Ситуация | Конкретное действие |
| --- | --- |
| Подготовка / preflight не прошли | Ничего не применять; исправить причину, заново сверить source и target. Не исключать кандидат |
| Ошибка до COMMIT, подтверждён ROLLBACK | Сверить свежую baseline metadata **и content**; проверить, что сессия/транзакция закрыты. Ошибку исправить отдельно; автоматического повторного допуска нет |
| Связь пропала около COMMIT / исход неизвестен | Остановить запись/повтор. Новым read-only соединением сверить source, effective права, relation/column/extension и content evidence. Даже похожая metadata не доказывает исход. Классификатор всегда требует reconciliation |
| COMMIT подтверждён, но API/UI не прошли | Сохранить containment и совместимый maintenance-клиент. Сверить readiness/cache и drift чтением; разработать конкретный forward repair под причину. Старый клиент и широкие права не являются recovery |
| Повреждено содержимое / нужен restore | Отдельно одобрить recovery target и окно, учесть записи после backup и storage/auth consistency; восстановить в отдельную среду и проверить перед переключением. Не затирать рабочую базу старым архивом автоматически |

Универсального безопасного repair-SQL после произвольного COMMIT не существует. Здесь подготовлены детерминированные решения об остановке и необходимые доказательства; исполняемого destructive restore/down-script нет.

## Верификация этого шага

Preflight.sql выполнен на POTOK внутри BEGIN READ ONLY/ROLLBACK, возвращён только metadata JSON. Классификатор выдал BASELINE_OBSERVED/mayApply=false. Девять локальных contract-тестов пройдены, воспроизводимость 12 source/hash и review artifact проверена. CI проверяет тот же manifest и recovery-policy и на одноразовом нативном PG17 доказывает, что **точный** review SQL останавливается до первого кандидата без изменения public objects/schemas/roles/defaults. Результаты exact-head сохраняются в Draft PR после завершения. Нативный stop-test не является репетицией managed DDL, COMMIT, API или полного backup.

Итог этапа: конкретный source-пакет для ревью и read-only/recovery инструменты готовы; **исполняемый hosted release ещё не допущен**. Следующий блок — managed path/exposure и актуальный backup/target-bound rehearsal. Это не отменяет успешных #221 CI и выполненной владельцем Mac-работы. Порядок неизменён: согласованный security-этап → фейерверк → генерация питания → реальные квитанции #198.
