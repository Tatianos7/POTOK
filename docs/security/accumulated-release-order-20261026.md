# Накопленные исправления: совместная проверка и порядок внедрения

Решение владельца от 26 октября 2026: текущий этап — безопасность; после его завершения обещанный фейерверк, затем продолжение генерации планов питания. Настоящие платёжные квитанции — отдельная последующая задача [#198](https://github.com/Tatianos7/POTOK/issues/198). Покупки пока не проверяются у провайдера. Не считать legacy billing events доказательством оплаты. Ни платежи, ни генератор этим пакетом не включаются.

## Статус и границы

Это интеграционная проверка и план допуска, **не разрешение на внедрение**. Текущие кандидаты — Draft; Production/Staging не изменены. Успех синтетической CI-проверки не заменяет испытание всей восстановленной схемы или приёмку приложения на ней. Mac для этой CI-работы не нужен; для полного приватного восстановления подойдёт компьютер с Docker любой поддерживаемой ОС.

Единственный источник порядка и SHA-256 входов — `scripts/security/accumulated/inputs.mjs`. Теперь проверяются **восемь** кандидатов: исходная семёрка #199 плюс адаптация authority #201. Четыре внешних файла загружаются по неизменяемым commit и SHA-256, четыре локальных файла сверяются с зафиксированными SHA-256. Локальный restored-runner загружает все восемь только по pinned public URL и проверяет bytes. Отдельной команды применения к hosted-проектам нет.

| Порядок | Исправление | Точный источник | PR |
| --- | --- | --- | --- |
| 1 | TRUNCATE существующих public-таблиц и postgres/public defaults | c175e74d7a7c1077e4e8d6d4d8f67c960b06d677 | #187 |
| 2 | Разрешённые и защищённые колонки профиля | 7f4f7e24fec497a22dea29dd14f4546115439129 | #190 |
| 3 | Анонимный EXECUTE восьми старых RPC | 47e2ff8bd4937469576f8cfaceecaaefca33548e | #189 |
| 4 | Явные права фото-таблиц и UPDATE policy для upsert удаления | c02608a5bbc7c828ea2a05f206d010e48d0720b1 | #194; API #195 |
| 5 | Финансовые таблицы, собственное чтение прав, ограничения purchase RPC | 0419b2ec21ec225206e9e0715b8dd24f54c590ff | #196 |
| 6 | Существующая authority-модель для неизменённого id_user профиля, без выдачи прав | f542e5433ca377186f0a9e3d0e89ccbf64d91bc0 | #201 |
| 7 | Подтверждённый admin каталога, приватность личных foods/aliases, запрет bulk recompute | a3386a629a0c6d3e69f5224cdf47c9bbe6db2f85 | #197 |
| 8 | Репетиция переноса pg_trgm в extensions | a1b91d8bfbfba8135478803605512e1014dbafcc | #188 |

SHA относятся к конкретным исходным файлам, не к готовой release-ветке. Не сливать целиком #184 или старые ветки ради SQL. Предварительная клиентская версия должна убрать старый вызов bulk recompute (изолированная правка #197). Остальная account-isolation правка #186 не включена в эту группу и требует отдельной приёмки.

## Что проверяет объединение

Общая синтетическая схема содержит профиль из 17 колонок/трёх owner policies, фото-миграции, финансовую схему, публичные admin RPC/review policies и старый recompute, pg_trgm/GIN. Восемь старых RPC присутствуют; `rls_auto_enable()` — безвредная заглушка. Базовые food/diary таблицы и нормализация синтетические. Вместо упрощённой seeded attestation fixture устанавливается точный кандидат #201 с полным приватным ledger, constraints/triggers, readers и issuer. Он создаёт пустую таблицу, не выдаёт права и не меняет профиль. Положительный admin-сценарий отдельно вызывает настоящий owner-controlled grant, затем revoke; старые флаги не используются как доказательство.

Проверки охватывают совместный ROLLBACK и COMMIT, сохранность исходных строк, конечные effective permissions, приватность authority, точные тела/owner/security/config/return types шести authority/gate функций, обычные profile/finance/photo пути, issued admin и отзыв с теми же claims, ошибочный порядок и поздний сбой с полным откатом, регрессии GRANT и подмену reader, одноразовые source guards. Поздние finance/catalog ограничения намеренно заменяют прежний контракт сохранения authenticated/service grants из anonymous-кандидата: его старый verifier нельзя повторять после новых изменений. Anonymous containment идёт до превращения recompute в всегда запрещающий SECURITY INVOKER; authority идёт после профильной защиты.

Две default TRUNCATE записи другого владельца остаются видимым неустранённым остатком. Legacy finance DTO не синхронизируется с ledger; новые права не доказывают оплату и не закрывают автоматически все старые Premium feature gates. Отдельные real OTP/Auth/PostgREST/actual-service проверки находятся в #195–197 и #201. Их успех не является совместной API/UI-приёмкой всей восьмёрки на полной схеме.

## Повторяемая репетиция на полной копии

Подготовлен `scripts/security/accumulated/restored.mjs --run-restored-local`; подробности в `restored-eight-rehearsal-20261026.md`. Он принимает только исходную папку backup, проверяет три SHA-256, 112 COPY таблиц / 14888 строк и распределение 26 auth / 81 public / 5 storage, локальный Docker endpoint и фиксированный healthy Supabase PG17 контейнер. Он не восстанавливает данные и не принимает hosted URL/проект. Изменения кандидатов всегда ROLLBACK; содержимое всех таблиц из backup проверяется полными отсортированными row hashes до/во время/после, metadata — после отката. Сам runner с psql streaming protocol проверяется на синтетической схеме, включая обнаружение подмены строк при тех же counts.

**На приватной полной копии эта восьмёрка ещё не запускалась.** Более ранняя подтверждённая репетиция четырёх кандидатов и CI на synthetic schema не заменяют этот шаг. Даже успешный restored ROLLBACK не заменяет persistent application acceptance на отдельной копии и проверку приложения. Не публиковать backup/персональные строки/hosted metadata snapshots в GitHub.

## Подготовка выпуска

Совместная bounded real API/UI-проверка восьми кандидатов завершена в #203 (фиксированная синтетическая local Supabase, настоящий Auth/PostgREST и Login/Profile/AuthProvider). Она не заменяет full restored application acceptance. Следующий source review в `legacy-premium-gates-20261026.md` воспроизводит оставшиеся независимые legacy gates; его diagnostic tests фиксируют открытые проблемы, не разрешают релиз. Восемь pinned SQL inputs не изменены.

Последующее узкое клиентское исправление — `premium-client-containment-20261026.md`: verified Premium обязателен вместе с exact feature flag, строгие boolean и повторная account проверка. Исходные diagnostics заменены containment regressions. Серверные mutation gates и raw legacy DTO ещё требуют отдельной работы; клиентский успех не закрывает их и не меняет восемь SQL входов.

Отдельный серверный follow-up paywall и воспроизведённые оставшиеся direct program read/write gaps описаны в `server-premium-paywall-20261026.md`. Paywall candidate не входит в исходную восьмёрку/runner #202; исправление JSON locked не защищает program operations. Финальную группу нужно зафиксировать и проверить отдельно перед выпуском.

Следующий read-only по данным кандидат — `program-explanation-projection-20261026.md`: серверный Free summary/owned verified full response и запрет прямого чтения защищённых explanation колонок. Он создаёт отдельную private projection с public INVOKER facades; исходная восьмёрка не расширяется молча. Program mutation, прочие payloads/callers и client caches остаются отдельными gates.

1. Зафиксировать exact выбранный commit, матрицу входов и CI. Проверить release diff относительно master, клиентскую совместимость, явные GRANT/RLS всех нужных новых объектов и ещё не рассмотренные bootstrap/draft/view/function/sequence случаи из письма Supabase.
2. Проверить read-only drift цели и условия #201: fresh namespaces/predicates, профиль/ownership/RLS/defaults/ACL и API. Existing authority — отдельная adaptation, не слепой reapply. Не переносить старые is_admin/has_premium или finance tier как provenance; administrator list, evidence, expiry, retention/erasure требуют отдельного решения.
3. Сопоставить поздние версии issuer/gate по публичному контракту #200/#201. Не переписывать shared-account binding старым repair. Не устанавливать полный Graph draft ради helper и не активировать генератор.
4. Проверить поддерживаемый managed Supabase путь pg_trgm: ordinary PostgreSQL ownership и supautils hints не являются доказательством или запретом hosted SET SCHEMA. Нативная fixture владеет extension и не моделирует Supabase hooks. Отдельно подтвердить выполнение на подходящей разрешённой Supabase-копии; не повышать роли/членство и не удалять extension. Если понадобится иная граница группы, заново зафиксировать и проверить её, не пропускать восьмой шаг молча.
5. Подтвердить свежий приватный backup, пароль и восстановление; выполнить подготовленный rollback-runner на полной копии, затем отдельную persistent combined и actual API/UI-приёмку с A/B аккаунтами. Staging с другой схемой/отсутствующими legacy RPC не заполнять искусственно для parity. Закрыть остатки default ACL платформенного владельца, legacy source classifications, прочие feature gates и review/monitoring gaps.
6. Подготовить отдельно рассматриваемый forward migration/release с проверками, locks/timeouts, безопасным recovery и мониторингом. Эти review wrappers с ROLLBACK не превращать в Production COMMIT вручную. Издавать/назначать authority только отдельными одобренными действиями; общий installer оставляет store пустым.
7. Получить одобрение владельца на exact Production batch и окно, применить только одобренный пакет, проверить committed состояние отдельным соединением и реальные вход/профиль/фото/Premium/catalog пути, запрет чужого доступа, неизменность истории и отсутствие ошибочного fallback. Зафиксировать результат без пользовательских данных и секретов.

## Остановка и восстановление

При ошибке до COMMIT вся общая транзакция откатывается. При неоднозначном результате COMMIT сначала read-only сверка exact состояния, без слепого повтора. После подтверждённого COMMIT не использовать старые unsafe down scripts: возврат клиентского TRUNCATE, profile/finance writes или старого recompute недопустим как обычный rollback. Отдельно подготовить и проверить безопасный forward repair, совместимую клиентскую версию и аварийный recovery из приватной копии при необходимости. Конкретные команды восстановления зависят от финального release и требуют проверки, здесь их нет.

**Текущий вывод: совместная синтетическая проверка подготовлена; Production release NO-GO до закрытия перечисленных gates.** Ни фейерверк, ни переход к генерации не означают, что эти проверки можно пропустить. После закрытия согласованного этапа следующий рабочий фокус — генерация планов питания, а не платёжный провайдер.
