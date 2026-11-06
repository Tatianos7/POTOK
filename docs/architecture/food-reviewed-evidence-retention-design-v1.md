# Phase 2C — проект deletion/retention policy и FK impact

Исходный commit: `1d908f741aa1b158d24f533a7596a5ee9831ef4f`.
Статус: **DESIGN FOR OWNER APPROVAL**, не миграция и не реализованный deletion flow.
Предварительно согласованы immutable history, архивирование shared foods,
physical account deletion с минимальным privacy-safe audit, отсутствие evidence CASCADE.
Shared-food archive guard утверждён только FOR DESIGN. Сохранение исходных actor UUID
через audit-subject anchor NOT APPROVED до анализа идентифицируемости.
Ниже разделены подтверждённый Git-контекст, проект и недостающие решения.

## 1. Подтверждённые операции и пределы анализа

- `src/services/foodService.ts:1280`: `deleteUserFood` удаляет только source=user,
  `created_by_user_id=sessionUserId`. Такие продукты не допускаются в issuance
  shared-root evidence. Если внешний администратор преобразует исторически
  reviewed root в user food, старые FK останутся: такая конверсия тоже нуждается
  в запрете/отдельном согласовании, а не в обещании отсутствия влияния.
- `src/context/AuthContext.tsx:577`: `deleteAccount` выполняет sign-out и очистку
  session state; это **не** physical Auth deletion и не полное удаление offline data.
- `src/pages/Profile.tsx:554`: UI отправляет запрос удаления в поддержку.
  Фактический support/admin deletion runbook вне Git НЕ ПРОВЕРЕН.
- `supabase/foods_schema.sql`: existing aliases CASCADE от foods; created_by
  SET NULL от auth.users. В staging schema draft дневник/favorites используют
  food FK SET NULL, recipe ingredients имеют food FK. Archive сохраняет ссылки,
  тогда как physical DELETE мог бы запустить прежние cascades/nulling.
- `docs/premium/drafts/20260921_trusted_entitlement_v2.sql:58`: ledger уже имеет
  account_id -> auth.users RESTRICT, immutable grant/revoke chain и запрет
  UPDATE/DELETE/TRUNCATE. Profile provenance ссылается на attestations.
- `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql:272`:
  operations.user_id -> auth.users RESTRICT; события/graphs/selections образуют
  дополнительные зависимости. Это Git draft, не доказательство deployed schema.
  `docs/premium/adaptive-nutrition-server-draft-v1.md` оставляет global erasure,
  backup retention и offline queue cleanup OPEN; logout сохраняет историю.
- `scripts/import-food-core.ts:961` допускает `is_searchable` из источника с
  default=true. Один флаг hidden не даёт долговечного архива: последующий upsert
  может вернуть searchable=true. Остальные importer/admin paths также надо
  проверить на согласованном rollout, не молча переписывать сейчас.

Read-only `food_reviewed_evidence_v1_retention_inventory.sql` подготовлен для
инвентаризации фактических FK/RLS/trigger metadata. Его исходный файл НЕ выполнялся;
эквивалентные metadata SELECT через подключённый инструмент выполнены 2026-10-09
в обоих проектах внутри READ ONLY transactions. Рекурсивный
обход ограничен глубиной 32 и исключает повторные вершины; отдельный direct FK
query показывает все edges food-evidence/control, включая циклы. Данные,
payloads и персональные поля не выбираются. Задача не покрывает внешние jobs,
Storage, replicas/backups и не доказывает отсутствие дополнительных live FK.

## 2. Все 16 новых физических FK

Все имеют DELETE RESTRICT и UPDATE NO ACTION. RETIRED/INVALIDATED не снимают FK.

| № | Child/key | Parent/key | Последствие |
|---|---|---|---|
| 1 | canonical_revisions.canonical_food_id | foods.id | Root DELETE запрещён |
| 2 | canonical_revisions.supersedes_revision_id | canonical_revisions.revision_id | Предыдущая revision сохраняется |
| 3 | nutrition_revisions.canonical_food_id | foods.id | Root DELETE запрещён |
| 4 | nutrition_revisions.supersedes_revision_id | nutrition_revisions.revision_id | Nutrition history сохраняется |
| 5 | nutrition_revisions.(canonical_revision_id,digest,food,state) | canonical_revisions.(revision_id,digest,food,state) | Нельзя потерять/перепривязать canonical dependency |
| 6 | review_events.actor_id | auth.users.id | Новый live-account deletion blocker |
| 7 | review_events.source_artifact_id | retained_sources.source_artifact_id | Source bytes/metadata сохраняются |
| 8 | review_events.canonical_food_id | foods.id | Root DELETE запрещён, включая rejected-only history |
| 9 | review_events.(actor_id,authority_attestation_id) | potok_control.access_attestations.(account_id,attestation_id) | История полномочий сохраняется |
| 10 | review_requests.actor_id | auth.users.id | Второй новый live-account blocker |
| 11 | review_requests.event_id | review_events.event_id | Terminal receipt сохраняет event |
| 12 | review_events.(actor_id,idempotency_reference) | review_requests.(actor_id,idempotency_reference) | Deferred cycle сохраняет связь с request |
| 13 | canonical_revisions.review_event_id | review_events.event_id | Deferred approval dependency |
| 14 | nutrition_revisions.review_event_id | review_events.event_id | Deferred approval dependency |
| 15 | current_heads.canonical_food_id | foods.id | Root DELETE запрещён даже projection ссылкой |
| 16 | current_heads.last_event_id | review_events.event_id | Projection не теряет decision history |

Названия таблиц сокращены; фактические имена имеют `_v1` в potok_food_evidence.
В строке 5 `digest` обозначает canonical_revision_digest/canonical digest.
Три deferred FK откладывают проверку INSERT cycle, но не разрешают evidence purge.
target_revision_id события и полиморфные current_heads.revision_id/digest —
**логические**, а не дополнительные физические FK: их exact kind/ID/digest/food
bindings проверяет guarded RPC. Supersession/invalidation ничего не удаляют.

## 3. Shared-food archive — APPROVED FOR DESIGN, применение не разрешено

Сохранять foods.id/canonical_food_id/stable_food_id, aliases, nutrition и diary.
Не вводить вторую food identity; не использовать REVIEW_INVALIDATION как archive.
Архивирование — catalog lifecycle operation, не новый kind Phase 1 event.

Предпочтительный минимальный вариант: private permanent archive marker
`potok_food_evidence.archived_roots_v1` + guarded archive RPC + reviewed trigger
на существующий foods. Это не требует нового foods column, но **меняет foods
write behavior и пишет is_searchable=false**, поэтому сейчас НЕ реализовано.

SQL-ограничения проекта:

1. Минимальный operational marker: PK food_id -> foods.id ON DELETE RESTRICT,
   exact existing stable key UNIQUE, NOT NULL server timestamp и opaque checkpoint
   reference. Личный actor/authority/reason/request receipt — в отдельном закрытом
   bounded audit envelope с ещё не утверждённой privacy policy, не вечные поля marker.
2. ENABLE/FORCE RLS; PUBLIC/anon/authenticated/service_role без прямого доступа;
   UPDATE/DELETE/TRUNCATE marker запрещены. Никакой automatic unarchive/TTL.
3. RPC принимает food ID, explicit key и reason; JWT actor, attestation/time и
   receipt формируются сервером. Не переиспользовать Phase 1 event digest domain.
4. Порядок блокировок: существующий actor/admin gate -> существующий food gate ->
   foods row FOR UPDATE; authority recheck после ожиданий. Сериализовать archive
   с approval/invalidation. Exact retry возвращает прежний terminal result;
   conflicting content не переписывает marker.
5. Одна транзакция проверяет shared root, вставляет marker и устанавливает только
   is_searchable=false. Уже hidden root не равен архиву без marker. Не менять
   needs_review, identity, source/owner, aliases, diary или старые КБЖУ.
6. Foods trigger: запрещать physical DELETE shared core/brand catalog rows
   независимо от наличия evidence/marker; private source=user path сохранить.
   Не позволять вывести shared row в user/private scope для обхода DELETE guard.
   Для marked root также запретить ID/root/stable/source/owner reassignment и
   is_searchable=true. Ошибка fail-closed, не silent coercion.
   Защитить создание marker и сам guard от обычных clients/importers.
   Для чтения закрытого marker нужен reviewed postgres-owned SECURITY DEFINER
   trigger с search_path=pg_catalog, qualified references и без предоставления
   caller прямого доступа к marker. Guard не выполняет дополнительные food writes.
7. Исторические receipts/revisions остаются точными. Новый review/current lookup
   закрывается existing shared-root guard; receipt replay не доказывает current
   usability. Archival не становится safety invalidation и не стирает их историю.
8. Unarchive, если понадобится, требует отдельного versioned lifecycle design;
   не удалять marker для «отката». Проверить client cache/direct-ID/alias paths:
   existing exact resolver исключает is_searchable=false, но это не доказывает
   совместимость всех внешних потребителей.

Это решение нужно согласовать до trigger/RPC/foods изменений. Без guard флаг
is_searchable=false — только временная видимость, а не полноценная archive policy.

Точная предлагаемая marker schema (DESIGN ONLY, не добавлена в SQL draft):

```sql
CREATE TABLE potok_food_evidence.archived_roots_v1 (
  canonical_food_id uuid PRIMARY KEY REFERENCES public.foods(id) ON DELETE RESTRICT,
  food_stable_id text NOT NULL UNIQUE CHECK (length(food_stable_id) > 0),
  archived_at timestamptz NOT NULL,
  archive_checkpoint_reference uuid NOT NULL UNIQUE
);
```

RPC `archive_shared_food_v1(p_request_text text)` — **предложенный**, не существует.
Strict raw request: contract=`potok-food-catalog-archive-request-v1`,
canonicalFoodId, idempotencyReference, reason; unknown/duplicates/missing reject.
Reason проверяется существующим строгим text boundary, без trim/coercion, плюс
UTF-8 length limit. Новый command digest domain:
`potok-food-catalog-archive-request-sha256-v1`, canonical `{domain,payload}`.
Сравнивать digest **и** retained canonical bytes. Same actor/key + exact bytes
возвращает stored receipt; different bytes/key conflict. Если root уже marked
другой командой, вернуть ALREADY_ARCHIVED, не создавать чужой «exact replay».
Receipt фиксирует original actor/authority/time/food/request и имеет отдельный
contract, не выдаётся за FoodEvidenceReviewEventV1. Все enforcement, trigger,
grants и live authority checks обязательны: CREATE TABLE сам по себе их не даёт.
Sketch deliberately omits an unapproved audit-envelope/checkpoint table: opaque
reference needs separately approved integrity binding/FK and retention design.
Stable key matches existing foods value; это snapshot/guard binding, не новая identity.

## 4. Account retention — статус owner decisions и идентифицируемость

**TARGET ARCHITECTURE: physical account deletion с минимальным privacy-safe audit.**
Auth tombstone не является целевым результатом. Audit-subject anchor с исходным
actor UUID **NOT APPROVED**: он не выбран для реализации и не снимает privacy blocker.

Исходный UUID — стабильный join key между event.actorId, request.actor_id,
receipt.event.actor.actorId, authorityReference/attestation account_id, профилем,
логами, exports, резервными копиями и внешними support records. Удаление только
live-account mapping не уничтожает эти связи. Поля reason, evidence_ref, locator,
provider/document identity и source text/binary могут непосредственно назвать
человека. Отсутствие имени в UUID не доказывает анонимность; сам digest тоже может
быть сопоставлен с известным исходным документом. Реальные пользовательские bytes
не выбирались: наличие PII в конкретных записях **NOT VERIFIED**.

Условия, которые нельзя одновременно обещать без нового решения:
1. бесконечно хранить доступные исходные plaintext bytes с actor UUID;
2. обеспечивать полное удаление содержащихся в них персональных данных;
3. оставить прежние digests и полную byte-verifiability без изменений.
Переписывание snapshot или SET NULL внутри hashed payload нарушает контракт.
Перенос FK к registry без удаления идентифицирующих копий решает только SQL blocker.

**Предлагаемое направление на согласование, не реализация:** отдельный versioned
retention/erasure protocol, сохраняющий минимальный неизменяемый checkpoint:
artifact kind/ID/digest, необходимые food/revision bindings, исходный authority
commitment и факт проверенного решения, policy version, purge manifest и доверенное
подтверждение удаления. Не сохранять raw actor UUID, свободный reason, locator,
source bytes или исходный receipt в публичной/minimal проекции. Существующие
artifact IDs/digests тоже оценивать на linkability, не называть checkpoint
анонимным автоматически. Проверяемые минимальные данные и основание их хранения
утверждаются отдельно; нельзя считать один непроверенный hash доказательством authority.

Для исходных персональных envelopes допустим только отдельно согласованный
restricted retention с конечным сроком/правовым исключением, затем auditable erasure.
Новый checkpoint не выдаётся за оригинальный Phase 1 event; он объясняет,
какие исходные bytes больше недоступны и какие integrity assertions остаются.
Криптографическое подтверждение события до удаления и последующей цепочки
переходов сохраняется, но повторный hash удалённых plaintext bytes невозможен.
Если требуется бессрочная полная byte-verifiability, нужна отдельно обоснованная
retention exception, а не обещание полного erasure. До этого протокол **BLOCKED**.

Anchor, encryption/crypto-erasure, redaction certificate, FK repair и изменение
trusted ledger не реализованы. Нельзя применять plaintext purge, отключение
immutable triggers, CASCADE или «обезличивание» задним числом. Не добавлять новый
entitlement ledger и не ослаблять существующий attestation proof chain.

## 5. Предлагаемый общий account deletion lifecycle — DESIGN ONLY

Состояния операции: REQUESTED -> ACCESS_CLOSED -> DATA_CLEANUP ->
AUTH_DELETE_PENDING -> AUTH_DELETED -> RETENTION_PENDING -> COMPLETE.
RETRY_REQUIRED — состояние шага с сохранением закрытого доступа, не возврат ACTIVE.
Это проект operation lifecycle, **не утверждённая audit-subject registry**.

1. Доверенный сервер подтверждает identity и ownership запроса, explicit key и
   exact request digest. Actor/time/authority не берутся из клиентских claims.
   Private closure job имеет ограниченный по сроку target mapping; exact retry
   продолжает ту же операцию, конфликтующее содержимое отвергается. До удаления
   пользователь получает минимальный receipt; он не должен содержать source PII.
2. Закрыть доступ: под согласованными locks admin -> premium выполнить существующие
   trusted revokes и терминальный deny новых grants/review/Adaptive/write операций.
   **Revoke сам по себе не блокирует последующий grant**: нужен отдельно утверждённый
   closure fence, проверяемый всеми writers и после lock wait. Проверить аналогичный
   fence для Main отдельно, без fallback на is_admin. Отозвать Auth sessions и
   возможность refresh/login поддерживаемым Admin API, не SQL-редактированием Auth.
3. Построить manifest всех личных классов: profile, diary/favorites/recipes,
   measurements/photos, exercise/workout/habits/goals, notes/analytics/AI memory,
   support/import/search records, Adaptive operations/events/snapshots/generation
   requests, entitlement ledger, Food payload copies, Storage и offline queues.
   Для полей без FK нужна явная cleanup policy: Auth DELETE их не удаляет.
   Нельзя удалять food catalog/history КБЖУ других пользователей.
4. После утверждения retention protocol обработать личные envelopes и immutable
   зависимости с проверяемым checkpoint/manifest. Не менять FK только в Food:
   deployed Staging содержит ещё семь прямых auth.users RESTRICT blockers.
   Adaptive cyclic graph и immutable guards требуют собственного согласованного
   retirement/retention protocol, не произвольного порядка DELETE.
5. Удалить Storage blobs **через поддерживаемый Storage API** с bounded retries;
   SQL DELETE metadata не является удалением объекта. Отдельно обработать CDN,
   derivatives, external systems и exports; не доверять одному bucket owner FK.
   Offline devices получают purge/tombstone при следующем контакте и запрет
   повторной синхронизации retired account. Удалённое стирание недоступного
   устройства невозможно подтвердить: это отдельный residual-risk статус.
6. Только после устранения всех проверенных FK/trigger blockers физически удалить
   Auth пользователя поддерживаемым Admin API. Сохранить минимальный retry receipt
   на случай сбоя ответа; отсутствие Auth row не доказывает завершение erasure.
   Не применять CASCADE к evidence. Историческая потеря прав reviewer сама по себе
   не является invalidation его food decision.
7. Проверить online cleanup и расписать истечение backups/logs/replicas/legal holds.
   AUTH_DELETED отличать от COMPLETE; остатки имеют конечный срок и статус.
   Отдельный минимальный closure checkpoint и bounded deny mechanism должны
   исключать повторное присоединение истории при восстановлении прежнего UUID;
   его идентификаторы/сроки тоже проходят privacy approval, не бессрочный raw-UUID anchor.
   Незавершённый шаг не восстанавливает права и не объявляет deletion PASS.

Все изменения account deletion flow, Auth orchestration, entitlement readers/
writers, Adaptive schema и archive trigger требуют отдельного owner approval.
В текущем commit добавляются только дизайн, metadata-query и baseline test preparation.

## 6. Privacy и retention: обязательные решения, не скрытые guarantees

- actor UUID/link removal даёт pseudonymization, не полную anonymization.
  Retained text/bytes, provider/document/locator, rejection/invalidation reason,
  proposal bytes и trusted evidence_ref/reason могут содержать PII, даже если
  profile/identity удалены. Phase 1 не доказывает отсутствие PII.
- Изменять эти immutable bytes после issuance нельзя без изменения digests и
  потери exact audit integrity. Hash не стирает исходный текст. CASCADE/trigger
  disable и задним числом «новый anonymized digest» не являются решением.
- Для сохранённого audit класса нужны цель/правовое основание, минимизация до
  issuance, ограниченный read access и утверждённые сроки/исключения. Срок не
  выбран произвольно. До этого нельзя обещать полное erasure/free-text privacy.
- Если требуется удалить PII внутри immutable sources, нужен отдельно утверждённый
  retention/redaction/crypto-erasure contract с явным ограничением исторической
  byte-verifiability; это нельзя совместить с обещанием неизменности и доступности
  тех же plaintext bytes. Здесь такой механизм не реализован.
- Требуются сроки и процедура для mapping/support tickets, Auth identities,
  logs/backups/replicas/exports и offline stores. Отсутствие server row не доказывает
  cleanup offline устройств. Immutable не означает автоматически законное вечное
  хранение любых личных данных.

## 7. Acceptance suite и следующий шаг

Расширен существующий disposable runner: проверяет все 16 FK, четыре food и два
Auth blockers, три deferred dependencies, отказ root DELETE и conservation;
existing hidden-root guard отдельно проверяется без выдачи его за archive RPC.
Отдельный fixture-only сценарий проверяет existing entitlement FK blocker после
удаления synthetic session/profile внутри откатываемой transaction.
Эти сценарии относятся к текущему baseline, НЕ доказывают новый deletion lifecycle.

В разрешённой Linux/macOS среде: non-root user, Node 24, зависимости проекта,
PostgreSQL 17+ с pgcrypto; initdb/pg_ctl/psql одной установки доступны на PATH.
Runner сам создаёт Unix-socket-only cluster; внешние PG URLs/credentials не нужны.

```sh
POTOK_FOOD_EVIDENCE_REQUIRE_DB=1 node --import tsx --test --test-isolation=none \
  scripts/contracts/food-evidence-disposable-db-v1.test.ts
```

REQUIRE_DB mode **FAIL**, а не SKIP, если инфраструктура отсутствует. Это защита
acceptance gate, не подтверждение PostgreSQL выполнения. Обычный local mode
явно SKIP/NOT VERIFIED. В текущей Cloud-среде DB assertions НЕ ИСПОЛНЕНЫ.

После отдельного lifecycle/retention approval добавить реальные тесты: race review/archive,
importer resurrection denial, unchanged historical hashes, private-food deletion,
original-key archive/closure retries, issuance/grant vs retirement race, stale JWT,
session cleanup failure, partial Auth deletion retry, terminal subject reuse deny,
physical Auth delete without evidence loss, and existing Adaptive/diary lifecycle.
Не заменять несуществующий registry/closure RPC mocks и не объявлять privacy erasure PASS.

**Блокеры:** выбор privacy-safe retention/erasure protocol без неутверждённого anchor;
approval foods guard/archive writes; trusted-entitlement repair и global Adaptive lifecycle;
privacy/retention сроки и PII exception;
реальный PostgreSQL acceptance и Auth cleanup verification.
Следующий безопасный шаг: согласовать эти конкретные изменения, получить read-only
additional external deletion/runbook inventory и запустить baseline suite.
Текущие migrations, foods/account flows, trusted ledger и runtime НЕ изменены.

## 8. Deployed metadata inventory — FACT, 2026-10-09

Источник: подключённый Supabase инструмент, проекты POTOK Staging
`ozidryfvhkcbtpnulakq` и POTOK Main `dtsdnhbcwpbfrhcazqkb`.
Выполнены только pg_catalog/information_schema SELECT в BEGIN READ ONLY.
Ни пользовательских записей/счётчиков, ни Storage objects, ни source bytes,
ни secrets/function bodies не выбиралось. Ни миграций, ни RPC calls.
Snapshots — состояние каталогов на момент запроса, не transactional business tests.

| Metadata scope | Staging | Main |
|---|---:|---:|
| FK всего вне pg_catalog/information_schema | 109 | 117 |
| Таблицы в public/control/nutrition/food-evidence/storage | 57 | 89 |
| RLS policies в этих schema | 97 | 194 |
| non-internal triggers в этих schema плюс auth | 44 | 34 |
| Function signatures/ACL в public/control/nutrition/food-evidence | 88 | 65 |
| Прямые RESTRICT FK к auth.users | 7 | 0 |

Food Evidence tables отсутствуют в обоих перечисленных catalog snapshots;
Phase 2B draft не применялся. Staging: существующий trusted ledger и nutrition
private tables ENABLE/FORCE RLS, ledger без RLS policies и без client grants
в просмотренном role_table_grants. Grant/revoke/is_effective functions: postgres-only
EXECUTE, SECURITY DEFINER, search_path=pg_catalog. Это metadata факт, не доказательство
правильности всех function bodies, role memberships или реального Auth Admin workflow.
Main: potok_control/potok_nutrition tables в snapshot отсутствуют. Profile: Staging
user_id/admin_provenance_id/admin_valid_until; Main id_user/is_admin без этих
provenance полей. Main остаётся fail-closed для Food issuance, не получает fallback.

Все 57/89 просмотренных таблиц имеют ENABLE RLS. FORCE неодинаков:
Staging foods/profile/diary не FORCE, Adaptive events/graph/operations FORCE;
Main foods/profile/diary FORCE. FORCE не защищает от суперпользователя/BYPASSRLS.
RLS не заменяет guards для привилегированного importer/administrative writer.
Оба foods имеют только search-vector/update-timestamp пользовательские triggers;
shared archive guard в metadata не найден. Staging foods admin UPDATE/INSERT
policies проверяют legacy is_admin; новая archive/review authority не должна
повторно использовать эту policy как самостоятельную trusted аттестацию.
Main foods DELETE policy проверяет created_by_user_id=auth.uid(), без source=user
ограничения. Неизвестно, существуют ли shared rows с owner: записи не выбирались.
Архивный guard должен закрыть этот путь независимо от owner и policy.

Staging: access_attestations DELETE/UPDATE/TRUNCATE immutable triggers; profile
entitlement guard BEFORE INSERT/DELETE/UPDATE. Adaptive graph/events/snapshots/
goal targets immutable, operations/generation requests delete/truncate guards;
selection/diary protection triggers тоже включают DELETE. Даже существующий
CASCADE к plan selections не является гарантией разрешённого удаления: RESTRICT
cycle и triggers могут остановить весь statement. Полные бизнес-ветви этих
functions не исполнялись и не объявляются verified.

В просмотренных function signatures ни account-delete/closure/erasure/archive RPC,
ни пользовательских auth triggers не обнаружено. Это не покрывает Edge Functions,
GoTrue Admin API, support scripts вне Git или внешний operator runbook.
Keyword classification тела функции — только поиск, не доказательство отсутствия
косвенного/dynamic DELETE. В Git deleteAccount — signOut, UI обращается в поддержку.

### Прямые account blockers Staging

- `potok_nutrition.adaptive_nutrition_goal_targets_v1`: `adaptive_nutrition_goal_targets_v1_account_id_fkey`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `potok_nutrition.nutrition_preference_snapshots_v1`: `nutrition_preference_snapshots_v1_account_id_fkey`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `potok_control.access_attestations`: `access_attestations_account_fk`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `potok_nutrition.nutrition_safety_snapshots_v1`: `nutrition_safety_snapshots_v1_account_id_fkey`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `potok_nutrition.nutrition_authority_heads_v1`: `nutrition_authority_heads_v1_account_id_fkey`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `public.adaptive_nutrition_operations`: `adaptive_nutrition_operations_user_fk`, FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT.
- `potok_nutrition.adaptive_nutrition_generation_requests_v2`: `adaptive_nutrition_generation_requests_v2_account_id_fkey`, FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT.

### Поля идентичности без соответствующего FK

Здесь подтверждается отсутствие FK по названию конкретного столбца в catalog,
а не отсутствие персональных данных или скрытых application bindings.

staging: `recipes.user_id`, `favorite_products.user_id`, `workout_entries.deleted_by_user_id`.

main: `user_measurements.user_id`, `recipes.user_id`, `favorite_products.user_id`, `food_diary_entries.user_id`, `habits.user_id`, `user_goals.user_id`, `habit_logs.user_id`, `meal_entry_notes.user_id`, `analytics_events.user_id`, `user_profiles.id_user`, `exercises.created_by_user_id`, `workout_entries.deleted_by_user_id`, `workout_days.user_id`, `measurement_photo_assets.user_id`, `measurement_history.user_id`, `measurement_photo_history.user_id`.

Auth DELETE не гарантирует очистку этих полей. Main profile.id_user/diary.user_id,
measurement/photo rows и Staging recipes/favorites требуют явного согласованного
cleanup; нельзя делать вывод «нет RESTRICT — нет препятствий erasure».

### FK зависимости от foods


staging:

- `public.foods`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.food_aliases`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE CASCADE.
- `public.food_diary_entries`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.recipe_ingredients`: FOREIGN KEY (food_id) REFERENCES foods(id).
- `public.favorite_products`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.

main:

- `public.foods`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.food_aliases`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE CASCADE.
- `public.food_diary_entries`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.recipe_ingredients`: FOREIGN KEY (food_id) REFERENCES foods(id).
- `public.favorite_products`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id).
- `public.food_search_events`: FOREIGN KEY (selected_canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.food_search_review_queue`: FOREIGN KEY (suggested_canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.food_alias_apply_audit`: FOREIGN KEY (canonical_food_id) REFERENCES foods(id) ON DELETE SET NULL.
- `public.food_missing_food_drafts`: FOREIGN KEY (applied_food_id) REFERENCES foods(id) ON DELETE SET NULL.

Archive вместо DELETE сохраняет aliases, diary canonical links, recipe ingredients
и audit references. Main favorite_products/recipe_ingredients default NO ACTION
могут блокировать physical DELETE; их нельзя автоматически заменить на CASCADE.

## 9. Privacy data inventory и проект сроков

Это inventory **полей/копий**, не чтение содержимого production.
PII classification — риск, конкретное наличие PII NOT VERIFIED.

| Класс / копии | Linkability / риск | Предлагаемое действие, только после approval | Configurable срок |
|---|---|---|---|
| Food revisions snapshot + canonical_bytes | food identity обычно shared; reviewEventId связывает reviewer history; identity free text может содержать PII | Сохранять неперсональную food history; классифицировать free text и links; не переписывать hash | nonpersonal_history_retention, legal_hold_review |
| retained_sources.snapshot + source_bytes | UTF-8/binary, provider/document, locator, capture time, mapping: names, personal document, signed URL/token | Минимизировать до issuance; restricted raw retention; approved auditable erasure для PII, не скрытая mutation | raw_source_retention_max |
| review_events snapshot + canonical_bytes + actor_id | UUID/authorityReference, decision times, reasons, nested retainedSource; удаление source table не очищает event | Restricted original envelope; минимальный проверяемый checkpoint без raw identity; источник authority proof сохраняется в утверждённой форме | raw_event_retention_max, minimal_audit_retention |
| review_requests canonical_request/proposal_bytes/receipt | Оригинальные предложения, reasons/sources и receipt с event/revisions; дублирует payload | Idempotency на закрытом finite окне; purge всех copies по одному manifest, receipt не обход retention | idempotency_window, raw_receipt_retention_max |
| current_heads | Food/revision/event IDs, usability projection | Сохранять food state; не выдавать receipt как current authority; минимизировать внешнюю выдачу | nonpersonal_history_retention |
| trusted ledger | account_id, previous_attestation_id, evidence_ref/reason, operator_db_role, точное время | Grant/revoke proof chain сохранить проверяемым; linkability assessment и отдельный immutable retention protocol; не UPDATE reason/account_id | entitlement_raw_retention_max, minimal_authority_audit_retention |
| Adaptive operations/events/graphs/private snapshots/requests | account UUID, preference/safety/goal data, request/receipt copies; включая sensitive health inferences | Собственный retirement/erasure contract для всех cyclic/immutable зависимостей; не только Food FK repair | adaptive_personal_retention_max |
| Profile/diary/measurements/habits/workouts/notes/AI/search/support/import records | Прямая identity/health/free text; часть без FK | Удалять личные данные после ownership/retention checks; shared catalog/чужие данные не удалять | cleanup_sla, legal_hold_review |
| Storage objects/CDN/thumbs | Фотографии/paths/owner; no automatic Auth FK cleanup для bytes | Supported Storage API cleanup + retry manifest + проверка derivatives; metadata delete недостаточно | storage_cleanup_sla, cache_expiry |
| closure mappings/support/export logs | Связывает новый audit с прежним account | Bounded restricted mapping; удалить после reconciliation/legal hold, не вечный UUID anchor | mapping_ttl, retry_grace, support_retention |
| backups/replicas/logs/offline queues | Сохраняют старые UUID и plaintext вне online tables | Утверждённая expiry/restore deny policy, device purge при контакте; отдельно NOT VERIFIED | backup_retention_max, offline_reconnect_window |

Числовые сроки не выбраны произвольно: нужны owner/privacy/legal purpose и основания.
Все параметры должны быть explicit versioned policy, без default infinite retention;
exceptions/legal holds с владельцем, сроком пересмотра и минимальным scope.
До approval действует BLOCKED gate, не автоматический cleanup. mapping_ttl должен
покрывать approved retry/reconciliation window, но иметь конечный предел.
Expiry idempotency receipt не допускает переиспользования UUID/key в новой выдаче:
нужен минимизированный duplicate-deny mechanism со своей privacy оценкой.
Personal-data erasure включает все embedded copies, а не только retained_sources.

Crypto-erasure не считается реализованным: нет утверждённой KMS/envelope schema.
Subject-scoped key нельзя без анализа разрушать для source, используемого несколькими
reviewers/revisions; retention classification и dependency manifest обязательны.
Исходные actor UUID не сохраняются бессрочно по умолчанию в proposed archive receipt.
Минимальный operational marker хранит food/stable key/time/checkpoint reference,
а личный audit отделяется под утверждённую bounded policy. Даже opaque reference
оценивать на linkability. Receipt/schema sketch **не final implementation approval**.

### Известные non-DB paths из Git

AuthContext.deleteAccount только signOut/clearSessionState; Profile UI support flow.
Storage constants: measurements-photos (measurementsService), recipe-photos
(recipeImagesService), user-exercise-media (userExerciseMediaService). Наличие
реальных buckets/objects и их cleanup/backup configuration не проверялось.
Profile local keys: profile_cache_v1, profile_pending_v1,
profile_privilege_quarantine_v1, potok_user_avatar, coach/voice settings.
Measurements: potok_measurements, potok_measurement_history,
potok_photo_local_tombstones, potok_photo_legacy_cleanup; goal/workout/food/recipe
services имеют account-suffixed caches, supportService — локальные сообщения.
Полный device-key manifest/IndexedDB/cache-service-worker inventory и внешние
Auth/support deletion процедуры **NOT VERIFIED**; logout не доказательство удаления.

## 10. Archive guard: дополнительные bypass/race требования

- Durable marker + fail-closed foods UPDATE/DELETE trigger проверяет **OLD** shared
  identity и marker, а не только NEW.source: shared->user->DELETE недопустим.
- Importer upsert может вернуть searchable=true: trigger отвергает entire statement,
  без silent override. Importer должен отличать ARCHIVED_ROOT и не retry-ить
  обновление как transient error. Изменение importer требует отдельного согласования.
- Запрет privileged ordinary writer удалить marker, DROP/disable guard, TRUNCATE
  foods или перезаписать snapshot. RLS/FORCE не заменяет отдельный TRUNCATE guard/
  revoke TRUNCATE. TRUNCATE foods при пустой evidence table тоже должен fail-closed.
- DELETE+INSERT прежнего ID/stable key не допустим; permanent marker никогда не
  удаляется автоматически. Новая row с тем же stable key также не должна обходить
  archive: marker/registry должен связывать existing stable_food_id и закрывать
  re-creation до separately approved unarchive, без второй food identity.
- Сериализация INSERT/UPDATE/DELETE/importer/approval/archive: одинаковый порядок
  existing food advisory gate -> row lock; trigger gate при обычном UPDATE получает
  row lock прежде gate и может создать deadlock. Поэтому future design обязан
  решить этот lock-order conflict: либо pre-lock всех writer paths, либо authority
  RPC row-lock-first с общим порядком и проверенным retry. Не выдавать sketch
  actor->food->row за proof работы с неаудированным importer. Acceptance races mandatory.
- Одновременно archive и approval: ровно один serial order; выдача после archive
  запрещена, prior event неизменён. Другой request не получает чужой exact receipt.
- Current read/resolve by ID, alias, cache и importer search paths тестировать
  отдельно: текущие SELECT policies **не фильтруют is_searchable** в обоих проектах.
  Archive не обещает отсутствие raw row visibility и не становится INVALIDATION.
  Нужна явная catalog-usability rule для всех consumers, без изменения diary.
- postgres/service-role BYPASSRLS и schema owner могут обойти permissions/DDL:
  это operational trusted boundary; ограниченные keys, change control и мониторинг,
  не утверждение невозможности обхода database owner.

## 11. Точные решения для следующего owner approval

1. Модель original evidence retention vs auditable erasure/checkpoint: допустимые
   authority/integrity proofs после удаления bytes, цели/правовые exceptions.
   Anchor с исходным UUID НЕ принят; отдельное решение только после privacy оценки.
2. Numeric retention policy по всем классам раздела 9, legal holds, доступ и backup
   expiry/restore reconciliation; конечный mapping/duplicate-deny protocol.
3. Global account closure fence, поддерживаемый Auth Admin deletion и external saga;
   изменение действующего support/account flow и trusted writers/readers в Staging.
4. Отдельный Adaptive retirement design: семь deployed account FK blockers,
   immutable triggers/cyclic selections/graphs/diary projections и health payloads.
   Нельзя применить один Food-only migration как account deletion fix.
5. Archive guard implementation scope: foods trigger/TRUNCATE guard, stable-key
   re-creation deny, все importer/admin write paths и lock order; markers с
   минимизированным audit вместо бессрочных UUID/free-text copies.
6. Main отдельный fail-closed rollout/preflight: без legacy is_admin entitlement
   fallback; существующие Main admin RPC не изменяются этим дизайном.
7. Разрешённая disposable PostgreSQL 17+ среда и будущие real Auth/Storage staging
   acceptance tests. Дизайн не равен пройденным enforcement/erasure tests.

## 12. Проверки этого design/preparation commit

Targeted Phase 1 + server tests: 29 PASS; disposable DB 1 SKIP/NOT VERIFIED
(initdb/pg_ctl/psql отсутствуют). REQUIRE_DB mode ожидаемо FAIL на precondition,
не PostgreSQL acceptance PASS. Targeted runner strict TypeScript/ESLint и
совместный git diff --check проверяются до commit. Lifecycle код не добавлен;
SQL inventory — только системные каталоги, BEGIN READ ONLY / ROLLBACK.
