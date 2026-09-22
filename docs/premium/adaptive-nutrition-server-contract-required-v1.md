# Adaptive Nutrition — required server contract / evidence v1

2026-09-20 · baseline `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`.
**REQUIRED CONTRACT, NOT DEPLOYED SCHEMA. Real persistence remains OFF.**
Документ определяет требования к будущему production contract, а не наличие
endpoint/table/RPC. Сейчас использованы только локальные источники; staging и
production не проверялись. SQL, CLI, network/DB writes не выполнялись.

Последующая evidence: owner-run staging export от 2026-09-20 локально сопоставлен
с требованиями в [factual gap analysis / minimal design](adaptive-nutrition-staging-gap-analysis-v1.md).
Ниже сохранён исходный requirements baseline; строки NEEDS_DEPLOYED_VERIFICATION
нужно читать вместе с новым отчётом. Повтор этого export не требуется. Metadata
не заменяет отсутствующий mutation/read/lookup protocol и behavioral evidence.

## Локально подтверждённые источники

| Ref | Evidence и точная граница |
| --- | --- |
| R1 | [premiumCatalogService.ts](../../src/services/premiumCatalogService.ts), interfaces с line 21, reads с 344: catalog plan/day/slot/recipe IDs, `day_number`, `updated_at`. Это read-only каталог, не versioned account execution graph. |
| R2 | [Premium model draft](../../supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql), с 396: `user_premium_plan_selections` содержит user/goal/catalog-plan, nullable start date; meal selection с 446 содержит slot/recipe. Нет требуемых revision/timezone/snapshot/operation guarantees. Draft не подтверждает deployment. |
| R3 | [goalService.ts](../../src/services/goalService.ts), 5/112/270: UserGoal, чтение по user, upsert и local fallback; `updated_at` не является CAS goal revision. |
| R4 | [diaryCreateService.ts](../../src/services/diaryCreateService.ts), 245, и [mealService.ts](../../src/services/mealService.ts), 281: scope check, nutrition snapshot, lookup user+key, payload mismatch и unique-race replay для diary row. Это client orchestration отдельных запросов, не adaptive transaction/operation ledger. [Исторический index](../../supabase/food_diary_idempotency.sql) — partial unique user+key, не deployed proof. |
| R5 | [mealService.ts](../../src/services/mealService.ts), 1213/1367: legacy delete/update diary paths; [recipeDiaryService.ts](../../src/services/recipeDiaryService.ts), 25: отдельный recipe snapshot flow. Они не доказывают append-only supersession или связь с подтверждённой plan revision. Не переиспользовать автоматически. |
| R6 | [entitlementService.ts](../../src/services/entitlementService.ts), 14/33/45: client auth scoping и RPC names `get_entitlements`/`get_paywall_state`. [Исторический SQL](../../supabase/phase7_3_2_monetization.sql), 60/77: owner ALL policy и SECURITY DEFINER с caller user ID; это повод проверить deployed protection, не доказательство exploit/защиты. Payment integration вне задачи. |
| R7 | [Recipe checkpoint](../../reports/recipe-resolver-safety-checkpoint-2026-09-19.md), sections atomicity/parked attempt: существующий ingredient RPC source не покрывает весь adaptive PLAN/FACT transaction. CLI metadata attempt вернул HTTP 544 после login-role initialization; metadata не получена, отсутствие side effects не доказано. |
| R8 | [Исторический staging apply report](../../reports/today-premium-data-model-staging-apply-retry-2026-08-25.md) и [diary schema report](../../reports/food-diary-snapshot-schema-contract-audit.md) описывают прежние observations. Ни один не подтверждает текущий deployed Adaptive Nutrition contract. |
| R9 | [Domain contract](plan-fact-persistence-domain-v1.md), [types](../../src/types/nutritionPersistence.ts), [recovery](../../src/utils/nutritionRecovery.ts): проверенная локальная симуляция, transport OFF. Не server evidence. |

## Минимальные обязательные гарантии

**1. Authoritative plan identity.** Authenticated `account/user_id`, account-owned
`plan_id`, `plan_revision`, `goal_revision`, local Monday `week_anchor`, IANA
`timezone`, active/provisional status. Определить связь execution instance с catalog
plan/selection: catalog UUID сам по себе не идентифицирует персональный план.
Смена timezone/week/goal имеет явную revision policy; next week не активируется сама.

**2. Dated meal identity.** В рамках instance: local date + stable slot ID,
recipe ID + immutable recipe revision, portion revision и composition snapshot
revision. Snapshot фиксирует foods/units/state/amounts, servings и nutrition
для точной порции; unknown nutrients не заменяются нулями. Одна revision не может
обозначать разные данные. Catalog slot/day number не заменяет dated execution slot.

**3. Atomic request.** Versioned payload: ожидаемые plan/goal/snapshot/portion
revisions, dated slot при необходимости, action, `idempotency_key`, explicit
confirmation и точный actual food/portion payload для MODIFIED/EXTRA. AS_PLANNED
ссылается на точный подтверждённый snapshot, который сервер разрешает и проверяет;
client totals не являются источником authority. SKIPPED не содержит consumed
payload; REPLACE содержит проверенную целевую recipe/portion snapshot identity.
Edit/undo указывает текущий authoritative event/revision, который supersede/retract.
Client account field — только assertion; server actor определяется auth context.
Ни `localSequence`, ни локальный fingerprint не становятся server CAS/signature.

**4. Atomic response / receipt.** Versioned envelope: server `operation_id` /
receipt identity, authenticated account scope, исходные key + canonical request
digest, action, terminal outcome/reason и authoritative result references:
plan/goal revisions, affected dated slots/snapshot identities, fact event IDs и
`diary/history_revision`, когда изменился FACT. Имена полей здесь conceptual, не
предложение создать таблицы. Receipt доступен повторно после потери ответа.

| Outcome | Обязательная семантика |
| --- | --- |
| accepted | Доменный effect и durable result receipt уже committed вместе. Это не «запрос поставлен в очередь». |
| conflict | Новый effect не committed из-за stale/concurrent revision или другого payload под тем же key; structured reason, безопасные current revision refs только своему actor. |
| rejected | Доказанный terminal отказ без domain effect: invalid payload, forbidden action и т.п.; не выдавать чужие IDs. Указать replay/retention policy результата. |
| unknown | Transport timeout, processing/unresolved lookup или недостаток evidence. Не accepted и не rejected; HTTP error сам по себе не доказывает rollback. |

**5. Read-only idempotency lookup.** Отдельная операция lookup по authenticated
account + исходному key возвращает тот же receipt/digest/outcome/result references,
либо processing/unknown. Она не создаёт новое действие. Сервер определяет key
namespace, canonical payload encoding/digest version, durable uniqueness и retention.
Тот же key+payload replay возвращает старый outcome; другой payload конфликтует.
Проверка уже принятого exact replay предшествует новому CAS: retry после accepted
не должен стать новой записью или ложным stale отказом. `not_found`/истёкшая retention
без гарантии отсутствия in-flight/committed операции остаются UNKNOWN.

**6. Timeout recovery.** Клиент сохраняет исходный key/payload, затем получает
authenticated lookup результата или делает разрешённый exact replay того же запроса.
Новый graph, похожие calories или `updated_at` не доказывают commit. Для старой недели,
timezone, account return и reload нужен lookup вне ограничения «только active week».
До подтверждения результата новый key того же действия запрещён. Период хранения и
процедура при недоступном/утраченном ledger требуют явного server решения, не догадки.

**7. Concurrency.** Compare-and-swap expected revisions и изменение выполняются
в одной transaction/эквивалентной доказанной atomic boundary. Для двух разных keys
с одинаковой expected revision один effect succeeds, другой conflicts. Для одного
key+payload — один effect и replay одного receipt. Проверить rollback при ошибке
любого snapshot/trigger/history шага; client pre-read не является CAS.

**8. History.** Authoritative immutable event IDs/revisions, source operation,
plan/snapshot provenance, supersedes/retracts links и current effective projection.
Edit/undo создаёт новый event; старые факты сохраняются. Нельзя подставить simulation
eventId вместо server ID или направить undo в legacy delete/update. Определить
конфликт двух edits, права исторического чтения и retention без молчаливого удаления.

**9. PLAN/FACT transaction matrix.** В каждой строке effect, revision advancement,
history links и durable idempotency outcome/receipt должны commit либо rollback
совместно. При отказе не остаётся частичного domain effect.

| Action | Одна atomic boundary | Что не изменяется автоматически |
| --- | --- | --- |
| AS_PLANNED / MODIFIED | Все actual component snapshots + fact event + diary revision + execution annotation/link, если такая проекция существует, + receipt | Recipe catalog, будущий рацион |
| EXTRA_FOOD | Полный отдельный fact snapshot/event + diary revision + receipt | Последующие meals/days и Goal |
| SKIPPED / undo skip | Plan execution annotation + annotation/history revision + receipt | Нет consumed diary row, даже zero-calorie |
| REPLACE / restore plan slot | Полная замена выбранного recipe/portion graph + plan revision + replacement history + receipt | Нет consumed fact; ранее съеденные snapshots неизменны |
| EDIT / UNDO FACT | Supersession/retraction event + effective-view revision + receipt | Исходные факты не удаляются |

Shopping вычисляется из одной подтверждённой graph revision. Если backend имеет
materialized projection, нужны согласованный revision barrier или явный not-ready;
смешивать старую shopping composition с новым планом нельзя. Схема projection не
фиксируется. Goal/adaptation — только отдельное explicit confirmation и reviewed
policy; новый nutrition calculation/threshold здесь не вводится.

**10. Account / Premium enforcement.** Server независимо проверяет auth actor,
ownership всех связанных plan/slot/snapshot/history refs и authoritative Premium
право новой mutation. Client не выбирает другого user и не выдаёт себе Premium.
Нужны фактические grants/RLS, privileged-field protections и function security
context/dependencies. Поведение lookup/exact replay ранее принятой операции после
истечения Premium определить явно: recovery не должен создавать новый paid effect.
Purchase/payment integration не нужна для этого evidence package и не выполняется.

**11. Read-model freshness.** Read возвращает account/instance/week/timezone/status,
plan/goal revisions, полный согласованный dated graph + recipe/portion snapshots,
coverage/consistency information; для FACT — authoritative event/history projection
и diary revision. Сам план может не измениться после consumption: только plan revision
недостаточно. Pagination/filters не должны выдавать частичный graph за complete.
Минимум — read exact result revision из accepted receipt. Если она уже superseded,
нужно server-proven successor/causal barrier в том же scope, включая связь с исходной
operation; его формат, порядок/epoch и read consistency должны быть документированы.
Local request generation, wall clock и сравнение opaque strings этого не доказывают.
До evidence клиент fail closed. Текущий adapter поддерживает только ограниченную
симуляцию accepted/conflict/unknown + exact graph reconciliation; rejected DTO,
authoritative diary revision и successor proof потребуют отдельного mapping после
верификации, а не автоматического подключения существующих типов к endpoint.

## 12. Exact missing evidence

«Не найдено» относится к проверенным R1–R9, не утверждает отсутствие в deployed DB.
BLOCKS_IMPLEMENTATION означает подключение реального server port; документация и
локальная симуляция от этого не становятся недействительными.

| REQUIRED | FOUND_IN_REPO | NEEDS_DEPLOYED_VERIFICATION | BLOCKS_IMPLEMENTATION |
| --- | --- | --- | --- |
| Account plan instance, week/timezone, plan/goal CAS revisions | R1–R3: catalog/selection/goal, nullable start; R9: domain-only revisions | Current assignment schema/API, authoritative revision semantics | YES: plan binding |
| Dated slots, immutable recipe/portion snapshots | R1/R2: catalog day/slot/options; R4: diary nutrient snapshot | Snapshot identity/storage/units/precision, ownership/FK/immutability | YES: exact FACT/replace |
| Atomic action endpoint + complete request validation | R4: individual diary insert; R7: narrower recipe RPC source | Deployed signatures/implementation/dependencies and transaction boundary | YES: mutations |
| Durable accepted/conflict/rejected receipt + unknown semantics | R9 synthetic outcomes only | Operation identity, request digest, result references, rollback/replay rules | YES: outcomes |
| Account+key outcome lookup | R4 row lookup/index source, not an operation ledger | Read-only lookup API, durable uniqueness, in-flight/not-found/retention semantics | YES: timeout recovery |
| Atomic CAS / concurrent retry behavior | R9 tests, not deployed behavior | Server implementation plus existing approved race/rollback test evidence | YES: no lost updates |
| Append-only event history / undo | R5 has legacy delete/update; R9 simulation | Event/revision/link contract, effective projection, retention enforcement | YES: edit/undo |
| PLAN/FACT atomicity including receipt | No end-to-end server proof in R1–R9 | Matrix above; triggers/function dependency graph; existing rollback evidence | YES: half-write prevention |
| Authoritative account + Premium protection | R6 client checks and concerning historical policies | Actual RLS/grants/RPC auth checks, entitlement authority, approved actor-test evidence | YES: secure mutations |
| Fresh graph + diary reads / successor proof | R1 reads without such protocol; R9 local guards | Consistent exact-revision read, diary revisions, causal/successor guarantee | YES: server freshness |
| Deployment provenance | R8 old reports; R7 failed metadata attempt | Project/environment, export time, deployed build/migration IDs, artifact hashes | YES: using evidence as current |

## Самый безопасный следующий evidence шаг

**Рекомендуется A: owner-exported package.** Передать существующий обезличенный
metadata/API export, полученный владельцем из доверенного источника. Минимальный
набор ниже; если артефакт отражает только repository design, обозначить это явно.
Это позволяет продолжить локальную проверку без подключения агента к staging.

**B: Supabase Dashboard, manual read-only export владельцем.** Проверить staging
project `ozidryfvhkcbtpnulakq` и экспортировать доступные table/function/policy
definitions через уже открытый защищённый Dashboard. Никаких data edits, apply,
role provisioning или запуска function bodies. Если интерфейс не раскрывает нужную
metadata, отметить missing; manual SELECT artifact требует отдельного точного review/
разрешения. Текущий документ не разрешает SQL или повтор parked recipe metadata audit.

**C: уже существующий authenticated safe channel.** Только после отдельного scope
approval и проверки, что канал уже доступен, его metadata/read-only operation не
создаёт роли/credentials и не вызывает mutating RPC. Указать tool/endpoint и точный
read scope; получить тот же набор ниже. Наличие такого канала здесь не подтверждено.
Не использовать CLI `db query --linked`, login/bootstrap, service role или fallback
на production. Никакой канал в этом пакете не запускался.

Для A/B/C нужен один и тот же минимальный bundle:

1. **Provenance:** staging project/environment, UTC export time, источник/роль чтения
   (без credential values), deployed build/migration references, hashes, completeness
   и redaction/missing list. Staging evidence не доказывает production deployment.
2. **Metadata:** относящиеся к PLAN/FACT/Goal/entitlement/history/idempotency objects;
   columns/types/nullability/defaults/numeric precision-scale, PK/unique predicates/
   FK/check definitions, RLS enabled/forced flags и policies, table/column/function
   grants, triggers, RPC names/signatures/return types/definitions, security mode,
   search_path и значимые dependencies. Только definitions, не execution.
3. **Protocol:** read/mutate/lookup request-response schemas и redacted samples,
   version/freshness/receipt/retention guarantees, auth/entitlement responsibility.
   HTTP/OpenAPI metadata без function implementation не доказывает atomicity.
4. **Уже имеющиеся behavioral evidence:** provenance проверок accepted/replay,
   same-key-different-payload, stale/concurrent conflict, failure rollback, timeout
   lookup и cross-account/Premium denial. Новые write tests не разрешены; отсутствие
   таких доказательств остаётся gate для будущего отдельно разрешённого test package.

Не передавать JWT, passwords, API/service-role keys, auth headers, purchase tokens
или личные diary rows в чат. Экспорт должен быть redacted; точные рабочие secrets
остаются в существующей защищённой конфигурации владельца.

**Owner checkpoint:** предоставить A; либо выбрать B/C и отдельно согласовать
конкретный metadata/protocol-only scope. Затем локально сопоставить evidence с
таблицей и подготовить DTO/contract-test mapping. Это не разрешение внедрять
persistence, создавать schema/RPC или выполнять SQL/DB writes. Canonical export,
recipe atomic metadata и 120-name ingredient expansion остаются PARKED; payment,
push/deploy и production activation не затрагиваются.
