# Shared Food Eligibility Contract V1 — архитектурное предложение

Статус: DESIGN ONLY / OWNER APPROVAL REQUIRED.
Проверяемый PR #154 HEAD: `b36f55500fc4b142bfa7b3029dc4c511a9d58c75`.
Документ только для review; SQL, Supabase, runtime и production не изменяются.
Публикация документа выполняется отдельным Draft PR, не в PR #154.

## Решение

**Рекомендация: отдельный private server-authoritative eligibility registry,
ключ которого — существующий foods.id. Первый этап обслуживает ТОЛЬКО новые
Food Evidence операции. Подключение canonicalFoodResolver — отдельный rollout.** Не добавлять is_searchable/needs_review ради совместимости.

Registry не является вторым food catalog, новой food identity или entitlement
ledger. Он описывает допуск существующего shared root. Право изменить допуск
проверяется существующими potok_control trusted admin attestations.

До реализации/approval registry отсутствие колонок и отсутствие решения НЕ
означают доступность. Текущий Phase 2B остаётся BLOCKED; удалять только preflight
requirements или применять coalesce(..., true/false) запрещено.

## Подтверждённая модель

Staging PostgreSQL 17.6 имеет foods.id/canonical_food_id/stable_food_id/source/
created_by_user_id и identity snapshot fields; is_searchable/needs_review отсутствуют.
Phase 1 требует shared root core/brand и sharedCatalogAccessible=true, но не
предписывает две legacy DB-колонки. Это значение — серверный проверяемый факт
на момент issuance, не клиентское permission и не обещание вечной доступности.

canonicalFoodResolver.ts:8 делает legacy flags optional; :39 исключает явно
hidden/needs-review кандидатов, но отсутствие flags не исключает root.
:25–50 проверяет exact names/aliases, неоднозначность и snapshot consistency;
:73–94 использует select('*') и отдельные exact alias-target reads.
Таким образом, текущий resolver не доказывает server-authoritative eligibility.

20260316_food_canonical_layer_draft.sql — НЕ доказательство deployed schema:
canonical_resolution_status и superseded_by_food_id предложены в draft.
Статусы canonical/variant/user_canonical/needs_review описывают resolution,
а не полномочия reviewer или evidence authority. Их нельзя автоматически
преобразовать в ELIGIBLE. Supersession не равна invalidation или archive.

## Сравнение вариантов

| Критерий | Поля в foods | Private eligibility registry |
|---|---|---|
| Безопасность | Все importer/admin/client UPDATE paths должны запретить изменение статуса; legacy ownership policies и привилегированные writers расширяют boundary | Отдельный ACL: importer/client не могут изменять решение; root/source integrity всё равно проверяется live |
| Сложность | Меньше JOIN, но новые guarded columns, backfill, grants/triggers и изменение всех writers | Дополнительные tables/RPC/locks/versioning, явная интеграция resolver |
| Identity | Existing foods.id | FK к existing foods.id; никаких parallel IDs |
| Compatibility | Изменяется действующая foods schema; optional flags всё равно недостаточны для authoritative решения | Existing foods columns сохраняются; нужна замена shared resolver read path |
| Archive | Mutable boolean легко воскресить upsert; нужна отдельная долговечная защита identity | Terminal registry state + stable-key binding служат единственным archive authority для C |
| Rollout | Особое approval schema/writer изменений | Особое approval нового registry/read boundary; не автоматическое внедрение |

Registry предпочтителен для реального Staging и запрещённого importer trust escalation.
Добавление legacy flags с разрешающими defaults — не эквивалент этого контракта.

## Contract и источник истины

Version: potok-shared-food-eligibility-v1. Только operational eligibility;
не переиспользовать Phase 1 evidence/event digest domains.

Серверное решение содержит:
- contract/version, existing canonicalFoodId и exact foodStableId;
- status: PENDING | ELIGIBLE | HIDDEN | BLOCKED | ARCHIVED;
- monotonic decisionRevision и уникальный immutable decisionId;
- exact identity/catalog binding fingerprint + fingerprint encoding/domain version;
- server occurredAt и predecessor decision binding;
- private verified actor/attestation context, explicit idempotency reference,
  exact request digest/bytes и typed reason code; free text только bounded/private;
- минимальный public decision projection без actor UUID, source bytes или free reason.

Fingerprint включает существующие root ID/canonical ID/stable key/source/owner
и exact reviewed identitySnapshot. Отдельный versioned SHA-256 domain;
hash обеспечивает integrity, а право изменения — trusted server transaction.
Изменение identity, не затронувшее hash из-за неполного набора полей, недопустимо:
полный binding set фиксируется в тестах. Nutrition validity остаётся отдельной
Phase 1 dependency/invalidation проверкой, не выводится из eligibility.

Сервер возвращает effectiveEligibility:
ELIGIBLE только если одновременно:
1. root существует, foods.id = canonical_food_id;
2. source ровно core/brand, created_by_user_id IS NULL;
3. stable key существует, имеет Phase 1 exact representation и не конфликтует;
4. есть authoritative decision ELIGIBLE с exact current fingerprint/key;
5. нет terminal archive/identity tombstone, запрещающего этот ID/stable key;
6. requester имеет право на соответствующую операцию/область доступа.
Unknown/null/missing/malformed/mismatched state -> DENY.
Food Evidence writer дополнительно проверяет JWT/session/admin attestation.
Public resolver read не предоставляет право issue/review.

Клиентский sharedCatalogAccessible=true остаётся strict proposal field, но
не используется как источник допуска. Сервер независимо проверяет eligibility,
затем строит immutable canonical revision с true. False/unknown proposal reject;
положительное клиентское значение не обходит registry.

## Изменение статуса и identity

- Отсутствующая запись: effective UNKNOWN/DENY, не неявный ELIGIBLE.
- PENDING: создана явным controlled onboarding, недопущена.
- PENDING/HIDDEN/BLOCKED -> ELIGIBLE: новая trusted admin decision с exact snapshot,
  отдельным reason code, expected decision revision; BLOCKED требует явного
  clearance, не silent importer retry.
- ELIGIBLE -> HIDDEN/BLOCKED: controlled server decision немедленно запрещает
  новые Food Evidence approvals/current usability; resolver только после отдельного rollout; история сохраняется.
- Любой nonterminal -> ARCHIVED: отдельно утверждённый C archive command.
  ARCHIVED terminal; automatic unarchive/TTL/reset запрещены.
- Отдельные HIDDEN и BLOCKED нужны для обычного скрытия и явного safety/administrative
  запрета. BLOCKED не автоматически создаёт Phase 1 SAFETY_CRITICAL event:
  invalidation immutable evidence — отдельная явно авторизованная операция.
- Catalog identity изменился: old decision сохраняется, effective state DENY
  вследствие fingerprint mismatch до explicit re-review. Не переписывать old proof.
- Food Evidence issuance не переводит PENDING в ELIGIBLE автоматически.
  Catalog eligibility approval и review evidence approval — разные outcomes;
  composite command возможен только как отдельно reviewed atomic protocol.
- Archive C использует тот же registry terminal state/key tombstone, а не второй
  конкурирующий marker/boolean. Permanent minimal operational tombstone защищает
  прежний ID и stable key даже после cleanup audit envelope. Без новых food IDs.
- Existing aliases связываются только с eligible canonical root; alias не получает
  собственную eligibility identity. Private user-food flow остаётся отдельным.

## RLS/ACL и предлагаемая schema

Предлагается private schema potok_food_eligibility:
decision history, current head и permanent archived identity/key binding.
Физическую детализацию audit envelopes утвердить с retention policy;
не создавать бессрочный личный ledger только ради нового статуса.
Все references к foods и history — RESTRICT, не CASCADE.
Operational heads нельзя изменять непосредственно из клиентского SQL.

ENABLE/FORCE RLS; никаких прямых client policies/writes; revoke schema/table/helper
доступ у PUBLIC/anon/authenticated/service_role, включая column grants/TRUNCATE.
Narrow postgres-owned SECURITY DEFINER RPC: search_path=pg_catalog, qualified objects,
explicit EXECUTE только требуемой роли, internal JWT/ownership/authority checks.
Reader выдаёт минимальную authorized projection; writer использует существующий
trusted entitlement lifecycle, никогда is_admin/verified/suspicious.
Owner/BYPASSRLS/DDL — доверенная operational boundary, не гарантия RLS против owner.

Decision history append-only. Current head обновляется только guarded transaction.
Exact actor/key/request replay возвращает старый receipt, changed bytes -> conflict;
revoked authority не получает право replay. Retention/duplicate-deny policy нужна
до persistent issuance; same digest alone недостаточен для сравнения exact request.
Actor IDs/attestation references не публикуются через resolver.

## Атомарность, resolver и lock discipline

Все eligibility/food review/archive commands используют общий порядок:
existing actor/admin gate -> root row lock -> eligibility/evidence heads.
Writer root lock FOR UPDATE сериализует решения разных reviewers по одному root;
reader FOR SHARE обеспечивает согласованный decision/root snapshot.
Адаптация существующего A advisory-before-row порядка требует отдельного repair
и concurrency proof; не добавлять advisory lock в row trigger задним числом.
Bulk operations берут roots в детерминированном UUID порядке.
Authority и server time проверяются после ожидания locks.
Importer catalog write не изменяет eligibility head; fingerprint mismatch закрывает
допуск. Archive trigger проверяет OLD shared identity, ID/stable key recreation,
TRUNCATE и searchable reactivation paths, не берёт actor gates после row lock.
C deployment меняет foods writer behavior и требует отдельного approval.

Только на отдельном consumer rollout для resolver вводится server exact-resolution read: name/alias complete candidate
set + authoritative eligibility одного statement/snapshot. Сохранить complete
counts, no ranked truncation, ambiguous fail-closed и base-vs-sprouts правило.
Не объединять independently cached root и eligibility responses в доверенный факт.
UI cache — hint; перед новой selection/review сервер повторно проверяет live state.
Shared direct-ID/barcode/alias paths используют тот же predicate.
Private owned user foods не перенаправлять в shared registry.
Отсутствующая eligibility metadata у shared candidate -> unavailable, не resolved.
Legacy flags, если появятся в других средах, могут только запрещать дополнительный
допуск, не выдавать его; конфликт с registry -> DENY и явный diagnostic.

Historical diary/КБЖУ не переписываются. HIDDEN/BLOCKED/ARCHIVED не стирает старую
Food Evidence history. Current-state usability включает eligibility AND существующие
canonical binding/invalidation checks; archived root не воскрешается supersession.
Receipt recovery имеет отдельное historical authorization поведение и не означает
current eligibility. Эту границу надо согласовать при интеграции A, а не скрыто
оставить общий shared_food guard для всех historical remediation операций.

## Предлагаемые файлы, не созданные SQL

- supabase/migration_drafts/shared_food_eligibility_v1.sql + .preflight.sql/.postcheck.sql
- src/server/sharedFoodEligibilityV1.ts и его tests
- scripts/contracts/shared-food-eligibility-disposable-db-v1.test.ts
- integration repairs existing phase2b.sql/.preflight.sql и disposable suite
- src/services/canonicalFoodResolver.ts и existing resolver tests
- C archive draft потребляет unified registry; не создаёт параллельный status source.

Миграция additive: не менять существующую food identity, nutrition/diary или старые
artifacts. Registry первоначально пустой -> Food Evidence eligibility DENY; действующие
поиск, resolver, дневник и рецепты registry не читают и не меняются. Никакого
автоматического ELIGIBLE для existing core/brand и никаких default actor/time/authority.
Controlled synthetic onboarding отдельно от production backfill. Новые decision
artifacts идентифицируются UUID, но operational identity только existing foods.id.
Любые legacy resolver activation effects проходят отдельный rollout approval:
пустой registry НЕ подключается к existing resolver. Переключение его consumers
BLOCKED до coverage/backfill policy и отдельного approval; нельзя скрывать impact.

## Acceptance и rollout

1. Owner утверждает status transitions, resolver/direct-ID behavior, private audit
   retention, HIDDEN/BLOCKED historical invalidation semantics и C lock integration.
2. Реальный metadata preflight проверяет types, keys, trusted function signatures/
   owners/ACL, role isolation, Auth/session contract, RLS и absence of conflicting
   registry. Presence полей не доказывает safe row values.
3. Реализовать registry/read boundary и A/C integration отдельным reviewed пакетом,
   не вырезая legacy guards до появления эквивалентного enforcement.
4. Disposable PG17+ fixtures отражают Staging без legacy flags.
   Negative cases: empty registry, PENDING/HIDDEN/BLOCKED/ARCHIVED, unknown/null,
   private/nonroot/missing stable/conflicting key; forged client true; actor/JWT/
   scope/attestation expiry; direct write/helper denial; source/identity drift.
5. Real races: eligibility update vs review/read/archive/import; exact retry/content
   conflict and expected-head CAS; expiry/revoke after wait; rollback conservation;
   deadlocks/lock-order cases; importer ID/key resurrection and TRUNCATE denial.
6. Resolver regressions: full name/alias candidate set, duplicates/conflicting
   snapshots, ambiguous and unavailable, variant safety, private-food ownership;
   flags absent do not grant access; revoked status/cache stale never admits.
7. Existing 22/22 A suite PASS — baseline, не доказательство нового registry.
   Новая combined suite должна PASS без SKIP/TODO, Phase 1 digest/wire bytes unchanged.
8. Только после отдельного apply approval — controlled Staging synthetic onboarding,
   metadata/behavioral postcheck и ограниченное integration testing без user activation.
   Main fail-closed до trusted boundary; production/backfill/merge отдельно.

Rollback не удаляет history/archived tombstones и не возвращает разрешающий fallback.
Отключение нового resolver не должно переводить unknown shared candidates в resolved.
До approved implementation и реального acceptance rollout остаётся BLOCKED.

## Оставшиеся owner decisions

Принять registry вместо расширения foods; точные bounded retention сроки и authority
proof после удаления PII; clearance BLOCKED; semantics historical invalidation на
blocked/archived root; общий lock order A/C/importer; resolver availability impact
и scoped rollout; поддерживаемая server read interface/операционная область доступа.
Это новый обязательный компонент, а не косметическое снятие preflight требований.

## Final review addendum: обязательные уточнения

Нормативный implementation plan: shared-food-eligibility-v1-implementation-plan.md.
Он уточняет rollout границы этого документа. Единая семантика — конечная цель,
но действующий resolver НЕ переключается при первом этапе. PENDING/absence DENY
относится к новым registry consumers, не задним числом к legacy meals.

REVIEW_REJECTED и INVALIDATION должны работать для существующих hidden/blocked/
archived targets при самостоятельной проверке authority и exact historical binding:
блокировка продукта не должна препятствовать его safety invalidation.
Для rejection proposal достаточно проверенного existing shared-root identity/context;
не выдаётся revision и не требуется ELIGIBLE. APPROVED требует ELIGIBLE.
Receipt history не выводит current usability. Current lookup может вернуть историю
с usable=false, если это разрешено admin boundary, без разрешения archived food.

Content fingerprint не предотвращает ABA сам по себе. Нужен trusted monotonic
catalog identity epoch для зарегистрированного root, обновляемый на каждую identity
mutation, включая изменение и возврат исходных bytes. Epoch в registry binding,
не в Phase 1 wire; нельзя использовать клиентский updated_at как epoch.
Постоянное внедрение BLOCKED, пока mutation-side enforcement не проверено.
Stable-key claims/terminal tombstone требуют защиты всех INSERT/UPDATE/DELETE/
TRUNCATE paths; отсутствие flag не предоставляет обход. Решение archive commands
не активируется до C guard approval и реальных resurrection/race tests.

Append-only personal audit не обещает автоматический erasure. До approved privacy
retention/account lifecycle persistent apply BLOCKED; original actor UUID anchor
не утверждён. Synthetic disposable tests можно запускать независимо.
