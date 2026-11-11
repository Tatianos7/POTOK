# S2: исключение конкретных блюд и проверяемые границы качества

## Законченный сценарий

Нежелательное блюдо в выданной неделе → явное исключение → новый серверный подбор без этого ID → сохранение → повторное открытие недели с теми же исключениями. Исключённое блюдо не просто скрывается в UI: оно удаляется из входного пула до анализа вместимости и actual bounded selection/refinement. Существующая сохранённая неделя не меняется, пока владелец явно не сохраняет новый результат. Можно снять исключения либо открыть старый черновик и восстановить его scope.

Границы: это только точные recipe IDs, не ингредиентные исключения, аллергенная или диетическая безопасность. Имена/теги не превращаются в reviewed metadata. Не более 28 уникальных IDs, ограниченный ASCII формат; неизвестный ID отклоняется. Вход копируется/канонизируется до async, результат и client request связываются с тем же набором. Идентичный/prefix recipe name не используется как matcher. Исключённые рецепты запрещены в возвращённой неделе также клиентским decoder. Дополнительно client фиксирует live cap не более двух повторов. Допуск ±50 и source servings=1 не меняются. Невозможность составить неделю не запускает ослабление ограничений.

API принимает прежние target/weekStart и optional excludedRecipeIds. Возвращает scope `EXPLICIT_RECIPE_IDS_ONLY_NOT_ALLERGEN_SCREENING` и только названия/ID исключённых рецептов вместе с деталями выбранных. Полный private catalog не выдаётся. Старые сохранённые reference snapshots без exclusions читаются как пустой набор; новые сохраняют exact scope.

## Что показывает качество

Сводка считает разные recipe IDs и проверенный cap повторов; показывает фактический дневной диапазон Б/Ж/У исходника/клетчатки. Это не медицинская рекомендация и не заявление соответствия персональным БЖУ. Питательные значения по-прежнему справочные. Формулы Goal, исходные recipes и nutrition не изменены.

Для 2000 исправлено противоречивое сообщение: bound checker подтверждает нехватку для выбранного недельного минимума; viewer не дописывает к этому «не доказано по всему каталогу». Показаны required minimum и optimistic available maximum, без ложного глобального утверждения вне текущих целых порций/повторов/каталога.

В baseline каталоге: 122 numeric reference recipes, распределение LUNCH57/BREAKFAST35/SNACK29/DRINK1. При 2000 и текущем cap2 нужно минимум 1950×7=13650 ккал, optimistic weekly maximum=12536.4. Добавление циклов поиска не устранит этот доказанный дефицит. Portion scaling/новые продукты/ослабление повторов не вводились без решения.

## Что остаётся в S2

Полный S2 НЕ завершён: персональные min/target/max БЖУ и текущие Goal/policy revisions не связаны с этим reference endpoint. Старый goalService допускает локальный fallback и zero coercion; его результат нельзя молча превратить в независимо admitted GoalNutritionTargetV1. Существующие decodeGoalNutritionTargetV1/validateDaySnapshot и goal preparation source переиспользуются на trusted пути после нужных bindings, не подменяются новыми рекомендациями.

Следующие связанные задачи: подключить актуальную цель и согласованные диапазоны без изменения формул; reviewed аллергенные/диетические/portion inputs; решить покрытие 2000 подтверждёнными порциями/достаточным каталогом. Это зависит от качества/допуска источников S3 и точного серверного пути S4. До cooking/review можно продолжать код, тесты и reference сценарии; неизвестные граммы не придумывать и Production не открывать.

## Проверки

- 38 focused unit/contract tests: 34 прежних + 4 новых сценария scope/filter/search/decoder/draft. TypeScript, targeted ESLint, generated API freshness и Vite staging build проверяются перед публикацией.
- Реальный private catalog + actual HTTP handler/selector + built browser: 15 сценариев (12 прежних целей/ширин + exclude/regenerate/save/reopen на 360/393/430), 25 API calls/24 fixture Auth GET, stale/denied Auth, zero page errors.
- S1 browser persistence regression на трёх ширинах: PASS, 6 synthetic API calls, zero page errors. Эти Auth-фактуры не являются hosted account E2E.
- Общий CI blocker исторического runtime исправлен отдельно: добавлен только exact public App.tsx из original commit `455deef591456222e08eced30d3a7ba7bf9e242a`, SHA-256 `b76db533a7baffecb1a66eb9af37e88d8ff914ccb7ab629dd38c580d3bcc6de0`, в retained overlay. Manifest и его hashes неизменны; текущий App.tsx не откатывается. Негативная проверка нового unlisted drift использует src/index.css; отдельный tampered App snapshot тест отклоняет замену. 8 historical/private-runtime tests PASS. Свежий общий CI должен быть проверен отдельно, успех всего CI не выводится из локальных тестов.

Только тестовый Preview. Без Supabase schema/data/RPC writes, source approval, Production, trusted generator/Edge activation. Частный каталог сохраняет прежние pins. Точный deployment и результаты hosted checks записываются после публикации.

## Публикация и текущий checkpoint

- Draft PR #369: https://github.com/Tatianos7/POTOK/pull/369. Base PR368 head `56cfeef029118f53654d2811befac8851e8e3c8a`; source commit `fd4dacc9b8f42aa0e8e9e0619098617caef5efa0`.
- READY Preview `dpl_A2ojUpeQ6UMGFjAVzGjibyCxXjyf`; существующий alias обновлён: https://potok-staging-test.vercel.app/staging-generator-check.html. Возврат тестового alias: `dpl_F2w4bNphkCWvKBAqDwxzmBWNJ195`.
- Прежний разрешённый неизменённый приватный каталог и флаг перенесены только на preview-ветку этого изменения, без Production-target. Новый частный контент не публиковался.
- Hosted check: HTTP200; актуальный JS содержит exclusion UI/quality summary/scope; GET API405; anonymous POST с exclusions401. Hosted signed-in генерацию/сохранение проверяет владелец; локальные Auth fixtures не выдаются за такую приёмку.
- Профильный CI 42600081542 success. Общие PR Checks42600081652 на момент записи ещё выполняются; все CI зелёными не объявляются. Исправление historical overlay локально проверено отдельными восемью тестами.
- Воспроизводимая baseline матрица: 1400 - семь дней, 26 разных recipes,1400/день;1600 - семь дней,26 разных,1600/день;1800 - семь дней,22 разных,1753.3–1767.5/день;2000 - нет недели,нехватка до необходимого недельного минимума1113.6 ккал. БЖУ1600: Б114.9–160.3,Ж29.7–52.4,У исходника137.1–206.9,клетчатка15.5–34.2 г/день. Это исходные reference факты, не оценка персональной сбалансированности.
- Состояние: RECIPE_EXCLUSION_ROUNDTRIP_IMPLEMENTED_TESTED_AND_PREVIEW_PUBLISHED; FULL_S2_PERSONAL_MACRO_AND_REVIEWED_SAFETY_INPUTS_PENDING. Остаток S2 и зависимости перечислены выше. Новые Supabase writes/Production/trusted activation не выполнялись.

Ручной тест: обновить ссылку → сгенерировать неделю → в карточке блюда нажать «Не предлагать это блюдо» → снова сгенерировать → проверить отсутствие блюда во всех днях → сохранить и повторно открыть. Старую сохранённую неделю новый подбор не переписывает без явного Save. Для ручной проверки достаточно обычного чата; кодовые задачи требуют Работа.

Эта последующая запись меняет только документацию, не app/source bytes; CI/Preview результатов следует искать по точному source commit выше, не выдавать docs-only head за новую проверенную сборку.


## Исправление доступности действия по отзыву владельца

Прежний выбор исключения был скрыт в details и оказался незаметен. Теперь каждая карточка приёма пищи содержит видимую кнопку «Не предлагать это блюдо» и пояснение о новом подборе всей недели. После нажатия текущее предложение скрывается, recipe ID добавляется в прежний список исключений, фокус и прокрутка возвращаются к генерации. Сохранённый draft не перезаписывается. Отдельная замена одного слота этим изменением не реализована; серверный протокол и правила подбора прежние. В offline viewer без callback кнопки нет.

Проверки этого изменения фиксируются в PR; browser acceptance нажимает кнопку непосредственно в article, проверяет фокус, реальный подбор без recipe ID, сохранение/повторное открытие. Используется локальная Auth fixture, не hosted signed-in приёмка. Production и Supabase writes не входят в изменение.


## Разнообразие гарниров внутри дня — отзыв владельца 2026-11-09

Новый reference подбор включает `enforceDailyStapleVariety: true`. Разные recipe IDs с одной распознанной основой (гречка, рис, овёс, пшено, перловка, киноа, булгур, кускус, макароны/лапша, картофель, чечевица, фасоль) не могут попасть в один день. Литералы берутся из названия блюда и не-optional ingredient names валидированного каталога. Это ограниченный кулинарный словарь, не canonical identity, не полная reviewed taxonomy и не аллергологическая проверка. Рисовая мука/крахмал/молоко/масло, томатная паста и стручковая фасоль не считаются соответствующим гарниром. Источник не модифицируется и nutrition не пересчитывается.

Проверка выполняется при сборе дневных вариантов, при всех заменах для уточнения калорий и при обменах между днями. Клиент независимо повторяет её по возвращённому составу; rule flag остаётся в snapshot. Старые drafts читаются без ложного заявления о новом правиле, экран предлагает новую генерацию. Сохранение само не заменяет старую неделю. Всегда cap2 на неделю, отсутствие дублей recipe ID в дне, целая исходная порция и коридор ±50. Для недельного разнообразия дополнительно рассматриваются максимум три наиболее разнообразных найденных варианта недели после calorie-first baseline; более разнообразный вариант принимается только если все дни остаются в ±50. Максимум четыре bounded refinements; global optimum не заявляется.

На неизменном pinned каталоге: 1400 — семь дней, 27 разных блюд,1400–1400.1;1600 — семь дней,26 разных блюд,1600–1600.3;1800 — семь дней,21 разное блюдо,1755.5–1771.9. Во всех днях нет повторов распознанных основ.2000 по-прежнему без недели: ранее доказанную нехватку калорий новые правила не снимают. Салаты остаются допустимыми исходными LUNCH рецептами, но обязательный отдельный салат/новый слот/добавленные ингредиенты не вводились; в этих baseline неделях отдельных салатных блюд нет. Запрос владельца удовлетворяется вариантом с разными гарнирами; многокомпонентная тарелка и самостоятельная порция салата потребуют явной схемы порций и расчёта composition.

Acceptance: unit tests охватывают гречку под разными названиями, белый/бурый рис, ложные совпадения, optional ingredients, невозможный однообразный пул, сохранение rule flag и независимое отклонение повторов клиентом. Real-catalog browser проверяет правило во всех семи днях для1400/1600/1800, исключение блюда → повторный подбор → save/reopen на360/393/430. Auth локальная fixture, не hosted signed-in acceptance. Проверки/точный source/deployment записываются в PR369. Production/Supabase writes/trusted activation не выполняются.

Ручная проверка: открыть прежнюю тестовую ссылку → обязательно «Сгенерировать неделю из рецептов» → пройти все семь дней, сравнить крупы и гарниры завтрака/обеда/ужина → при желании сохранить новую неделю. Старую сохранённую неделю не выдавать за обновлённую.


## Сохранённая цель → reference неделя → сравнение БЖУ — 2026-11-10

Owner подтвердил разнообразие внутри дня. Следующий реализованный сценарий: кнопка «Собрать по моей сохранённой цели». После Auth GET сервер читает только user_id,goal_revision,updated_at,calories,protein,fat,carbs из user_goals через фиксированный Staging REST endpoint с пользовательским bearer token и publishable key. Фильтр user_id берётся только из проверенного Auth, limit2 выявляет неоднозначность. Только GET; управление БД, writer/RPC, localStorage fallback, service-role и изменение Goal Engine отсутствуют. RLS owner predicate, authenticated SELECT и наличие колонок проверены read-only в настоящем Staging; значения целей и чужие account IDs из БД для разработки не извлекались.

Режим не принимает target/accountId/макросы от клиента. Используется сохранённая целая калорийность без привязки к четырём ручным сценариям и без подмены ближайшим значением. Наличие допустимого числа не означает, что каталог покроет эту цель: прежний search/capacity/corridor rejection сохраняется. После подбора сервер повторяет own-goal GET; изменившаяся ревизия/updated_at/любой point target даёт409 SAVED_GOAL_CHANGED без выдачи меню. Missing/denied/foreign/duplicate/malformed/partial rows не заменяются локальной копией и не получают нули. Snapshot помечен SAVED_POINT_TARGETS_NOT_ADMITTED_POLICY; revision может отсутствовать, UUID/policy approval не придумываются.

Клиент независимо связывает calories/account/saved source, показывает цель и фактическую разницу Б/Ж/У по каждому выбранному дню. Сохранение допускает дополнительные целые калорийности только с таким snapshot своего аккаунта; прежние ручные drafts остаются совместимы. Повторное открытие восстанавливает исходную цель вместе с неделей без генерации/goal read, явно подписывает «цель на момент подбора»; это история, не заявление актуальности цели сейчас. Новый подбор всегда читает цель заново. Подбор не пишет PLAN/FACT, пользовательские цели или серверные планы.

Граница: цели БЖУ сейчас сравниваются, но не становятся hard constraints. В user_goals point targets; согласованных per-axis min/max и admitted targetPolicyRevision для этого reference пути нет. Никакие ±проценты, новые нормы, conversion carbohydrate semantics или утверждение «сбалансировано» не добавлены. Требуемый для trusted пути GoalNutritionTargetV1 с диапазонами/ревизиями уже существует; этот snapshot его не заменяет. Отбор по полной согласованной политике БЖУ и reviewed source/portion/safety остаётся дальнейшей работой S2/S3/S4.

Проверки:46 unit/contract tests, zero skipped; TypeScript/build, targeted ESLint, API bundle freshness и diff check. Real-catalog local browser:18 сценариев на360/393/430 (четыре прежние цели + exclusion/save/reopen + saved goal1500/seven-day macro comparison/save/reopen/missing/changed); также stale/denied/anonymous. Три synthetic draft regression сценария сохраняют quota/network/corrupt/account/logout защиту. Auth/goal rows локальные fixtures, реальный HTTP handler/selector/catalog/UI; это не hosted signed-in приёмка. Live Staging чтение проверено по metadata/RLS, не выдаётся за реальный вызов с пользовательской сессией. Exact source/Preview записывается в PR369; rollback — предыдущий staple-diversity Preview dpl_BtDq5ANE5yNz2HhCn8jTG9qVgnWC. Supabase writes/Production/merge/activation отсутствуют.

Ручная проверка: открыть прежнюю ссылку → «Собрать по моей сохранённой цели» → проверить показанную цель и семь дней → сохранить неделю → обновить страницу и проверить тот же snapshot. Если в своём тестовом аккаунте цели нет, будет понятное сообщение; не создавать её автоматически. Для изменения/создания записей Staging требуется отдельная согласованная операция.


## Reference P/F target improvement — 2026-11-10

Owner confirmed hosted saved-goal extraction and requested actual BJU selection. Implemented bounded Pareto improvement toward the saved protein/fat point targets after the existing calorie/diversity phases. A whole-source-serving replacement is accepted only if neither daily absolute P/F error grows and at least one strictly decreases. No invented gram/percentage tolerance, new clinical range, macro weight, scaling or automatic goal change. Calorie closeness can change within the owner's unchanged inclusive ±50 corridor. Every candidate retains exact recipe cap2/week, no same recipe in a day, source category mapping, recognised daily staple rule and at least the baseline distinct-recipe count.

Search bounds: two passes,64 candidates/slot, at most8192 attempts/day/pass; single and pair replacements, equal bounded budget per slot pair; total at most114688 attempts/week. Existing shared Cartesian helper limits are unchanged; pair iteration uses explicit bounded indices for64-element pools. If no dominance improvement is found the source day remains, with a truthful UI notice; this is not proof of global infeasibility. Empty/out-of-corridor baseline is not upgraded into a claimed macro-validated week. Carb and fiber are not optimized; source carbohydrate semantics are still unknown. Full approved GoalNutritionTargetV1/targetPolicyRevision, min/max macro acceptance, reviewed sources/portions and production readiness remain pending.

The route passes only P/F from the existing Auth/RLS-read saved goal into this phase. Manual presets remain calorie-only. The existing second goal read rejects changes during the longer selection. Report contains reference-only before/after P/F, target binding, search limits and minimum diversity. Client independently checks after totals against returned meals/day report, target binding to saved goal, bounded diagnostics and non-worsening inequalities; it does not treat the self-reported baseline as independent source/reviewer/authority evidence. Saved drafts retain this diagnostic. Old comparison-only snapshots remain readable and do not falsely gain an optimization label.

UI explicitly shows how many days improved, keeps the carb exclusion/no-approved-hard-ranges wording and explains unchanged selected days. On owner-provided input reproduced locally, six of seven days improve with26 distinct recipes; first day remains unchanged rather than weakening the fat-error condition. No owner nutrition target values or private recipe text are added to public fixtures.48 focused unit/contract tests cover dominance, source immutability, deterministic search, whole portions, corridor/diversity and hostile/inconsistent receipts; three-width real-catalog browser also verifies non-worsening and snapshot restore. Source/build/hosted/CI checkpoints are recorded in PR369. No Supabase writes, Production, new env upload, source publication or trusted activation.

Owner phone check: refresh existing test page → «Собрать по моей сохранённой цели» → view the P/F improvement summary and each of seven days → explicitly replace saved draft if wanted. Old drafts are not silently regenerated. Next full-BJU gate: establish source carb semantics and approved macro policy; the current P/F reference improvement is not a substitute for those gates.

## Совместная числовая проверка утверждённых целей — 2026-11-11

По PDF владельца `POTOK_GOAL_ENGINE_NUTRITION_DECISIONS_2026-11-11.pdf` допуски на каждый день утверждены: калории ±50 ккал включительно, белок и жир ±10%, углеводы ±15%. До этого тестовый экран PR #369 показывал только калорийный коридор и локальное улучшение белка/жира, а не проверял совместное попадание четырёх показателей.

В новой локальной reference-ветке добавлена независимая числовая проверка всех четырёх окон по каждому из семи дней. Она сообщает число прошедших дней и пределы для выбранного дня. Проверка не меняет подбор, цели или порции и не выдаёт результат за допуск рецептов: все source-значения и порции остаются непроверенными. Тестовые файлы привязаны только к отдельной странице `staging-generator-check.html`, не к основному приложению.

По присланному владельцем ручному примеру (цель 1703/Б145/Ж65/У134; день 1702,7/Б120,5/Ж64,6/У162,8) калорийная цель проходит, белок ниже окна 130,5–159,5 г, жир в окне 58,5–71,5 г, углеводы выше окна 113,9–154,1 г. Итого этот день не проходит совместную числовую проверку. Углеводы всё ещё обозначаются «по рецептам»: семантика исходника и точность каталога остаются открытым gate.

Локально пройдены пять новых тестов окон (включая включённые границы, выход на 0,001 за предел, нулевую цель углеводов, несоответствие цели и ручной пример) и семь существующих сценариев качества меню: всего 12/12, без пропусков. TypeScript, targeted ESLint, `git diff --check` и Vite staging-preview build — PASS. Это локальный кандидат: GitHub PR и тестовый Preview ещё не обновлялись; Supabase/Staging/Production не изменялись.

## Ручная проверка владельца и равномерность P/F-поиска — 2026-11-11

По присланным скриншотам владелец проверила результат цели 1703 ккал: все семь дней в коридоре 1653–1753, 26 разных блюд, максимум два появления блюда за неделю и отсутствие повтора блюда в пределах дня. Сохранённый черновик на 1600 ккал был создан до правила разнообразия гарниров; экран верно пометил его старым и предложил новый подбор. Это подтверждает UI/сохранение и ручной reference-сценарий, не проверяет БЖУ, аллергии/диеты, граммы и фактическое приготовление.

В ограниченном P/F-поиске устранён перекос: прежнее row-major перечисление 1024 комбинаций пары могло затрагивать лишь первые строки 64×64 сетки. Теперь тот же бюджет детерминированно разнесён по всей сетке, без повторов. Число проверок, лимит 1024 на пару, целые source-порции, калорийный коридор, diversity/repeat правила и сохранённые цели не менялись. Новый unit/contract случай подтверждает покрытие всех 64 индексов обеих осей; реальные workbook reference-прогоны на 1400/1600/1703/1800 завершили семь дней в пределах ±50, 2000 по-прежнему корректно отказан по текущей вместимости. Это не превращает source БЖУ в verified values.

Проверки после изменения: свежесть API bundle — PASS; `tsc`/Vite staging-preview build — PASS; ESLint/diff check и focused contract tests — PASS. Трёхширинный Playwright acceptance не стартовал: в среде отсутствует браузер Playwright, а системный Chromium завершился из-за запрета `socket()`/ptrace в sandbox до загрузки страницы. Это ограничение среды, не PASS браузерной проверки. Сборка прошла обычные предупреждения о размере bundle и устаревших Browserslist данных.

Разбор последнего GitHub CI для PR #369: Node generation worker TLS/protocol и остальные перечисленные PR checks успешны. Неуспешен только локальный официальный Edge-runtime canary: положительные TLS/DB режимы `pg` внутри Edge падают с `TypeError: Cannot read properties of undefined (reading '0')`; отрицательные wrong-CA/wrong-host корректно отклоняются. `cpu` отказ из-за лимита ожидаем и сам по себе тестирует защиту. Выбранный Node runtime остаётся проходящим профилем; Edge не активирован. Не ослаблять TLS и не менять это на ожидаемый успех без совместимого драйвера/транспорта.

Текущий ограниченный поиск по-прежнему только приближает белки/жиры к сохранённым point targets и не ухудшает каждый из них; углеводы не участвуют из-за неизвестной семантики исходных recipe references. Следующий S2/S3 gate — использовать только явно подтверждённую source mapping и независимо reviewed диапазоны/ревизию goal policy; до этого не объявлять полное соответствие БЖУ и не создавать target-policy/recipe approvals.
