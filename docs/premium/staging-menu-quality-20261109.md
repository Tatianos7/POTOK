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
