# Adaptive Nutrition — factual staging gaps and minimal server design v1

2026-09-20 · **DESIGN / DRAFT. Persistence OFF. Nothing applied.**

В staging существует каталог Premium, персональные selections и обычный food diary.
Требуемый versioned PLAN/FACT execution contract в экспортированных объектах не
реализован. Подтверждены два security/product gap: активный Premium catalog доступен
роли authenticated без entitlement; owner-update профиля не защищает `has_premium`
и `is_admin`. Client PremiumRoute не закрывает эти server gaps.

## Evidence и границы вывода

Источник: owner-run `adaptive-nutrition-metadata-staging-2026-09-20.csv`, локально
`/Users/urijurij/Desktop/adaptive-nutrition-metadata-staging-2026-09-20.csv`.
Owner подтвердил STAGING `ozidryfvhkcbtpnulakq`, дату 2026-09-20 и отсутствие известной
обрезки. SQL SHA-256 совпадает с подготовленным artifact:
`655edd04ca8d6956ddcaa15373b6b6a94ff425c3e9bef39c5b3bfce64bebc032`.
CSV SHA-256: `e662c2328d9d5b061a5d01fe991b9482c82f066903b1b0edf011ca37615f1251`.
S00: observed_at `2026-09-20T11:43:45.637523+00:00`, PostgreSQL 17.6,
database/session role `postgres`. Project identity опирается на owner verification;
SQL expected-ref label не является независимой аттестацией проекта.

Локально проверены 1693 records, JSON каждой строки, все section IDs 0–15 и все
счётчики. Число result rows по секциям:
`1, 35, 17, 161, 53, 58, 35, 544, 1, 2, 10, 70, 595, 61, 9, 41`.
S08 содержит один empty marker, его metadata count = 0. Все 161 columns видимы в
information_schema; явные `[REDACTED]`/`TRUNCATED` markers не найдены. Это не
автоматическая гарантия отсутствия любого другого способа редактирования файла.

Ссылки Sxx ниже означают section_id экспортного CSV + указанное имя объекта.
Сопоставление выполнено с [required contract](adaptive-nutrition-server-contract-required-v1.md)
и [PLAN/FACT domain](plan-fact-persistence-domain-v1.md). Historical SQL не подменяет
эту evidence. Исходный CSV не изменён и не скопирован в repository.

S01 содержит 35 application relations; S15 — 41 function signatures. Детальная
metadata выбрана эвристическим scope для 17 таблиц. Ненайденные точные public
tables/functions действительно отсутствуют в этом inventory на момент export;
это не доказывает отсутствие внешнего backend, объектов исключённых schemas или
неописанного протокола внутри JSON `user_state` (он присутствует только по имени).
Runtime actor tests, данные, deployment/build ID и внешний API contract не получены.
Agent не подключался к staging, не выполнял SQL/functions и не проверял доступ
путём чтения пользовательских строк. Production не исследовался.

## 1. Что существует

| Объекты / evidence | Фактическая структура и предел переиспользования |
| --- | --- |
| `premium_plans`, `premium_plan_days`, `premium_meal_slots` (S03–05) | Catalog UUID graph; plan `duration_days` default 14, check только > 0; day_number > 0; unique(plan, day_number), unique(day, sort_order). Нет calendar dates, user ownership или versioned execution. Default 14 — legacy metadata, не новый product contract. |
| `premium_recipes`, `premium_recipe_ingredients`, `premium_recipe_steps`, `premium_recipe_hints`, `premium_meal_recipe_options` (S03–05) | Catalog content/options, recipe FK, step ordering и unique(slot, recipe). Ingredient содержит `ingredient_name`, nullable `amount_g`, display text; canonical_food_id отсутствует. Нет immutable recipe/portion revisions. Наличие таблиц не подтверждает заполненность или готовность recipes. |
| `user_premium_plan_selections` (S03–06) | UUID id, user_id → auth.users, nullable user_goal_id → user_goals(user_id), required premium_plan_id → catalog. Nullable start_date; status active/paused/completed/archived; timestamps. Unique user_id WHERE status='active'. Это существующий personal assignment anchor, но не полноценная versioned week instance. |
| `user_premium_meal_selections` (S03–06) | UUID id; selection/slot/nullable selected recipe FK; timestamps. Unique(selection, catalog slot). Нет local date, порции, snapshot identity, revision. Delete assignment каскадно удаляет meal selections. |
| `user_goals` (S03–06) | PK=user_id, own SELECT/INSERT/UPDATE, targets и start/end date, updated_at. Нет goal_revision или immutable goal snapshot; FK назначения указывает на изменяемую текущую строку, не версию цели. |
| `food_diary_entries` (S03–06) | id/user/date/meal_type, product_name, weight/nutrients, units/display_amount, nullable canonical_food_id и idempotency_key. canonical FK → foods ON DELETE SET NULL. Нет plan/slot/event/receipt FK, immutable recipe/portion revisions, supersedes/retracts или diary revision. В S04 нет FK diary.user_id → auth.users; account isolation здесь задаёт policy. |
| `user_profiles` (S03/06–08/11) | user_id → auth.users; has_premium/is_admin NOT NULL default false; own-row ALL policy, broad table ACL, timestamp trigger. Флаги пока не являются защищённым entitlement authority. |
| `goal_trajectory`, `analytics_events`, measurement histories (S03–06) | Goal curves/deviation JSON; generic analytics metadata; measurement/photo histories. Наличие слова history/events не делает их nutrition operation ledger: нет требуемых receipt/supersession/snapshot contracts. |

Все 17 scoped tables: RLS enabled=true, forced=false, owner=postgres (S02).
Все 53 constraints validated; все 58 indexes valid/ready. Это structural evidence,
не тест concurrency. S11: 70 triggers, из них 64 internal FK и 6 timestamp triggers.
S09 содержит только `update_premium_updated_at()` и `update_updated_at_column()`:
оба invoker, без function-level search_path, тела лишь присваивают updated_at и
возвращают NEW. Нет trigger enforcement для immutable history/revisions/entitlement.
EXECUTE grants этих trigger-returning functions (S10) не означают наличие meal RPC.

### Precision и полезные существующие элементы

- Diary weight/calories/protein/fat/carbs: numeric(8,2), NOT NULL, default 0;
  fiber numeric(8,2) nullable. Не трактовать default 0 как доказательство известного
  фактического nutrient. display_amount — unconstrained numeric.
- Catalog/day/slot calories — nullable integer; protein/fat/carbs — nullable
  numeric(8,2); ingredient amount_g — nullable numeric(10,2), positive check.
- Goal protein/fat/carbs — numeric(6,2); calories — integer. Storage precision
  определяет будущие правила сериализации/rounding, а не clinical thresholds.
- `food_diary_entries_idempotency_unique`: unique(user_id, idempotency_key)
  WHERE key IS NOT NULL; плюс user/date/meal и user/canonical indexes (S05).
  Это реальная server uniqueness для одной diary row. Nullable key, отсутствие
  digest/outcome и разрешённое изменение/удаление строки исключают durable ledger.
- Assignment/slot/options FK и unique indexes полезны для integrity и поиска.
  RLS ownership + slot membership checks — полезная основа, но не CAS или Premium.

## 2. Requirement → factual gap

| Requirement | Evidence / gap на staging | Что требуется |
| --- | --- | --- |
| Authoritative personal plan instance | Есть account-owned selection id, нет execution contract (S03) | Явно связать versioned week instance с существующим assignment и authenticated actor |
| plan_revision | Отсутствует в scoped columns; timestamp triggers только updated_at (S03/09/11) | Server-owned CAS token + retained graph versions |
| goal_revision | Нет в user_goals; FK к user_id не фиксирует версию (S03/04) | Защищённая revision цели и immutable goal snapshot на graph revision |
| week_anchor/timezone | Нет ни одной такой scoped column; start_date nullable (S03) | Local Monday–Sunday, IANA timezone, active/provisional binding |
| Dated meal identity | Catalog slot UUID + day_number, selection uniqueness по catalog slot (S03/05) | Stable occurrence ID + local date + instance; повторения рецепта остаются разными slots |
| Immutable recipe/portion snapshots | Catalog UUID/timestamps и nutrient values, без revision fields (S03) | Server-validated immutable recipe/composition/portion identity и exact amounts |
| Atomic PLAN/FACT action | В S09 только timestamp functions; в S15 нет adaptive action RPC | Одна transaction для effect, revisions, history и durable outcome |
| Idempotent receipt | Есть только nullable diary key/index (S03/05) | Account+key ledger, canonical request digest/version, outcome, operation ID и result refs |
| Lookup by original key | Нет соответствующего RPC в inventory S15 | Authenticated read-only lookup вне ограничения active week |
| UNKNOWN timeout recovery | Нет durable outcome/read protocol | Lookup/exact replay original payload/key; graph похожего содержания не доказательство commit |
| CAS/concurrency | Нет expected revision endpoint/guards; ordinary owner updates разрешены (S06/09) | Atomic compare-and-swap, duplicate-key arbitration, conflict без lost update |
| Append-only history/edit/undo | Diary и selections допускают owner UPDATE/DELETE; assignment→meal CASCADE (S04/06) | Event IDs, supersession/retraction, protected immutable originals и current-effective read |
| Shopping graph consistency | Нет graph revision или shopping read protocol | Selection/aggregation только из одной confirmed graph revision |
| Account ownership | Есть auth.uid checks и assignment membership (S06); ledger/events ещё нет | End-to-end actor/ownership проверки всех refs; client account только assertion |
| Premium enforcement | Active catalog policies без entitlement; writable profile flags; entitlement RPC отсутствуют (ниже) | Один trusted server entitlement predicate, protected authority и read/write checks |
| Fresh read model | В S01 нет scoped views; в S15 нет adaptive read endpoint | Coherent graph+FACT read, exact receipt revisions, completeness и server freshness proof |

Во всех 161 scoped columns единственное совпадение с revision/version/timezone/
week_anchor/snapshot/receipt/idempotency/supersession search — `idempotency_key`.
Это сильная structural gap evidence для обследованных таблиц; не утверждение о
неизвестных JSON payloads или внешних endpoints. Deployed guarantees для них не
предоставлены, следовательно они не могут быть основанием для integration.

## 3. Подтверждённые security/product gaps

**G1 — Premium catalog читается без Premium entitlement.** S14 даёт authenticated
USAGE public, S07 — SELECT на все восемь catalog tables. S06 policies
`premium_plans_select_active` и `premium_recipes_select_active` проверяют только
`is_active = true`; остальные шесть проверяют активность родительского plan/recipe.
Все policies permissive, roles=[authenticated]; дополнительного restrictive
entitlement gate в export нет. Таким образом database policy разрешает Free
authenticated actor читать активный каталог. Это **deployed staging security/product
gap**, подтверждённый сочетанием ACL + RLS, без необходимости читать сами recipes.
Фактическое наличие active rows и HTTP exposure не проверялись. Client hiding/route
guard не меняет database разрешение. Anon SELECT grant сам по себе не доказывает
anon чтение каталога: catalog policies адресованы authenticated.

**G2 — privilege flags доступны own-row mutation.** `user_profiles_modify_own`
FOR ALL TO PUBLIC имеет USING/WITH CHECK `auth.uid() = user_id`; authenticated
имеет INSERT/UPDATE table privileges, column restrictions нет (S07–08).
В S11 только timestamp trigger, S04 только PK/user FK. В этой DB модели actor
может менять has_premium/is_admin своей строки; metadata не содержит field guard.
Это подтверждённый authorization gap, а не утверждение о выполненной эксплуатации.
[AuthContext](../../src/context/AuthContext.tsx) использует эти flags; client methods
в [profileService](../../src/services/profileService.ts) не заменяют server protection.
Нельзя просто добавить policy «profile.has_premium=true» и объявить её безопасной.

**G3 — существующие owner writes обходят будущую version/history boundary.**
Selection CRUD policies проверяют owner, active catalog и допустимость выбранной
recipe option; не entitlement/CAS. Diary own ALL позволяет UPDATE/DELETE и изменение
key; goal own UPDATE не требует revision. Без ограничения этих путей новый RPC
не станет единственной authoritative границей. При этом ownership checks полезны:
не утверждается, что обычная чужая строка доступна через них.

**G4 — ACL шире необходимого.** Для anon/authenticated на всех 17 scoped tables
есть SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. RLS всё ещё
ограничивает ordinary row DML; blanket утверждение «anon может всё» неверно.
TRUNCATE/maintenance privileges требуют отдельного least-privilege review; export
не доказывает доступность соответствующего пути через API. FORCE RLS=false также
не означает отсутствие RLS для authenticated; privileged paths требуют review.

**G5 — repo entitlement RPC не deployed в обследованном public inventory.**
`entitlements`, `subscriptions` отсутствуют в S01; `get_entitlements`,
`get_paywall_state` отсутствуют в S15. Их вызовы в
[entitlementService](../../src/services/entitlementService.ts) и historical SQL
не доказывают working server authority. Внешний entitlement provider не известен.
Payment integration не требуется для исправления границы и остаётся вне scope.

Policies/grants не изменены. Приоритет перед activation: G1/G2 и защита write
boundary G3; затем отдельный scoped ACL review G4. Никаких blanket revokes draft
не предлагается без compatibility review legacy consumers.

## 4. Что переиспользовать, что нельзя использовать как authority

Переиспользовать существующий catalog/template graph, selection UUID/account
binding, goal row, diary storage/units/precision, FK/unique indexes и ownership
predicates. Не создавать второй recipe catalog, второй goal service или отдельный
полностью независимый diary. Сохранять существующие данные и legacy IDs.

Нельзя переиспользовать как готовую гарантию: catalog slot как dated occurrence;
updated_at как revision; client idempotency или diary unique index как operation
ledger; изменяемый recipe как historical snapshot; owner-writable profile flag как
entitlement authority; analytics/measurements как meal history; прямой legacy
diary update/delete как Adaptive EDIT/UNDO. Meal selection rows не содержат portions
и не должны молча становиться consumed facts. Runtime сейчас читает catalog;
ссылки на user_premium_* selections в src найдены в guard tests, не в production
service mutations. Неизвестные внешние consumers остаются compatibility checkpoint.

## 5. Minimal server design v1 — proposal, не deployed contract

### 5.1 Instance и graph: расширить существующую модель

**Execution layer нужен семантически; отдельная параллельная assignment table пока
не нужна.** Предпочтение — развить `user_premium_plan_selections` в versioned
personal week instance. Existing selection UUID становится domain plan_id только
для явно активированного нового contract version. Сохранить user_id, catalog origin
и legacy rows; добавить conceptually contract_version, week_anchor, timezone,
plan_revision, goal_revision и execution/history revision. Недатированные legacy
rows не конвертировать догадкой; отдельная explicit activation создаёт/подтверждает
новый instance. Existing status constraint потребует явного provisional state;
one-active-per-user index полезен, переключение недель должно быть atomic.

Для v1 сохраняется existing required premium_plan_id как origin template, но 14-day
duration не управляет execution: active instance всегда одна local Monday–Sunday
неделя. Если owner требует instance вообще без template origin, это отдельное
решение о nullable origin и совместимости, а не повод создавать второй catalog.
Calendar binding instance фиксирован; смена timezone/недели — подтверждённый новый
binding/instance с сохранением history, без переименования дат уже съеденных фактов.

Добавить одну immutable graph-revision сущность, привязанную к instance: полный
семидневный dated graph, stable occurrence IDs, goal snapshot/revision,
recipe/composition/portion snapshot identities и точные quantities/nutrients.
Для начального contract полный validated graph snapshot допустим как structured
JSON, без обязательного дублирования catalog tables в новых day/slot tables.
Server validation обеспечивает unique dated IDs, calendar coverage, ownership,
snapshot integrity и связь revision с единственным содержимым; JSON сам этого
не гарантирует. Missing meals не заполняются автоматически.

`user_premium_meal_selections` оставить legacy selection graph. Не dual-write два
независимых источника истины: Adaptive graph authoritative в revision snapshots;
legacy compatibility projection вводить лишь если подтверждённый consumer требует.
Legacy CRUD не может менять frozen Adaptive graph или удалять instance/history.

`user_goals` расширить защищённым server goal revision; любое разрешённое изменение
цели должно advance revision и invalidation, включая legacy writers. Snapshot цели
сохраняется в plan revision. Goal/adaptation changes требуют explicit confirmation;
не добавлять формулы, calorie floors или automatic compensation.

### 5.2 Operation, receipt и UNKNOWN

Добавить account-scoped durable operation ledger, а не расширять diary key до
значения, которого у него нет. Unique(authenticated actor, idempotency_key),
operation_id, versioned canonical business request/digest, action, expected
revisions, terminal outcome/reason и exact result references. Secret/auth headers
в payload не входят. Actor берётся из auth context; client не выбирает другого user.

Exact replay проверяется до нового CAS и возвращает исходный outcome. Один key
с другим payload → conflict. Same-key parallel requests арбитрируются уникальностью
и блокировкой; два разных key со stale expected revisions не перетирают результат.
Один accepted receipt и один domain effect commit совместно. Детерминированные
conflict/rejected outcomes можно сохранить без domain effect; unexpected error
откатывает transaction, а transport outcome остаётся UNKNOWN до evidence.

Read-only lookup исходного account+key не создаёт новый action. Он возвращает
durable terminal receipt либо unresolved/not-found с явной семантикой. Отсутствие
видимой ledger row не доказывает rollback, пока original transaction может быть
in flight. Retry сохраняет original key/payload/expected revisions. Ledger retention
не должна позволять повторное выполнение старого key: для v1 предлагается хранить
receipt/key tombstone весь supported history lifetime, без silent key reuse.
Cross-week/timezone и A→B→A recovery остаются account scoped; UI не видит чужие refs.

### 5.3 FACT/history и существующий diary

Добавить authoritative append-only nutrition events: operation/account/instance,
event ID, kind, event revision, dated slot (когда применим), exact snapshot provenance,
supersedes/retracts links. Новый event заменяет effective interpretation, не удаляет
исходный. Undo не resurrect предыдущую версию и не создаёт zero-calorie consumption.
One-current-head / expected-event validation защищает concurrent edit/undo.

`food_diary_entries` остаётся diary integration surface: добавить защищённую связь
с authoritative fact event и stable component identity. Exact multi-component
snapshot сохраняется без client-inferred totals; event snapshot и diary projection
пишутся в одной transaction. Старые rows сохраняются как legacy facts; новые
superseding rows не должны удваивать totals. Все затронутые readers должны читать
effective projection (legacy + current non-retracted facts), а Adaptive rows должны
быть защищены от legacy update/delete/upsert. Это обязательный compatibility gate,
не обещание включить новые факты в текущий Progress без изменений.

Version scope определить явно: plan_revision — graph; execution/history revision —
annotations/events; diary revision — FACT projection. Для минимального Adaptive
read допустим `(account, instance)` scope diary revision с exact event refs.
Он не доказывает freshness всего account diary. Если единый read включает legacy
дневник/Progress, contract должен охватить все его writers отдельным account diary
revision/barrier; нельзя выдать instance counter за глобальную diary revision.

Новые history/snapshot/receipt FK не должны наследовать destructive assignment→meal
CASCADE. Normal undo/delete планов сохраняет authoritative history. Account deletion
и retention требуют отдельного решения; это не механизм обычного EDIT/UNDO.

### 5.4 Одна atomic action boundary

Предлагается один versioned mutation RPC/transaction boundary (имя ещё не API):
authenticate → account-scoped replay lookup → authorize new Premium effect →
lock/CAS goal+instance/history → validate exact snapshot/action → commit effect +
history + resulting revisions + receipt. Lock order одинаков для всех writers;
same-key replay и cross-account отказ не должны утекать чужими identifiers.

| Action | Совместный transaction effect |
| --- | --- |
| AS_PLANNED | Exact confirmed plan snapshot → fact event + все diary components + execution link + diary/history revisions + receipt |
| MODIFIED / EXTRA | Явный actual food/portion payload → отдельный fact snapshot/event/projection + revisions + receipt; EXTRA не меняет будущий план |
| SKIPPED / undo skip | Annotation/retraction + history revision + receipt; diary rows отсутствуют |
| REPLACE / restore slot | Новая immutable graph revision + plan head + history + receipt; consumed facts остаются прежними |
| EDIT / UNDO FACT | Supersession/retraction + effective diary projection + diary/history revisions + receipt; originals остаются |

Failure на любом graph/snapshot/event/projection шаге откатывает весь effect.
Catalog nutrition/canonical validation остаётся блокером для реального save;
metadata не обеспечивает доступные foods и не разрешает expansion/import.

### 5.5 Read-model, shopping и entitlement

Минимальный read contract: authenticated actor, instance/calendar/status,
plan/goal/history/FACT revision scope, полный dated graph со snapshot identities,
exact fact event refs/effective state, completeness и operation receipt binding.
Read выполняется из согласованного server snapshot. Для v1 выбирать **exact receipt
revision read** с retained immutable versions: текущий adapter не умеет доказать
неизвестный successor. History/FACT read должен быть согласован с тем же receipt,
а не только graph. Для актуального head нужен серверный coherent read contract;
показ historical exact result не даёт права overwrite нового head.

Если exact revision недоступна или требуется latest successor, возвращать explicit
unavailable/conflict либо отдельно специфицировать server causal/successor proof.
Не сравнивать opaque tokens по строкам/времени и не вводить client freshness oracle.
Shopping строится только из подтверждённого graph snapshot указанной revision;
derived cache маркируется instance+revision, pending replacement его не меняет.

Один server entitlement predicate применяется к catalog reads, execution reads и
каждому **новому** paid effect. Минимально можно переиспользовать has_premium только
после защиты field writes, отделения обычного profile edit и подтверждения trusted
provisioning/source существующих значений. Защита is_admin нужна независимо.
Без trusted authority отказ fail closed; не создавать payment/subscription систему.
Own historical facts, operation lookup и exact replay уже принятого outcome должны
оставаться recoverable после истечения Premium без создания нового paid effect;
конкретная read/expiry policy подлежит owner review.

Будущие privileged RPC требуют минимальных EXECUTE grants, полного actor/ownership
enforcement, квалифицированных объектов и безопасного search_path. SECURITY DEFINER
сам по себе не обеспечивает безопасность. Catalog RLS и direct write paths должны
соответствовать той же authority; client route checks лишь UX.

## 6. Exact owner checkpoint перед implementation

Согласовать этот minimal design как основание **локального schema/RPC draft**:

1. Развивать existing selection ID в versioned week instance, сохраняя legacy rows;
   подтвердить template-origin limitation v1 и отсутствие иных writers/consumers,
   которым помешают protected Adaptive rows и provisional status.
2. Указать trusted Premium authority/provisioning policy. Рекомендуемый минимум:
   protected existing profile flags; подтвердить доверенность/порядок проверки
   прежних значений, а не считать их достоверными после одного изменения policy.
   Подтвердить recovery/history access после expiry. Secrets/user diary rows не нужны.
3. Согласовать immutable graph revisions + account-key receipts + append-only events,
   instance-scoped FACT revisions и effective legacy diary compatibility. Если нужен
   глобальный diary freshness contract, включить all-writer revision boundary до
   интеграции с Progress. Не разрешать destructive history reset/backfill.

После этих решений next safe task — локальный schema/RPC/DTO draft и synthetic
acceptance tests, включая negative account/Premium, same-key replay/payload mismatch,
stale/concurrent conflict, timeout/lookup, rollback, supersession и shopping revision.
Никакой текущий тест не доказывает эти будущие server guarantees. Apply, actor/write
tests и rollout потребуют отдельного конкретного owner checkpoint с reviewed patch,
compatibility/rollback plan и scope staging; текущий документ их не разрешает.

Canonical export, recipe atomic metadata и recipe ingredient expansion **PARKED**.
Payment **OUT OF SCOPE**. Browser gap сохранён. No SQL apply/migrations, DB/RLS/fixture
writes, production changes, push/deploy. Данный пакет — только локальный анализ и
design; SQL/schema/RPC patch пока не создан.
