# Adaptive Nutrition — schema/RPC/DTO review package v1

2026-09-21 · **PROPOSED, NOT APPROVED. Persistence draft prepared; runtime OFF.**

Основание: [factual staging gaps](adaptive-nutrition-staging-gap-analysis-v1.md),
[required contract](adaptive-nutrition-server-contract-required-v1.md),
[PLAN/FACT domain](plan-fact-persistence-domain-v1.md). Owner разрешил подготовить
этот пакет, не утвердил решения и не разрешил apply. Deployed evidence остаётся
owner export от 2026-09-20; новых server observations нет.

Уточнение review: nullable generated origin, Free FACT correction после expiry,
совместное включение compatibility/barrier и конкретная role/provisioning модель
ниже — рекомендуемые варианты, всё ещё **PROPOSED**. P01–P11 теперь сгруппированы
в технические рекомендации, evidence blockers и три owner decisions (§9).

## Review artifacts

- [Schema/RPC specification](drafts/adaptive-nutrition-server-v1.schema-rpc.sql):
  поля/ключи/FK/ACL candidates, projection rules и RPC algorithms. Весь SQL-файл
  заключён в комментарий; это не executable migration. Полные function bodies,
  deployment roles и provisioning намеренно не объявлены готовыми.
- [Proposed DTOs и synthetic predicates](../../scripts/contracts/adaptive-nutrition-server-v1.ts):
  вне application runtime; нет network/storage/SDK imports. RevisionContext и
  SnapshotRevision переиспользованы из существующего domain. Нет client writer.
- [Synthetic contract tests](../../scripts/contracts/adaptive-nutrition-server-v1.test.ts):
  только in-memory fixtures; не доказательство SQL/RLS, transactions или durability.

## 1. Proposed schema и authority

| Concept | Proposed storage / invariants |
| --- | --- |
| Weekly execution instance | Расширить `user_premium_plan_selections`, retain UUID=user-visible domain plan_id, user_id, origin FK и legacy rows. contract_version 0/1; для v1 обязательны week_anchor/timezone и server-owned graph/goal/history/FACT revisions. Provisional отдельно от active. Calendar binding неизменяемый; week/timezone change создаёт новый подтверждённый instance. |
| Graph revisions | Одна новая `adaptive_nutrition_graph_revisions`: account+selection+revision PK, immutable full dated graph и goal snapshot. Stable dated occurrence IDs, recipe/portion/composition identities, explicit coverage и validated amounts. Не копировать catalog в новую независимую recipe/day систему. |
| Operation ledger | `adaptive_nutrition_operations`: account+key unique, operation ID, canonical request/digest version, terminal outcome и exact result references. Same-key payload mismatch conflict. Никакого client assignment outcome/revisions. |
| History | `adaptive_nutrition_events`: единый append-only FACT/history stream для Free и plan-linked событий. Account обязателен, instance/source graph nullable для standalone Free facts; provenance linked FACT сохраняется при correction. One successor, per-stream event revision; no destructive edit/undo. |
| Diary projection | Расширить существующий `food_diary_entries` protected event/component links. Legacy rows и IDs сохраняются. Effective read включает legacy + current live FACT components; события/graph сами по себе не diary facts. |
| Goal | `user_goals` получает защищённую revision; graph хранит подтверждённый goal snapshot. Каждый допустимый writer участвует в revision boundary; hidden goal/adaptation writes запрещены. |
| Entitlement provenance | Trusted entitlement v2 + v2.1 + v2.2 подтверждены владельцем как applied на STAGING; неизменённый rollback-only acceptance завершился PASS/ROLLBACK. Production untouched; old flags всё равно не authority. |

Все новые immutable объекты без normal UPDATE/DELETE/TRUNCATE и cascade удаления
через assignment. Account-erasure/retention отдельно OPEN. New composite FK должны
проверять account вместе с object ID; FK сам не заменяет validation same instance,
date, stream, immutable content и action compatibility. Exact component manifest
должен совпадать со всеми diary projection rows, а не только с их количеством.

Legacy `user_premium_meal_selections` остаётся legacy preference graph. Adaptive
source of truth — confirmed graph revision; dual-write двух независимых планов
не вводится. Existing one-active-per-user index учитывается при atomic activation;
старый active assignment можно архивировать только после explicit confirmation.
Нельзя назначить version=1 legacy row по одному start_date или updated_at.

## 2. has_premium/is_admin: INSERT, UPDATE и provisioning

**OWNER-APPROVED interim product rule, 2026-09-21:** до payment integration новый
Premium grant/revoke допустим только через protected owner-controlled server
authority с audit. Premium и admin — разные capabilities. Client/profile flags не
authority; прежние `has_premium/is_admin=true` остаются unverified. Это утверждает
правило admission, но не доказывает наличие защищённого server channel/operator и
не разрешает DB apply.

**PROPOSED:** ordinary profile writes имеют allowlist бытовых profile columns.
INSERT опускает flags и provenance, сервер ставит false/NULL. UPDATE не может
set/clear/echo protected fields, даже тем же значением. Own-row RLS остаётся; table
INSERT/UPDATE grants должны уступить scoped column grants, иначе column allowlist
не ограничит broad privilege. Проверить PUBLIC и наследование ролей. DELETE/recreate
профиля также не ordinary путь, иначе provenance можно разрушить.

Upsert нужно проверять на обеих ветках: INSERT и ON CONFLICT UPDATE. Profile identity
задаётся authenticated actor; UPDATE user_id запрещён. Defense-in-depth field guard
не использует client-supplied flag, JWT user_metadata или custom GUC как признак
trusted writer. Рекомендуемая trusted role/provisioning модель ниже; её доступность
и operational authority пока не подтверждены. В draft нет service-role workaround.

STAGING owner-controlled entitlement gate теперь подтверждён как
`APPLIED_STAGING / ACCEPTANCE_PASS`. Paid admission всё равно **fail closed** без
effective attestation; existing `has_premium=true` не становится authority.
Production не изменялась. Operational grant/revoke и любое будущее делегирование
остаются отдельными owner controls; проверка Premium не верифицирует is_admin.

Это затронет pending profile queue, обычный upsert, subscription UI и admin setter
(см. consumers). Нельзя включить защиту и молча считать старый optimistic/local-only
успех подтверждением server access. Payment/provisioning implementation вне пакета.

### Минимальный trusted provisioning и roles — PROPOSED

Рекомендуется ручное owner-controlled provisioning с журналом attestations,
без payment integration. Ответственный оператор по reviewed account/capability/
expiry/evidence reference вызывает узкую grant/revoke процедуру через уже доверенный
административный канал. Этот канал **не объявлен существующим**; его наличие,
auth bootstrap и операторская атрибуция — внешняя evidence. Credentials в чат не нужны.
Не принимать client flag, пользовательский email или старый is_admin как разрешение.

Технический выбор ролей владельцу не делегируется:

- `potok_nutrition_executor`: NOLOGIN, NOSUPERUSER, NOBYPASSRLS; владелец только
  reviewed diary/plan/read routines, минимальные права на соответствующие objects.
  Не может выдавать entitlement, менять profile flags или создавать DDL.
- `potok_access_provisioner`: отдельная NOLOGIN/NOBYPASSRLS role; владелец узкой
  grant/revoke routine, права на protected profile projection и append-only
  `access_attestations` в закрытой control schema. Никаких PLAN/diary write grants.
- Table/schema owner остаётся отдельной migration authority. App anon/authenticated
  не состоят в этих ролях и не могут SET ROLE в них. EXECUTE application routines
  только authenticated; provisioning EXECUTE — только отдельно проверенной
  административной identity. PUBLIC/anon EXECUTE/default grants отсутствуют.

Routines fully qualify objects, фиксируют `search_path=pg_catalog` и не используют
dynamic SQL. Role-specific RLS допускает только нужные операции; definer routines
проверяют auth actor/владение каждой ссылкой самостоятельно. Read-only entitlement
predicate возвращает только право текущего actor, не чужие attestation rows.
Invoker field guards не должны превращаться в security-definer guard, теряющий
реальный execution role; никакого bypass через caller-set session variable.

`access_attestations`: immutable grant/revoke ID, account, capability (Premium/admin
раздельно), validity, previous attestation, operator identity, reason и evidence ref.
Флаг/provenance — защищённая projection действующей непросроченной attestation;
issuer audit event и projection меняются в одной transaction с account lock.
Непроверенные прежние true flags дают deny. Никакого mass verification/backfill;
owner reconciliation подтверждает каждый grant по независимому основанию.
Первоначальный admin bootstrap — отдельная reviewed operator operation, никогда
самовыдача по старому profile flag. Ни роли, ни таблица, ни процедура не созданы.

### Локальный trusted-entitlement domain contract — implemented

В review contract добавлены `EntitlementAttestationV1` и
`effectiveEntitlementV1`. Attestation имеет фиксированные contract/authority IDs,
UUID attestation/account/operator, отдельную capability `premium|admin`, effect
`GRANT|REVOKE`, canonical UTC issued/expiry, evidence reference, decimal-string
sequence и exact predecessor. Это локальная модель утверждённого правила, не
доказательство защищённости строкового authority marker.

Predicate фильтрует exact account+capability scope, валидирует непрерывную цепочку
от sequence 1 без branch/gap/cross-scope predecessor, сортирует её независимо от
input order и считает SHA-256 lineage digest над canonical audit envelope. Future
grant/revoke не действует раньше `issuedAt`; expiry закрывает grant включительно;
effective revoke закрывает capability. Revoke сам не имеет expiry. Premium не
подразумевает admin и наоборот.

Legacy flags передаются только для явной причины `old-flag-unverified`; они никогда
не дают `allowed=true` и не оживляют expired/revoked grant. Любая invalid lineage
fail closed. Реальные protected storage/writer permissions, operator identity,
attestation persistence и server-clock enforcement всё ещё OPEN/deployed evidence.

### Первый runnable server patch — prepared, NOT APPLIED

Новая owner-supplied read-only staging evidence подтверждает: trusted Premium
provisioning channel и Edge Functions не найдены; public business security-definer
entitlement RPC отсутствует; authenticated имеет INSERT/UPDATE на profile flags;
Premium catalog RLS проверяет active content, не verified entitlement. `service_role`
bypasses RLS и поэтому явно исключён из provisioning authority. Эти факты уточняют
G1/G2; они не доказывают отсутствие неизвестного внешнего backend.

Первоначально был подготовлен runnable draft:
`drafts/20260921_trusted_entitlement_v1.sql`. SHA-256:
`9e2ff944103a2e15783529c13a82c61985e9ca3c790b6e9ce2c1c41378998b2d`. Patch:

- создаёт закрытую `potok_control.access_attestations` с account/capability scoped
  append-only grant/revoke lineage, exact predecessor, sequence, server time,
  expiry, database-session operator и evidence/reason audit;
- создаёт отдельные NOLOGIN/NOBYPASSRLS owner/provisioner roles. Provisioner получает
  только schema USAGE и EXECUTE двух routines; operator membership намеренно не
  выдаётся. PUBLIC/anon/authenticated/service_role не получают provisioning path;
- grant/revoke SECURITY DEFINER routines имеют `search_path=pg_catalog`, account
  advisory serialization и атомарно append audit + обновляют protected profile
  projection. Missing profile откатывает весь вызов;
- effective internal predicate проверяет полную continuous lineage и fail closed
  при gap/branch/error, expiry или revoke. Public wrapper принимает только capability,
  выводит account из `auth.uid()` и игнорирует legacy flags;
- сохраняет все profile rows, IDs и прежние flag values. Добавляет nullable provenance/
  expiry columns без backfill; old true остаётся unverified до новой attestation;
- снимает broad profile write privileges и выдаёт authenticated/service_role только
  ordinary column INSERT/UPDATE. Defense-in-depth trigger блокирует protected field
  change/echo и profile delete вне owner routine/account-erasure boundary;
- добавляет restrictive verified-Premium SELECT policy ко всем 8 catalog relations,
  сохраняя существующие active-content permissive policies, и снимает catalog DML/
  maintenance privileges у PUBLIC/anon/authenticated;
- не содержит operator binding, payment, service-role shortcut, user grant fixtures,
  Adaptive PLAN/FACT tables, legacy data rewrite или production operation.

Подготовлен rollback-only acceptance draft:
`drafts/20260921_trusted_entitlement_v1.acceptance.sql`. SHA-256:
`ecccca449d046c540cf83a7bb177bf9998e0398a0c000e68e306af8c2b977cae`.
Он требует три специально
выбранных staging test accounts с profiles и минимум один active catalog plan;
sentinel UUIDs заставляют preflight упасть до их явной замены. Cases: Free + old true
flag deny, verified Premium/catalog allow, expiry boundary, revoke/catalog deny,
admin без Premium, foreign-account isolation, protected profile columns, audit
lineage и service_role provisioning denial. Все fixture writes и temporary role
membership находятся в одной transaction с обязательным `ROLLBACK`. Acceptance
не запускался; PASS локально не заявляется.

### STAGING v1 apply failure и Supabase-compatible v2

Owner сообщил фактический результат STAGING apply attempt v1: Supabase migration
channel вернул `permission denied to alter role`, вся transaction откатилась.
После failure owner проверил полный rollback: отсутствуют schema/table
`potok_control`/`access_attestations` и роли `potok_entitlement_owner` /
`potok_access_provisioner`. Это owner-supplied staging evidence; локально DB не
подключалась. v1 hash выше сохранён только для incident traceability и больше не
является кандидатом apply.

Подготовлены новые точные v2 artifacts, **NOT APPLIED**:

- `drafts/20260921_trusted_entitlement_v2.sql` — runnable schema/function/RLS patch,
  SHA-256 `ffef9a7de1b1540a4511751614c170a1269bc16dc97c5e663c0475dda0065029`;
- `drafts/20260921_trusted_entitlement_v2.preflight.sql` — SELECT-only staging
  preflight, SHA-256
  `1028f9b45f8db7f06925e092ffaad7dcd877c053d9fc2e9152de05b3dded3412`;
- `drafts/20260921_trusted_entitlement_v2.acceptance.sql` — rollback-only actor
  acceptance, SHA-256
  `2b6f9bb156ad96dc8b9ec44a1d9d19a8dfdef42041de70d3354ee8582a203d2b`.

v2 не выполняет `CREATE/ALTER ROLE`, membership GRANT/REVOKE или object ownership
transfer. Внутри БД он обеспечивает закрытое append-only audit storage, отдельные
Premium/admin lineage, expiry/revoke fail-closed predicate, protected profile
column ACL+trigger, authenticated own-account read predicate и restrictive catalog
gate. Public v1 predicate сохраняется только как compatibility wrapper над v2 для
уже подготовленного runtime; legacy profile flags не участвуют в решении.

Provisioning routines не получают EXECUTE/USAGE для PUBLIC/anon/authenticated/
service_role. Они дополнительно требуют `SESSION_USER = CURRENT_USER = postgres`;
следовательно v2 поддерживает только существующий owner SQL channel. Кто имеет
доступ к Supabase Dashboard/migration owner session, журналирование запуска,
two-person review и отзыв такого доступа — внешний operational control, которого
SQL patch не может доказать или создать. Делегированный operator channel потребует
отдельного evidence/design; он не подменён client или service_role.

Acceptance использует только три заданных staging accounts: Free/old-flag
`d6eb4e97-90d0-470f-bc4a-2f3e401e1fde`, Premium
`88c26f6b-ebc8-4bff-864d-9194fbd27f8d`, admin
`8f82ff67-39d1-4bb1-9d55-028af99d5cca`. Для отсутствующих profile rows он условно
вставляет только `user_id` внутри той же rollback transaction; имена, контакты,
goals или privilege data не выдумываются. Известный existing profile второго
account не перезаписывается. Эти writes всё ещё требуют отдельного разрешения.

Перед staging apply нужны отдельные owner approvals и evidence:

1. Exact SQL hash + target staging apply window и rollback posture: любой apply error
   откатывает единственную transaction и требует повторной read-only проверки
   отсутствия v2 objects; после успешного COMMIT destructive down migration не
   применяется — paid access остаётся fail closed, затем выполняется reviewed
   forward repair с сохранением audit lineage.
2. Подтверждение, что apply и будущие ручные grant/revoke выполняются только через
   owner-controlled `postgres` SQL session; app/authenticated/service_role запрещены.
   Любое делегирование остаётся отдельным design/evidence checkpoint. Старые grants
   требуют независимого evidence перед новой attestation, mass backfill запрещён.
3. Совместимый client/profile-writer package уже подготовлен локально и должен быть
   review/deploy-ordered до security activation; deployment сейчас не выполнен.
4. Отдельное разрешение на rollback-only DB acceptance writes, exact three accounts,
   условные `user_id`-only fixture rows, capture/redaction и подтверждение active
   catalog fixture. Acceptance
   нельзя совмещать с production или реальными пользователями.

Даже после apply entitlement patch не включает Adaptive persistence: atomic PLAN/FACT,
canonical recipe evidence и остальные PARKED/OPEN gates остаются отдельными.

## 3. RPC и DTO semantics

Предлагаются mutate, lookup, read и history endpoints с версиями из SQL specification.
Имена PROPOSED, ни одного endpoint не создано. DTO request содержит contract version,
idempotencyKey, explicitConfirmation, expected account/instance/week/timezone,
plan/goal/history/diary revisions и tagged action. `expectedLocalSequence` не уходит
на сервер. Actual payload MODIFIED/EXTRA/EDIT содержит explicit food refs/decimal
quantities/units/state, без client authoritative nutrients или invented snapshot IDs.
Сервер разрешает canonical references и формирует immutable exact snapshot. Это
по-прежнему gated canonical evidence; DTO не делает dataset доступным.

AS_PLANNED — точная ссылка на reviewed graph snapshot. REPLACE — существующий
server-validated offer + expected slot revision; offer endpoint/validator ещё OPEN,
его нельзя заменить client-created recipe UUID. SKIPPED — annotation. RESTORE plan
slot — новая явно подтверждённая REPLACE; не переписывание истории. Activation,
Goal confirmation и Free manual diary transitions описаны отдельно, без скрытого
вызова из meal action. Никаких nutrition thresholds/formulas здесь нет.

Receipt accepted: authenticated account, operation ID, original key, digest/version,
resulting revision vector, confirmed slot snapshot refs и event IDs. Conflict/rejected
не содержат domain effect. UNKNOWN — timeout/нет доказанного outcome, не success
и не terminal rejection. Локальный strict raw decoder и canonical encoding/digest v1
теперь реализованы в review contract до transport. Это проверяет произвольный raw
JSON в локальных tests, но не доказывает будущую RPC/server interoperability.
Прежний synthetic canonical helper остаётся только fixture equality и не заменяет codec.

### Locking order — PROPOSED

После strict decode/authenticate брать transaction-scoped **account gate** первым:
advisory lock с фиксированным namespace и server-derived account key. Hash collision
может только лишний раз сериализовать, никогда не авторизует доступ. Для v1 это
намеренно coarse serialization, проще корректно согласовать diary/Goal/provisioning.
Потом: ledger account+key lookup/replay → profile/authority row → Goal row (если нужен)
→ instance rows по UUID → affected stream heads по UUID → diary rows по ID.
Unique(account,key) остаётся constraint; отдельный key lock не нужен под account gate.
Новый paid effect проверяет entitlement после gate/authority read; exact replay —
раньше новой entitlement/CAS проверки. Access revoke использует тот же gate:
grant/revoke и effect линейно упорядочены. Expiry проверяется по server clock после
ожидания locks, перед effect; долгий transaction не наследует stale request-start time.

Все cohort writers, Goal edits и provisioning соблюдают порядок; ни один сначала
не блокирует diary row, а затем account gate. Direct legacy diary/Goal DML cohort
блокируется до row work, не row-trigger lock после уже взятого row lock. Обычный
profile edit может менять только benign columns и не захватывает account gate;
authority changes проходят provisioning boundary. Batch — один actor;
cross-account batch в v1 отклоняется. Lock wait/deadlock/connection loss не разрешают
новый key: исходный outcome UNKNOWN до lookup/exact retry. Lookup остаётся read-only,
не создаёт gate/claim row и может увидеть not-observed во время in-flight transaction.
Atomic effect/event/projection/revisions/receipt сохраняется. Отказы business/CAS
могут commit только receipt; unexpected failure откатывает transaction целиком.

### Wire validation и decimal encoding — local contract implemented; server use PROPOSED

Версия 1 использует strict tagged field allowlists: неизвестные/missing fields,
duplicate JSON keys, некорректные enum/date/IANA timezone/UUID refs, nonfinite numbers,
foreign refs и неподтверждённые revisions отклоняются. Raw request требуется разобрать
**до** преобразования в jsonb (после него duplicate keys уже потеряны). Для будущего
RPC рекомендуется raw UTF-8 JSON text argument + reviewed duplicate-aware parser
в доверенной boundary; прямой RPC обязан иметь ту же проверку, не доверять клиенту.
Пока parser/transport evidence нет, endpoint не считается implementable/готовым.

Количество передаётся decimal **строкой**: ASCII `(0|[1-9][0-9]{0,5})(.[0-9]{1,2})?`,
где точка literal; значение >0. `1`, `1.0`, `1.00` нормализуются в `1.00` целочисленной
арифметикой scale 2. Reject exponent/sign/comma/whitespace/leading zeros/лишнюю scale,
а не округлять actual amount. Верхняя representable граница `999999.99` следует
из diary numeric(8,2), **не clinical limit**. `g`/`ml` и food state сохраняются;
conversion density не придумывается. Nutrients вычисляет сервер из verified source
точной decimal arithmetic, однократное rounding half-up до storage scale; overflow
reject, unknown не становится zero. Formula/canonical evidence остаётся PARKED.

Canonical business payload encoding v1: allowlisted keys в ordinal ASCII order,
arrays сохраняют order, нормализованные decimals, явные null/missing по tagged schema,
JSON string escaping по одной спецификации, UTF-8; никаких float round trips.
SHA-256 над version-prefixed canonical bytes + сравнение самих canonical fields,
не доверие client digest. Protocol ID тоже входит в payload: Free/paid запросы
не могут столкнуться как exact replay.

Локально реализован `decodeAdaptiveNutritionWireV1(raw)`: recursive raw JSON scanner
выявляет duplicate keys, включая escaped aliases, до полного `JSON.parse`; затем
strict allowlist/missing-field decoder строит новый DTO. В v1 проверяются tagged
action enums, календарные даты и Monday week anchor, canonical IANA timezone, UUID
для account/plan/idempotency/revision/slot/snapshot/food/offer/event refs. Actual
amount нормализуется целочисленно в scale 2 существующим decimal contract.

Canonical bytes — UTF-8 deterministic JSON envelope с явными
`encoding=potok-adaptive-nutrition-canonical-json-v1`, protocol ID и нормализованным
payload. Object keys сортируются ordinal ASCII, array order сохраняется, null
сохраняется, schema-required missing отвергается. SHA-256 вычисляется локально
Node crypto над этими bytes. Root allowlist отвергает client digest: он не входит
в доверенный DTO и не участвует в выборе результата.

Это локальная reference implementation вне production src. Не реализованы RPC/raw
text transport, server parser/hash interoperability, authenticated admission или
сравнение с deployed implementation; эти гарантии остаются OPEN.

### Expiry recovery

| Operation после expiry | PROPOSED behavior |
| --- | --- |
| Own history/FACT read | Доступен по auth actor; no Premium requirement; retained owned snapshots, не общий catalog browse |
| Lookup исходного key | Доступен без привязки к текущей неделе/timezone; read-only; отсутствующий outcome остаётся UNKNOWN |
| Exact replay accepted/conflict/rejected | Возвращает исходный receipt до новой entitlement/CAS проверки; не создаёт нового effect даже после смены Goal/active week |
| Тот же key с другим payload | Conflict; старый outcome не перезаписывается |
| Новый paid action/key | Denied без verified Premium; lookup не должен fall through в новую mutation |
| Own FACT correction/retraction после expiry | Разрешено через общий Free diary boundary: новый explicit intent/key, current event CAS, append-only supersession/retraction. Не требует Premium или current Goal/plan revision; PLAN остаётся прежним |

Receipt retention: PROPOSED хранить durable outcome/key tombstone в течение supported
history lifetime; cleanup не разрешает key reuse. Missing/not-found ledger row может
означать in-flight transaction. Exact retry сохраняет original payload/key/expected
revisions. Это не разрешает делать correction повторным использованием key старого
consumption: correction имеет собственный key и target event revision.

Free boundary принимает только CREATE_FACT/CORRECT_FACT/RETRACT_FACT, не plan actions,
offers или adaptation. Ownership/current event проверяются под account gate; stale
correction conflict. Linked FACT сохраняет original plan provenance; изменяются
FACT/history tokens, не graph/Goal/shopping. Standalone Free FACT не требует dummy
plan/selection: event.selection_id/source graph nullable, stream revision account
scoped. Ledger общий для Free и paid; accepted Free receipt содержит stream/event
result, без выдуманного plan revision. Correction legacy row сначала атомарно
сохраняет её точный original snapshot и stable ID в history; successor не дублирует
старую legacy contribution. Предварительный legacy read выдаёт server snapshot
precondition, который проверяется под lock; client fingerprint не authority.

### Restart recovery — PROPOSED, storage не включён

1. После explicit confirmation, **до dispatch**, durable versioned IndexedDB outbox
   transaction сохраняет account, contract, original key, exact normalized envelope,
   scope и state. Нет JWT/password в outbox. Если save не подтверждён, запрос не
   отправляется; fallback «новый key/только память» запрещён.
2. State `sent_unknown` сохраняется до network dispatch. Multi-tab coordination
   использует один durable intent; duplicate dispatch допустим только с тем же key/
   payload. После crash это UNKNOWN, не failure. Персональный payload не попадает
   в analytics/logs; origin isolation — не обещание защиты от XSS/доступа к устройству.
3. После повторной authentication показать только outbox текущего account; A→B→A
   карантинит A, не отправляет и не отображает его факты B. Сначала lookup original
   key, без rebase на новую неделю/Goal. Match terminal receipt → exact graph/FACT
   reconciliation, затем durable settled marker. Not-observed остаётся UNKNOWN;
   explicit retry сохраняет original bytes/key, не молча re-confirm новый payload.
4. Потеря/очистка outbox не означает, что операция не committed. Предлагается own
   read-only operation listing с revision-bound cursor для нахождения terminal
   receipts; он не доказывает отсутствие ещё in-flight запроса. Без достоверного
   соответствия intent/key блокировать повтор спорного действия и вести reconciliation,
   не угадывать outcome по graph/calories и не создавать replacement key.
5. **Owner-confirmed product behavior, 2026-09-21:** logout не удаляет серверный
   дневник; unresolved operations не исчезают молча и недоступны другому account.
   Account deletion — отдельный процесс удаления связанных данных, истории и
   локальной очереди, не обычный logout/undo. Retention сроки, backup retention и
   технический erasure protocol остаются OPEN (§9); подтверждение продуктового
   поведения не разрешает очистку outbox или запуск удаления сейчас.

### Read freshness и shopping

Current read берёт graph/Goal/history/FACT из одного server snapshot и указывает
coverage. Exact receipt read восстанавливает retained graph **и history projection
as-of receipt**, включая FACT snapshots: текущий effective diary не подставляется
под старую receipt revision. Graph может не измениться после consumption; нужны
отдельные history/diary tokens и event references. UUID revisions opaque клиенту.

Historical exact read подтверждает outcome, но не делает старую revision текущей.
Subsequent mutation всё равно CAS against current heads. Unseen successor proof
в v1 не выдумывается; при отсутствии exact state — not-ready/conflict, далее refresh
и новая explicit review. Synthetic proof matcher — проверка равенства fixtures,
не проверка происхождения server receipt и не готовый runtime adapter.

Shopping cache/selection = account+instance+confirmed graph revision. Предложение
replacement не меняет cache; подтверждённая revision требует соответствующего graph.
Diary/skip/extra actions не уменьшают следующие meals и не делают compensation.
Instance-scoped diary revision не является freshness token всего account diary:
глобальный Goal/Progress barrier потребует включить **всех** legacy writers.

## 4. Effective diary без double count и legacy bypass

Projection: legacy rows + компоненты live leaf FACT events. При EDIT предыдущий FACT
остаётся в history и исключается из totals; при UNDO leaf — retraction, ни один
предыдущий факт не «оживает». SKIPPED/REPLACE/annotations не создают diary components.
Один successor на event, same account/instance/stream/date, complete component set
и запрет cycles/forks — server invariants. Snapshot/receipt/component writes atomic.

**Недостаточно запретить UPDATE строки с marker.** Старый bulk-sync может прочитать
факт без новых metadata columns и прислать marker-free clone с другим id/key.
**PROPOSED: barrier включается только одним compatibility gate** с рабочим Free manual
endpoint, effective readers, проверенными writer adapters/queues и supported-client
переходом. До этого v1 activation и managed dates отсутствуют; нельзя отдельно
заблокировать дневник уже существующего Free пользователя. После включения retained
binding сохраняется при expiry/archive, а Free boundary остаётся доступной.

Для mixed bulk рекомендован простой безопасный v1 механизм: enrolled account cohort
пишет дневник только через новые Free/paid boundaries. Direct legacy statement для
такого account отклоняется **целиком до row work**, даже если пустой/затрагивает и
unmanaged даты. RLS row filtering недостаточен: может дать успешный DELETE 0 rows
или частичный результат. BEFORE STATEMENT guard определяет actor/cohort до row locks;
он возвращает явный `CLIENT_UPGRADE_REQUIRED`, не берёт lock после row update.
Scope этой временной account-wide меры шире managed dates, поэтому все manual dates
заранее поддержаны Free endpoint. Никаких частичных prefix writes или автоматического
разбиения одного legacy batch на новые intent keys. Multi-request старый bulk не
объявляется atomic; его dispatch должен быть остановлен при client transition.

Старый клиент может читать effective FACT, но не писать в enrolled account. Ошибка
не подтверждает sync: queue/cache сохраняются, показывается pending/upgrade-required.
Если старый build игнорирует server errors (как риск empty-day path в repo), сервер
не может заставить его честно показать failure: такой build исключается из activation
cohort до verified upgrade/session transition. Unknown external consumers блокируют
enrollment. Не заявлять «нет silent loss», опираясь только на будущую RLS policy.

Queue migration: сохранить immutable original payload/key и local IDs; сначала
lookup/reconcile ранее отправленное, затем explicit review оставшихся намерений.
Confirmed server facts не импортировать из cache как новые CREATE_FACT; rejected
bulk не очищать и не помечать synced. Смешанный batch проверяется целиком, либо
пользователь отдельно подтверждает новые независимые действия после reconciliation.
Profile queued ordinary edits получают allowlist payload, а cached privilege changes
quarantine/reject с уведомлением, никогда не provisioning. Не терять обычные profile
изменения вместе с запрещёнными flags.

Совместимый explicit Free manual diary endpoint должен сохранять обычный дневник,
включая managed dates, через тот же actor/history/projection boundary, не требуя
Premium за обычную фактическую запись. Нельзя автоматически пересылать старый cache
в этот endpoint как «новое намерение». Повторяемые действия используют key/receipt;
копию с новым key нельзя надёжно отличить от намеренно второй одинаковой еды только
по nutrition values. Server гарантирует protocol idempotency, не угадывает intent.

Для ordinary base-table reads предлагается owner+effective SELECT policy вместо
существующих permissive ALL/SELECT. History доступен отдельным own endpoint.
RLS change должен быть согласован с dedicated effective read API и privileged
analytics: privileged role может обходить RLS. Нельзя просто добавить permissive
policy — старое ALL останется обходом. Mixed bulk для cohort отклоняется целиком;
новая Free boundary возвращает receipt и точные affected IDs, не partial success.

Protected event/projection rows нельзя отвязать от event, переименовать в legacy,
изменить через old upsert или recompute helper. Existing canonical FK SET NULL
требует отдельной проверки с freeze guards: original food identity/nutrients уже
сохранены immutable snapshot; изменение lookup pointer не должно переписать FACT.
Canonical/recipe blockers остаются PARKED; исправления этих объектов не выполняются.

## 5. Repo consumers: targeted compatibility review

Это source-level observations текущего checkout; consumer code не изменён.
Unknown external clients/jobs/Edge Functions/old mobile builds остаются **OPEN**.

| Consumer / locator | Наблюдение → обязательный переход перед activation |
| --- | --- |
| `profileService.ts:282,347,440,482,504,546` | Create/default и pending/save upserts передают flags; ordinary payload должен их исключить, setter не заменяется «silent success». Pending queue нужно version/migrate без выдачи Premium из cache. |
| `AuthContext.tsx:120,133,650`; `adminAccessService.ts:37` | Flags питают UI/admin decisions; setter пишет is_admin. Нужен trusted server permission contract; UI bool не security authority. |
| `SubscriptionManagement.tsx:43,72`; `AdminPanel.tsx:151` | Прямые profile flag setters. Защита сломает текущий путь по проекту; payment не интегрировать, owner admin file не редактировать. Отдельный access UX/admin transition gate. |
| `programDeliveryService.ts:44`, `programUxRuntimeService.ts:55`, `Dashboard.tsx:96` | Tier/navigation выводятся из profile flags; учесть unverified/expired authority вместо повышения прав по старому значению. |
| `entitlementService.ts:33,45` | Calls get_entitlements/get_paywall_state, отсутствующие в owner inventory. Не объявлять их реализованным provisioning channel. |
| `premiumCatalogService.ts`; `premiumTodayAdapter.ts` | Read-only catalog/template graph. В production src не найден writer user_premium_plan/meal selections; ссылки находятся в guard tests. Это не доказательство отсутствия внешних writers. |
| `goalService.ts:270`; `programGenerationService.ts:89` | Goal upsert + local fallback/read. Semantic writes должны advance protected revision; local-only save не подтверждает server Goal/plan revision. |
| `mealService.ts:283,294,338,408` | Row lookup/insert/update и recipe snapshot insert. Будущий Adaptive action нельзя строить цепочкой этих calls; перейти на atomic boundary. |
| `mealService.ts:666,791,815,918,948,959,970,1213,1269,1367` | Raw SELECT, empty-day DELETE, stale-row DELETE, bulk upsert, edit/delete. Есть existing guard против bulk canonical/recipe entries, но empty-day/marker-free paths остаются compatibility risk. New event links должны сохраняться в mapper/cache; managed writes проходят explicit boundary. |
| `recipeDiaryService.ts:57` | Делегирует addMealEntry. Historical recipe snapshot не подтверждает versioned plan consumption; не выполнять private recipe atomic work. |
| `progressNutritionService.ts:395`; `analyticsService.ts:148` | Raw diary range totals. Требуется effective projection/consistent revision scope; первый файл входит в 229 owner baseline, изменения сейчас запрещены. |
| `progressAggregatorService.ts`; `uiRuntimeAdapter.ts` | Потребляют diary/Goal/cache через services; update/invalidation не должны смешивать old history rows, local pending и confirmed FACT. |
| `foodIngestionService.ts:352–365` | Вызывает recompute_food_entries_for_food_ids и читает diary dates. Helper отсутствует в exported function inventory; runtime call не доказывает deployed writer. Если такой writer появится/существует вне scope, он обязан исключать immutable snapshots. |

Targeted searches охватывали `src` calls к таблицам, profile setters и saveMealsForDate.
Локальные caches, indirect consumers и фильтры не эквивалентны protocol acceptance;
до rollout нужен consumer/version inventory и contract tests их реальных adapters.
229 baseline owner files остаются без изменений; future changes в них отдельно scoped.

### Уточнение известных flag paths — 2026-09-21, source only

Повторно просмотрены только участки уже перечисленных consumers, без общего аудита.
Это возможные пути записи в checkout, **не доказательство**, каким способом были
назначены старые flags или какие из этих writes действительно принял staging.

| Известный путь | Фактическое поведение в source и предел вывода |
| --- | --- |
| `src/pages/SubscriptionManagement.tsx:43,72` → `src/services/profileService.ts:495` | Выбор/отмена подписки вызывает `updatePremiumStatus(user.id, true/false)` → прямой `user_profiles.has_premium` UPDATE. `getSessionUserId` проверяет текущего пользователя; это account binding, не trusted issuer. Setter логирует remote errors без throw, UI затем может показать успех. Оплата/attestation этим не подтверждены. |
| `src/pages/AdminPanel.tsx:151` → `src/context/AuthContext.tsx:646` | `setAdminStatus(targetUser.id, ...)` напрямую UPDATE `is_admin` по переданному `id_user`; ошибки логируются. Это отдельный путь от scoped setter profileService. UI/admin check не заменяет server authorization; успешная межаккаунтная выдача здесь не доказана. |
| `src/services/profileService.ts:473` | Отдельный `updateAdminStatus` делает scoped UPDATE `is_admin` после `getSessionUserId`; наличие метода не доказывает его использование для прежних grants. |
| `src/services/profileService.ts:282,440` | Pending sync и saveProfile upsert повторно передают оба flags из cached/merged profile. Это путь повторной записи прежних значений, без provenance. Default/аватар INSERT (`:347,546`) явно передают false, не являются выдачей Premium/admin. |
| `src/services/adminAccessService.ts:37` | Только читает `is_admin`; название verify не означает проверку происхождения права. `entitlementService` RPC calls из карты выше также не доказывают provisioning. |

Owner использует разные аккаунты для проверок, но оператор grant/revoke и источник
старых прав не установлены: **flags остаются unverified**, независимо от UI/readback.
Известность владельцу только Supabase и отсутствие постоянных тестировщиков не
доказывают отсутствие внешних jobs/writers или сохранённых сессий/очередей.

## 6. Template origin и будущий Goal/Plan Engine

**PROPOSED рекомендованный вариант:** добавить `origin_kind` и сделать template FK
nullable по явному tagged invariant. `legacy_catalog` (v0) и `catalog_template` (v1)
требуют настоящего premium_plan_id; `generated` (v1) имеет NULL template reference,
server-reviewed generator version/config provenance и goal revision. Immutable
origin_lineage сохраняет прежние source selection/template IDs, когда они реально
существовали. Legacy IDs и их исходные FK не обнуляются массово и не переназначаются.
Generated-from-template может хранить этот template в lineage; primary origin остаётся
generated. Не связывать source selection другого account. Переход происхождения
создаёт новую reviewed instance/revision, не переписывает прошлую provenance.

Это позволяет будущему Goal/Plan Engine создавать weekly graph без dummy templates,
но не доказывает готовность генератора/canonical validation. Legacy 14-day duration
остаётся template metadata, не execution contract. Existing insert/update policies
с EXISTS(active template) требуют explicit branch по origin_kind с trusted validation
generated graph; ослабление до «template NULL значит разрешено» запрещено. Read DTO
возвращает kind+lineage; inner joins на template не должны терять generated instances.
Repo runtime selection writer не найден; unknown external NOT NULL/inner-join
consumers остаются evidence blocker, а выбор внутреннего SQL owner не предлагается.

## 7. Compatibility, future rollout и rollback plan

Это порядок будущего отдельно разрешённого внедрения, не выполненные шаги.

1. До runnable patch: resolve evidence/owner items ниже, trusted authority, versioned request
   decoder, role/permission graph, all consumers и exact history read mapping.
   Согласовать rollout owner files, backup/restore evidence и account erasure policy.
2. Expand additive structures с legacy version 0, no automatic conversion/import.
   Provisioning остаётся deny/unverified, UI/network writes OFF. Validate existing
   data/FK/defaults до constraints; никаких выдуманных backfill dates/revisions.
3. Deploy compatible consumers и protected profile payloads; удалить sensitive fields
   из queued upserts. Harden grants/RLS/protected writer path отдельным reviewed patch.
   Не включать paid reads на self-editable flags даже временно.
4. После разрешённых DB acceptance tests — единый compatibility gate: Free manual
   endpoint, effective readers/writers, queue migration и supported builds готовы
   прежде, чем account enrollment включает version 1 и managed-date barrier.
   Unknown old consumers блокируют activation, а не получают write bypass.
5. Monitor revision conflicts/unknown outcomes/partial projections без записи
   confidential payloads в логи. Не делать automatic retries с новым key.

Rollback до первых v1 effects: оставить additive tables/columns dormant и flags
unverified; отключить new entry points. Не снимать security protection ради возврата
старых setter payloads; обновить совместимый UI/queue. Никаких destructive down scripts.

Rollback после v1 effects: остановить новые paid effects/activation; сохранить
own Free correction/retraction/history, lookup/exact replay и effective reads.
Если общий diary writer неисправен, временно fail closed с сохранением очереди,
а не включать legacy bypass. Не откатывать clients к raw-history
totals/bulk overwrite. Receipts, event IDs, snapshots и key tombstones сохраняются;
не replay операции в legacy diary. Повреждённую projection чинить позже отдельно
разрешённой сверкой с immutable events; не удалять FACT историю для «сброса».
Database restore должен согласованно восстановить graph+ledger+history+diary; restore
только одной таблицы/старого receipt ledger может нарушить idempotency и недопустим.

## 8. Synthetic checks и future DB acceptance

Локальные tests покрывают protected profile payloads, unverified/expired access,
same-key replay/mismatch, foreign account, UNKNOWN lookup, stale vectors,
effective edit/undo/skip/extra, fork/orphan/component errors, managed legacy writes
и exact receipt graph+FACT matching. Они используют trusted synthetic inputs,
не auth tokens, DB locks, SQL parser, migration или production client integration.
Existing PLAN/FACT/recovery tests сохраняют coverage graph/shopping и timeout races.

| Future DB acceptance (НЕ запускалось) | Требуемое доказательство |
| --- | --- |
| Actor matrix: unauthenticated, Free, verified Premium, expired, another account | Direct tables и все endpoints deny/allow по contract, including refs/lookup; никакой утечки чужих IDs/history |
| Profile INSERT/UPDATE/UPSERT/DELETE + inherited privileges | Set/clear/echo flags/provenance и recreate запрещены, ordinary profile edits работают; старые true flags не открывают paid endpoint |
| Bootstrap/provisioning | Только reviewed trusted channel может attest/revoke с audit; protected fields не доступны client GUC/JWT metadata spoof |
| Same key parallel, same/different payload | Отдельные DB sessions: один effect/receipt, одинаковый outcome для exact replay; mismatch не перезаписывает receipt |
| Different keys, same expected versions | Ровно один conflicting transition succeeds; другая conflicts; no lost update, stable lock order/deadlock handling |
| Failure injection между всеми transaction этапами | Нет половины graph/event/components/receipt; unexpected failure rollback; deterministic refusal только receipt |
| Lost response before/after commit, reconnect/reload | Crash до/после durable save, dispatch и receipt; multi-tab original-key replay; A→B quarantine; lost outbox/listing не превращается в новый key или success |
| Expiry race + replay old week/timezone | Новые paid effects denied согласно agreed decision instant; old receipt/history recoverable; no paid fallback из lookup |
| Edit/undo and projection | One head, no fork/cycle/resurrection, complete components; direct base SELECT/effective API/Progress дают согласованные totals без double count |
| Legacy bulk/delete/upsert/cache clone | Managed date/OLD+NEW marker enforcement; целостность mixed statements; Free explicit manual entry остаётся доступной через совместимый endpoint |
| Graph/Goal/calendar changes | Authoritative revisions advance; explicit activation, local week boundaries/DST; changed snapshot under same revision rejected |
| Receipt exact read + newer head | Retained historical graph AND FACT as-of receipt; newer head never overwritten; incomplete/page mismatch not reported complete |
| Catalog and optional helpers | Free catalog denial, verified catalog allow; recompute/import/FK SET NULL cannot silently rewrite retained facts; parked dependencies need separate authorization |
| Retention/rollback/account erasure | Ledger/event/projection restore together; no key reuse, no orphan history; approved erasure exception isolated from normal undo |
| Free correction после expiry | Own live event CAS без paid/Goal gate, cross-account и stale reject; linked graph/shopping неизменны; legacy seed+successor atomic и без двойного учёта |
| Generated origin и strict wire | Generated NULL template не исчезает на joins и не обходит policies; preserved legacy lineage; duplicate raw keys/exponent/overflow/unknown fields rejected до jsonb/digest |

Future tests требуют отдельного review exact staging fixtures, actor setup, cleanup/
retention plan и разрешения на writes. Этот пакет не создаёт fixtures и не использует
service role. Будущий behavioral report должен указать deployed build/patch hashes;
текущий локальный PASS нельзя представить как server guarantee.

## 9. Consolidated recommendations, evidence и owner checkpoint

Все варианты остаются **PROPOSED**, не APPROVED. Ниже P01–P11 сохранены для traceability,
но владельцу не нужно выбирать lock primitive, названия SQL roles или форму индексов.

| Ref | Техническая рекомендация | Незакрытый evidence blocker |
| --- | --- | --- |
| P01 | Existing selection → immutable weekly binding; preserve legacy IDs | Data/consumer compatibility до runnable patch |
| P02/P08 | Column allowlist + owner-SQL-only provisioning functions and attestation audit; no custom-role dependency, old flags unverified | Owner SQL operational controls and future delegation evidence; authenticated/service_role remain excluded |
| P03 | Free own FACT read/correction/retraction после expiry; exact replay перед paid admission | Реальные actor/expiry/cross-account tests будущего endpoint |
| P04 | Один rollout gate Free endpoint + effective readers/writers + queue transition + cohort barrier; whole-statement legacy rejection | Supported build/queue transition и внешние consumers |
| P05 | Exact receipt graph+FACT/history reads; stream token для Free, instance token для linked facts | Full raw decoder/read-snapshot evidence; глобальную diary revision не обещать без всех writers |
| P06 | origin_kind + nullable template для generated; immutable lineage | Generated graph validator, external nullable/inner-join compatibility |
| P07 | Durable pre-dispatch outbox, original-key lookup, no guessed success/key recreation; keep unresolved state | Storage crash/multi-tab tests и policy retention/account erasure |
| P09 | Canonical validation/offer contract fail closed | Canonical export/recipe atomic metadata/expansion **PARKED**, не снимать |
| P10 | Targeted repo map сохранён, no unknown-consumer bypass | External jobs/Edge Functions/old clients/privileged helpers inventory **OPEN** |
| P11 | Отдельный future DB acceptance/apply checkpoint после reviewed complete package | Реального server behavioral evidence нет; fixtures/writes сейчас не разрешены |

### Ответы владельца и закрытые вопросы — 2026-09-21

- **CONFIRMED context:** проверки на разных аккаунтах; проект в разработке, массового
  запуска и постоянных пользователей/тестировщиков нет, были просмотры по ссылке.
  План перехода не требует выдуманной массовой миграции пользователей. Это не
  подтверждение пустой БД, отсутствия старых клиентов/очередей или внешних writers.
- **APPROVED product behavior:** logout сохраняет серверный дневник; unresolved
  operations не исчезают молча и недоступны другому аккаунту. Account deletion —
  отдельный процесс удаления связанных данных, истории и локальной очереди.
  Эти продуктовые вопросы закрыты и не требуют повторного подтверждения.
- Остальной schema/RPC/roles/DTO design остаётся **PROPOSED, не APPROVED**.

### Что осталось OPEN — не новый круг design review

| Boundary | Недостающий ответ/evidence | Что блокирует |
| --- | --- | --- |
| Authority (P02/P08) | STAGING v2/v2.1/v2.2 и rollback-only acceptance подтверждены; канал остаётся existing postgres owner SQL. Нужны operational review/audit controls для реальных grants; любое делегирование требует отдельного evidence/design. | Production rollout/provisioning operations; старые flags не считать verified. |
| Consumer transition (P04/P10) | Подтверждённый inventory внешних writers/jobs и проверенный переход реально используемых builds/queues. Owner знает только Supabase; отрицательное evidence отсутствует. | Enrollment/barrier и activation; не блокирует изолированные локальные contract helpers. |
| Retention/erasure (P07) | Сроки хранения, backup retention, технический erasure protocol, включая офлайн устройства и unresolved outcomes. | Реальный purge/account deletion, cleanup/TTL и обещания полного erasure; logout semantics уже утверждены. |

Не нужно снова выбирать внутренние SQL детали или утверждать весь design. Эти
операционные сведения нужны перед соответствующим server/rollout шагом; сейчас
не требуются secrets, новый metadata export или DB-доступ. Отдельное разрешение
на будущий конкретный DB test/apply пакет остаётся обязательным позже.

### Bounded lifecycle package — реализован локально

Реализованы pure `reduceLifecycleSynthetic` и `lifecycleDecisionSynthetic` поверх
существующего `restartLookupSynthetic`; второй outbox не создан. State хранит
активный account, один UNKNOWN intent и account-scoped pending erasure markers.

Фактическое поведение:

- logout меняет только active account и сохраняет UNKNOWN intent, original key и
  canonical envelope;
- A→B возвращает только `{ kind: 'quarantined' }`, без account A, payload или key;
  B→A возвращает только lookup original key после прежней integrity validation;
- authenticated erasure request добавляет идемпотентный pending marker. Для этого
  account decision становится `blocked-erasure-pending`; intent не очищается;
- reducer не имеет deletion-completed/purge event. Неизвестное событие отклоняется,
  поэтому pending request нельзя локально превратить в доказательство erasure.

Изменены ровно ранее заявленные четыре paths: DTO helper, targeted test, этот draft
и resume. Это исполнимая только в локальных synthetic tests модель: IndexedDB/
localStorage, auth hooks, runtime imports, transport, server deletion/provisioning
и persistence activation не добавлены. Сроки и erasure protocol не придуманы.

Targeted contract file: **20/20 PASS**, включая два новых lifecycle cases. Strict
TypeScript и targeted ESLint для двух TS файлов **PASS**. Broad/build не запускались:
runtime не изменён. Synthetic PASS не подтверждает durable storage, реальное logout
behavior приложения, server erasure или другие серверные гарантии.

## Local verification

Supabase-compatible v2 preparation **2026-09-21**: three new SQL artifacts above
received static-only checks. Migration contains 8 functions and every function has
fixed `search_path=pg_catalog`; executable SQL contains no CREATE/ALTER/DROP ROLE,
membership changes or provisioning EXECUTE grants to client/service roles.
Preflight is SELECT-only. Acceptance contains the three exact UUIDs, one BEGIN,
one final ROLLBACK and no COMMIT; its conditional profile fixture supplies only
`user_id`. Dollar tags and transaction shape are balanced. No PostgreSQL parser,
preflight, apply, fixture, role switch, acceptance case or live DB access was run;
these checks are not server guarantees. The v1 staging failure and full rollback
verification are owner-provided facts, not a local execution result.

Trusted-entitlement server draft pass **2026-09-21**: runnable patch and rollback-only
acceptance artifacts prepared, hashes recorded above. Static review **PASS** for
transaction endings, balanced dollar tags/parentheses, fixed search paths on all
5 definer and 2 invoker-trigger functions, and absence of provisioner membership.
No PostgreSQL parser/server, SQL execution, role change, fixture write or acceptance
case was run; syntax/behavior remain staging evidence gates. App tests/build were
not run because this package changes only SQL/docs outside runtime.

Trusted-entitlement contract pass **2026-09-21**: **30/30 targeted synthetic tests
PASS**, включая 6 новых cases: verified Premium grant, expiry, deterministic revoke
lineage, оба old true flags unverified, cross-account isolation и admin/Premium
separation. Strict TypeScript **PASS**, targeted ESLint `--max-warnings 0` **PASS**.
Только local contract/tests и эти notes; payment/runtime/DB/RLS не подключены.
Final diff/baseline/index checks записаны в resume; broad/build не запускались.

Strict wire/canonical v1 implementation pass **2026-09-21**: **24/24 targeted
synthetic tests PASS**, включая 4 новых cases для duplicate keys, malformed tagged
fields/refs, exact decimals и deterministic SHA-256/canonical semantics. Strict
TypeScript **PASS**, targeted ESLint `--max-warnings 0` **PASS**. Только contract
helper/tests и фактические notes изменены; runtime/transport/server не подключены.
Broad suite/build не запускались по bounded scope. Финальные diff/baseline/index
checks записаны в resume.

Bounded lifecycle implementation pass **2026-09-21**: **20/20 targeted synthetic
tests PASS**, strict TypeScript **PASS**, targeted ESLint with `--max-warnings 0`
**PASS**. Реализованы только pure state/reducer/projection и два risk-focused tests;
нет storage/transport/auth/runtime integration. Финальные diff/baseline/index checks
зафиксированы в resume. Broad suite/build не запускались по согласованному scope.

Owner-response documentation pass **2026-09-21** (после completion pass ниже):
изменены только этот draft и resume; уточнены участки существующей consumer map.
Проверки этого прохода — diff/links, 229 owner hashes/statuses и пустой index.
Tests, lint, broad suite и build в этом проходе не запускались; результаты ниже
относятся к предыдущим запускам. Предложенный lifecycle package не реализован.

Completion pass **2026-09-21**: requested refinements confirmed in the current six
package files; no implementation rewritten. Fresh **18/18 synthetic contract tests
PASS**, standalone strict DTO/tests TypeScript **PASS**, targeted ESLint
`--max-warnings 0` **PASS**. Six-file diff/whitespace/relative links and comment-only
SQL check **PASS**; **229/229 baseline owner hashes unchanged**, index empty.
These are local draft checks, not evidence of deployed server behavior.

Earlier recorded runs below were **not repeated** in this completion pass; no
runtime or implementation change justified another broad suite/build/full lint:

- Focused: **57 PASS**, включая 18 synthetic cases и existing PLAN/FACT/recovery.
  Добавлены только 4 risk-focused cases: Free correction/replay isolation, wire
  decimals/field injection, restart key preservation и whole mixed-bulk rejection.
- Broad: **153 files / 1178 PASS / 0 failed**. Один live diary integration test file
  намеренно исключён; он не запускался и не считается PASS.
- Draft DTO/tests strict TypeScript check **PASS**; build **PASS**.
- New files lint **PASS**. Full lint: 121 existing errors / 491 warnings;
  сравнение с recovery baseline не добавило diagnostics. Full lint не объявляется PASS.
- SQL draft проверяется как полностью comment-only; ничего не исполнялось.
  Нет runtime imports из drafts. Diff/links и 229 owner hashes проверены.

Bounded lifecycle, strict wire/canonical v1 и trusted-entitlement packages завершены
локально. Следующий server/rollout/purge шаг остаётся
за соответствующим OPEN evidence и отдельным owner scope; не переходить автоматически к runnable migrations,
real DTO transport или persistence. Canonical export / recipe atomic metadata /
recipe expansion остаются PARKED; payment OUT OF SCOPE; browser gap сохранён.
No SQL execution, DB/RLS writes, previous CLI path, push/deploy or production activation.

## 10. Bounded persistence v1 implementation package — prepared, not applied

Точный runnable draft разделён на migration, SELECT-only preflight и rollback-only
acceptance. Migration развивает существующие `user_goals`, personal selection и
`food_diary_entries`; legacy rows получают только `contract_version=0`, новые opaque
goal revisions и nullable projection links. Legacy IDs/values не конвертируются в
план, FACT или synthetic dates. Generated origin использует nullable template ref,
real goal link и explicit lineage; template dummy не создаётся.

Новые storage concepts: immutable full graph revisions, account-key operation
receipts и append-only nutrition events. Selection head связывает plan/goal/history/
diary revisions; weekly graph требует ровно семь уникальных дат от локального
понедельника до воскресенья. IANA timezone проверяется по server catalog. Existing
meal selections остаются legacy и блокируются от direct mutation под v1 parent.
Protected diary links используют существующую diary таблицу и не создают второй
дневник.

`potok_nutrition.commit_prevalidated_plan_transition_v1` задаёт один transaction
boundary: account gate → original-key replay/mismatch → verified Premium admission →
selection/Goal CAS → graph/event/head/terminal receipt. Он поддерживает только plan
transition/annotation foundation, имеет fixed search_path и не выдан ни одной app
role. Это внутренний вход **после** будущего server raw decoder; он не доверяет
runtime client потому, что runtime вообще не может его вызвать. FACT/component
projection, public mutation decoder, activation/bootstrap и managed-date barrier
остаются fail closed.

Read-model/lookup functions подготовлены, но их EXECUTE также отозван у PUBLIC,
anon, authenticated и service_role. Exact lookup сохраняет original account+key;
exact read берёт revision refs из terminal receipt и не требует нового paid effect.
Current read требует effective Premium. Runtime transport/imports не добавлены.

Artifacts:

- `drafts/20260921_adaptive_nutrition_persistence_v1.sql` — runnable, not applied;
- `drafts/20260921_adaptive_nutrition_persistence_v1.preflight.sql` — SELECT-only;
- `drafts/20260921_adaptive_nutrition_persistence_v1.acceptance.sql` — final ROLLBACK;
- `../../scripts/contracts/adaptive-nutrition-persistence-sql-v1.test.ts` — static
  scope/security/transaction checks, не server guarantee.

Следующий owner checkpoint: review точных hashes и отдельно разрешить только
SELECT-only STAGING preflight. По его output подтвердить compatibility base schema,
external dependencies и отсутствие adaptive objects. Лишь затем нужен отдельный
approval exact migration hash и rollback window. После apply — отдельное разрешение
rollback-only acceptance. До нового пакета не выдавать runtime EXECUTE и не включать
v1 enrollment. Canonical/recipe blockers, external writers, FACT effective projection
и raw server decoder по-прежнему блокируют реальную PLAN/FACT mutation activation.

## 11. Runtime read/lookup + bounded PLAN mutation activation — prepared, not applied

Owner-confirmed STAGING evidence now records persistence v1 as applied, structural
acceptance PASS and unchanged behavioral acceptance SHA-256
`eb4bd86563a4c13e3462fb82b9c1491cd77eb4ac4837d751420f2d32805a137e`
as PASS through final rollback. The reported SELECT-only postcheck is clean across
operations, graph revisions, events, profiles, Goals, selections, diary rows,
attestations and behavioral markers. Production remains untouched.

The browser-safe codec in `src/utils/adaptiveNutritionWireV1.ts` is now the shared
implementation behind the existing synthetic contract decoder and the new runtime
service. It scans original JSON text for duplicate keys before object decoding,
validates the strict DTO, normalizes decimal strings without float conversion,
creates versioned canonical bytes and computes local SHA-256 through Web Crypto.
The runtime sends raw text only; it never sends a digest for server trust.

`src/services/adaptiveNutritionPersistenceService.ts` adds an authenticated service
boundary for own-key lookup, Premium current read, receipt-bound exact read and the
three non-FACT actions `REPLACE`, `SKIPPED`, `UNDO_ANNOTATION`. Session-generation
tokens and before/after `getUser()` checks reject A→B→A late responses. Exact reads
require an accepted own receipt and match all four authoritative revisions; current
and exact responses also bind selection, graph plan/Goal revisions and operation ID.
FACT actions are rejected before transport.

The runnable review draft
`drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql` is **NOT APPLIED**;
SHA-256 `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`.
It grants only authenticated EXECUTE on the existing own-account lookup/read RPCs
and a new raw-text mutation RPC. The server parses as `json`, recursively rejects
duplicate keys before the only `jsonb` conversion, enforces exact field sets and
auth.uid-derived account, reconstructs the same canonical envelope and computes
SHA-256 itself. Original settled replay occurs before entitlement/head checks;
new effects still pass the existing Premium gate and plan/Goal/history/diary CAS.

`PLAN_REPLACED` cannot accept a client graph. It consumes an immutable, private
validated offer linked to the owned selection and expected revision vector. This
package creates no writer/grant for those offers, so replacement remains fail closed
until a separately reviewed plan engine validates canonical recipe/food evidence.
`ANNOTATION` reads the dated slot identity from the trusted current graph;
`ANNOTATION_RETRACTION` can only supersede a live owned annotation. All events have
an empty component manifest. FACT/component projection and diary writes stay off.

Local tests cover codec reuse, duplicate rejection before transport, absence of a
client digest, server-digest comparison, account isolation, CAS/entitlement error
mapping, exact reads after entitlement loss, current-read denial and A→B→A stale
responses. SQL contract tests are static evidence only; a PostgreSQL parser and live
STAGING behavior remain separate gates. Runtime code is present but unusable against
STAGING until the exact activation SQL receives separate owner approval and passes a
new rollback-only acceptance. No Supabase call or SQL execution occurred here.
