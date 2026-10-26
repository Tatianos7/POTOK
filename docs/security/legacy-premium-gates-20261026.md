# Оставшиеся Premium gates: проверка исходников 26 октября 2026

Исходная точка: #203, commit `c477a60e84a609ac67becca3a9f87235e50d9bac`.
Это ограниченный source review и воспроизведение поведения настоящих сервисов с синтетическим транспортом. Не hosted audit, не новый SQL-кандидат и не исправление перечисленных находок. Production/Staging, платежи, генератор и пользовательские данные не затрагиваются. Публичные исходники и вымышленные ответы используются вместо приватных snapshots.

## Подтверждённые расхождения

| Путь | Фактическое поведение исходников | Что ещё нужно закрыть |
| --- | --- | --- |
| `EntitlementService.canRealtimePose` → `PoseCoach` | Разрешает по `can_spatial OR can_voice OR tier=pro/vision_pro`. При pro и обоих false результат true. Старый spatial paywall при false возвращает locked. Verified Premium не вызывается. | Один явный контракт spatial/voice; серверная проверка защищаемых операций и согласованный UI. Не считать voice/spatial одним правом автоматически. |
| `canAdaptProgram` → `ProgramGenerationService.adaptProgram`; `canExplain` → delivery/UX | Используют старые flags независимо от нового verified predicate. Можно получить true при verified Premium=false. | Устранить независимую legacy authority, сохранив согласованный Free-контракт и совместимость DTO. Проверить все вызываемые SQL write paths, а не только клиентскую кнопку. |
| Типы legacy DTO | `Boolean('false')` даёт разрешение. Reader возвращает сохранённый JSON flags без преобразования типов. | Явная валидация boolean на доверенной границе. Пример синтетический: наличие такого значения в Production не проверялось. |
| Смена аккаунта во время запроса | getUser проверяется до RPC; завершившийся ответ A после переключения на B ещё может вернуть разрешение A. | Повторная проверка текущей идентичности и отказ от устаревшего результата; интеграционная A→B проверка вызывающего UI. Это не доказательство server cross-account disclosure/DML. |
| Финансовый reader после #196 | Ограничивает чтение своим аккаунтом, но сохраняет прежние tier/flags. Закрытие DML не придаёт старым значениям provenance. | Отдельная классификация и согласованный переход исторических прав. Не backfill из flags/tier и не удалять реальные права без проверки. |

Семь исполняемых diagnostic cases в `scripts/security/legacy-premium/observations.test.mjs` транспилируют **настоящие** `entitlementService.ts` и `adminAccessService.ts` через locked TypeScript. Внешняя зависимость разрешена только одна: отключённый default Supabase client. Auth/RPC responses синтетические; никаких сетевых запросов, баз, покупок или настоящих аккаунтов. Наличие зелёного теста с названием OPEN означает, что **открытая проблема воспроизводится**, а не устранена. При исправлении код/ожидания и этот документ должны меняться вместе; не поддерживать небезопасное поведение ради зелёной проверки.

Проверки отдельно сохраняют границы: явно чужой account уже отклоняется до RPC; ошибка RPC уже выбрасывается; Free `can_view_plan`/fallback true — существующая политика, не установленная платная уязвимость. Название `canGenerateProgram` само по себе не определяет тарифный контракт.

## Что не следует ошибочно объявлять обходом

`profileService.normalizeProfile` принудительно выставляет `has_premium=false`, `is_admin=false` для remote/cache данных. `AuthContext.buildUser` берёт подтверждённые возможности через `AdminAccessService`, который проверяет пользователя до и после RPC. Поэтому старые ветви profile flags в `ProgramDeliveryService.resolveTier` и `ProgramUxRuntimeService.resolveTier` **сейчас не доказывают прямой доступ по raw profile flags**: обычный getProfile эти flags гасит. Обратная сторона — положительное verified право не делает эти legacy resolveTier платными автоматически.

Оба resolveTier также принимают явный override. Он влияет на клиентский tier/представление; это не серверная граница безопасности. Нужен обзор всех callers и серверных действий, а не заявление, что сам override даёт доступ к чужим данным.

`premiumCatalogService` читает таблицы напрямую. В рассматриваемом draft `today-premium-data-model-draft-2026-08-23.sql` SELECT active catalog рассчитан на authenticated; это нельзя переименовать в paid-only или считать утечкой без согласованной классификации каталога/preview. Это source draft, не доказательство применённых hosted policies. Селекторы принадлежат владельцу, PLAN по-прежнему не FACT. Новая paid execution не включается.

## Порядок следующего ограниченного исправления

1. Зафиксировать Free/verified Premium/admin и более узкие spatial/voice возможности. Verified admin не должен автоматически означать оплату или все продуктовые возможности. Не менять Preview/Free на paid по имени функции.
2. Подготовить отдельный совместимый контракт чтения и проверки прав: untrusted legacy значения не разрешают защищённое действие; отсутствие/ошибка проверки закрывают именно защищённое действие. Сохранить обычные Free пути. Не использовать недостоверный DTO как fallback после отказа verified predicate.
3. Проверить source SQL/RLS/SECURITY DEFINER цепочки реальных mutation endpoints и dynamic callers. Клиентский predicate недостаточен. Составить отдельный точный SQL-кандидат после source guards/compatibility review; не переписывать старый #196 задним числом и не добавлять молча девятый шаг в уже проверенную восьмёрку.
4. Проверить actual service + real API: legacy-paid/verified-false deny, verified grant/revoke с тем же JWT, malformed DTO, missing predicate/error, A→B in-flight completion, Free preservation. Проверить UI и сервер независимо.
5. Прогнать финальную группу на полной приватной restored schema и отдельно persistent application acceptance. Нужен Docker-компьютер; Mac не обязателен. Подготовленный #202 rollback runner проверяет только восемь pinned inputs и **этим review не расширяется**.

Настоящая проверка квитанций остаётся #198 после генерации планов питания. Для текущего hardening можно проверять owner-issued синтетические подтверждения без подключения провайдера, выдачи реальных прав или обещания готовых покупок. Provenance исторических прав, issuer admission, retention/account deletion и отзыв — отдельные release gates; данный source review их не закрывает.

## Что можно сделать до вечера без компьютера владельца

Source review, diagnostic CI, подготовка узкого исправления/приёмки и проверка GRANT/RLS цепочек не требуют действий владельца. Полный приватный backup, пароль и данные не загружаются в GitHub или чат. Вечером сначала проверить доступность исходного restored контейнера/backup; затем использовать exact pinned rollback runner #202. Не выполнять вручную COMMIT review-файлов и не применять их в Dashboard.

## Статус допуска

**Legacy Premium gates: OPEN; общий Production release: NO-GO.** Успех #203 подтверждает bounded combined API/UI восьмёрки, не универсальную Premium-защиту и не приёмку полной 112-table копии. Этот документ уточняет конкретные причины ограничения, не расширяет продуктовый этап до реализации платежей или генерации.
