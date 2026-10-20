# P5-04 — восстановление линии и критерии первого ручного теста генерации

Дата аудита: 2026-10-20. **AUDIT / DESIGN ONLY**. База `master`: `0aa643850497f4398b8b44fb087b1c31fb92ac4c` (merged PR #177). Ни один P5 PR не объединён и не развёрнут в ходе аудита. Не выполнялись SQL, изменение Supabase, активация flags, сборка генератора, deploy либо ручной UI smoke.

## Продуктовая цель

В тестовом приложении «Мой Поток» владелец с **серверно подтверждённым** тестовым доступом запрашивает недельное меню, наблюдает реальный статус задания и получает **проверенный персональный план** со связанными рецептами, порциями и достоверными КБЖУ. В случае сбоя может восстановить *тот же* запрос, не создавая второй план. Это **цель P5-04**, не утверждение о текущем результате или обещание даты. `PLAN != FACT`: отображение/получение плана не означает подтверждения фактического употребления пищи.

Исходный план в `POTOK_MASTER_INVENTORY_TRANSFER_2026-10-12` определял P5-04 как «Доставка и восстановление собственного плана — Reviewed protected channel/worker + accepted runtime integration; durable statuses/receipts, auth/gateway/isolation/end-to-end; отдельные apply/deploy решения». P5-05 — последующие действия/замены/покупки и FACT. Ручная проверка на P5-04 достижима лишь при выполнении нижних условий.

## Инвентаризация сохранённых работ — проверено по GitHub

| Пакет | PR / head | Фактическое содержание | Текущий статус / ограничение |
| --- | --- | --- | --- |
| P5-01 | #161 / `cd90d5e` | read-only `pending_generation` в «Моём Потоке», строгий `week_anchor` | Draft, не merged; без generation/Edge/flags/browser smoke |
| P5-02 | #162 / `af65d4d` | business/technical/UNKNOWN outcomes и recovery, disposable PostgREST acceptance | Draft, не merged; SQL repair не применён, нет mutation UI deploy |
| P5-03 | #163 / `dc3ed6e` | привязки источника яблока, проверка творога/углеводов | Draft, не merged; generic curd NO-GO, real evidence issuance и recipe assembly отсутствуют |
| P5-03B | #164 / `b4b76b7` | пилот «овсянка с яблоком»: источники овса и воды | Draft поверх ветки #163, не merged; вода — source candidate, не server-approved binding; выход/порции требуют фактической готовки |
| P5-03C | #165 / `611d894` | отдельный *неактивный* issuer для `approved_non_food`, immutable history, CAS и recovery | Draft поверх Food Evidence #154, не merged; disposable PostgreSQL acceptance PASS, retention не утверждён, фактический review воды не выпущен |
| Core #170 | #169, #175, #176, #177 | контракт КБЖУ, evidence resolver, reviewed chain и atomic read port | Merged; **нет** настоящего Supabase storage adapter, подтверждений живых данных или diary write gate |

Проверенные PR #161–163 имеют base `master`, PR #164 base — ветка #163, PR #165 base — ветка Food Evidence #154. GitHub API на дату аудита помечает #161–165 как открытые Draft. Метка `mergeable` не является подтверждением отсутствия семантических конфликтов или пригодности к применению после изменения `master`. Нужен fresh review каждой dependency chain. Не копировать PR #164/#165 «как независимые готовые функции».

## Серверная генерация: текущий фактический разрыв

В `master` есть `supabase/functions/adaptive-nutrition-generate-v2/index.ts`, но entrypoint **явно содержит** `generator = null` и `validator = null`; он обслуживает узкий authenticated request/status contract, не выполняет генерацию/сохранение готового Graph. Документ `docs/premium/adaptive-nutrition-protected-execution-channel-v1.md` имеет статус `LOCAL REVIEW PACKAGE READY / NOT APPLIED / NOT DEPLOYED / GENERATOR OFF` и фиксирует отсутствие связанного защищённого worker/gateway. Исторический STAGING acceptance отдельных SQL/Graph контрактов не равен продакшен-развёртыванию нового генератора. В `src/services/adaptiveNutritionPersistenceService.ts` есть отдельные `VITE_ADAPTIVE_NUTRITION_RUNTIME_V1` и `VITE_ADAPTIVE_NUTRITION_READ_V1` gates: нельзя поднимать их для обхода отсутствующего server authority.

`src/services/aiMealPlansService.ts` умеет ставить записи в очередь и менять статусы, но **не доказывает**, что существует защищённый worker, использующий Graph V2, проверенные ревизии, доступ Premium и атомарное сохранение. Не подменять P5-04 этой очередью. `programGenerationService.ts` относится к другому контуру программ; он не доказывает end-to-end генерацию питания.

## Порядок следующей реализации: конкретные ворота

1. **Rebase/diff review P5-01 и P5-02** относительно нового `master`: затем isolated CI, browser pending-state smoke; отдельно проверять wire `PT409/PT500/40001/UNKNOWN`, не применять SQL repair без разрешения.
2. **Один публикуемый реальный пилотный рецепт**: закончить источники/привязки исходных ингредиентов; необходимы independently authorized evidence issuance (в том числе для воды, если она в рецепте), измеренный выход, порционность, immutable recipe revision/manifest, food safety, eligibility. Подготовленные source candidates сами по себе не считаются APPROVED. Если физический yield ещё неизвестен, использовать честный BLOCKED статус, не выдумывать servings. Решить retention до rollout #165.
3. **Protected request/worker/gateway**: под проверенным account/premium admission закрепить `generation_request_id`, scope, week/timezone, goal/graph/catalog/policy authority, idempotency key/digest, durable `pending/running/ready/failed/unknown`. Серверный worker генерирует *только* по утверждённым версиям; отдельно независимо валидирует; запись/активация через узкие DB routines в атомарном auth/currentness/entitlement boundary. Не выдавать `ready` до подтверждённого commit/receipt. Ошибки и UNKNOWN возобновляются по прежнему ключу, без второго плана.
4. **STAGING end-to-end**: отдельное owner-approval для точных SQL/RLS/grants, Edge deploy, тестовых аккаунтов/recipe publication/flags. Acceptance с actor isolation, forged JWT/payload denial, expired Premium, concurrent clicks, double workers, timeout-after-COMMIT, revocation/supersession, no unverified ingredients, read-back and reproducible rollback. Никаких live write тестов без отдельного разрешения.
5. **Owner hands-on smoke**: тестовый Premium, настоящая кнопка запроса, статус, готовое меню, просмотр ингредиентов/порций/КБЖУ; повторный запрос и recovery; неизменность дневникового FACT. Вызов backend должен быть реальным, а не hard-coded/demo simulation.
6. **P5-05 позже**: отметки «Съел», замены, покупки и автоматический FACT остаются отдельными задачами и не входят в минимальный smoke P5-04.

## Решение по приоритету

Двигать **P5-04 как продуктовый критический путь**, выполнять блокирующие части #170 только по необходимой зависимости. Не объявлять Issue #170 закрытым и не обещать ручной test launch до прохождения gate 2–4. Следующая работа — детальный conflict/security review P5-01/P5-02 и отдельная source-to-publish матрица одного пилотного рецепта. Код изменения и каждый merge — только по явному review/approval.

## Сохранённые границы

Это документ аудита в отдельной ветке; он ничего не реализует в приложении. Нет SQL/DDL, Supabase mutations, runtime activation, Edge deployment, секретов, настоящих user food data или merge. Изолированный Draft PR не является разрешением на production rollout.
