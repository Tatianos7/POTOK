# S1: сохранение и открытие тестовой недели на устройстве

Статус: реализовано и проверено локально; публикация и ручная приёмка отмечаются отдельно.

Пользователь генерирует неделю, сохраняет её, закрывает страницу и снова открывает тот же тестовый экран. После проверки текущего Auth автоматически открывается одна последняя сохранённая неделя этого аккаунта, без повторного API-подбора. Есть явные действия открытия, замены и удаления черновика.

## Граница реализации

Это версионированная локальная копия `potok-browser-reference-week-draft-v1` в browser localStorage, не новый продуктовый Plan service, не активный план и не серверная persistence. Она изолирована от diary/Progress/Graph writers. Не синхронизируется между устройствами; очистка браузера удаляет её. В приватном режиме сохранность не гарантируется. LocalStorage не является зашифрованным или доверенным серверным хранилищем; владелец профиля браузера технически имеет доступ к его данным. Аккаунтное разделение обеспечивает поведение приложения, а не шифрование от владельца устройства.

Существующие trusted record/activate/readback требуют допущенных источников. Authoring JSON нельзя отправлять туда как approved recipe/Graph. Поэтому полное серверное сохранение остаётся S4 после подготовки входов и отдельного разрешения на Staging. Локальный путь выбран явно, не как скрытый fallback при отказе сервера.

Ключ: `potok:staging-reference-week-draft:v1:<accountId>`. Только одна последняя неделя на аккаунт/browser. Envelope содержит scope, owner, savedAt, timezone, цель/дату и исходный выбранный reference response без токенов. Сохраняются все семь дней, исходные количества/КБЖУ, source hash, report/catalog contracts и детали только выбранных рецептов. Неизвестные граммы и измеренный выход остаются неизвестными. Никаких recipe approval/FACT не возникает.

Запись и чтение проходят существующий strict decoder повторно; проверяются диапазон ±50, семь дат/суммы, false authority flags, совпадение каталога и недели, каждый recipe/nutrition/serving link. Повреждённая/другая версия не открывается; автоматических repairs/writes нет. Явное Save может заменить повреждённую копию. Максимум envelope 2 MB; один setItem заменяет слот атомарно. Повтор идентичного сохранения не меняет savedAt и не создаёт дубли. Ошибка quota/read сохраняет прежние байты и показывает ошибку.

TestPage подписывается на Auth changes, скрывает старый аккаунт, проверяет user через серверный getUser; async вызов не выполняется внутри синхронного Auth callback. Чтение/сохранение/удаление дополнительно проверяют текущий аккаунт. Поздние ответы отменяются epoch, A/B переключение и logout в другой вкладке скрывают меню. Для открытия после перезапуска нужно подключение для проверки Auth; это не offline-first приложение.

## Фактические проверки

- 34 локальных теста: PASS, zero skip. Новый набор покрывает snapshot roundtrip/идентичный replay, owner separation, tampered flags/range/totals/catalog/metadata, incomplete/oversized input, quota/unavailable storage.
- TypeScript и targeted ESLint: PASS. Generated API freshness: PASS, серверный API не менялся. Staging Vite build/postbuild: PASS; прежнее предупреждение размера chunk остаётся.
- Реальный собранный UI + browser localStorage, widths 360/393/430: generate/save/repeated save/close/new page/reopen all 7 days and details; selection change/open; network generation failure; quota; verified foreign account; cross-tab logout; corrupt draft/delete: PASS. 6 fixture API calls, zero page errors/неожиданных remote calls/overflow.
- Recipe API и Auth в этом browser run синтетические; это не новая hosted Auth/реальный каталог acceptance. Существующие проверки реального каталога предыдущего Preview сохраняются отдельно, не выдаются за новое выполнение.
- Supabase schema/data/RPC, Production и trusted activation не менялись. Приватный каталог не включён в GitHub/статические файлы.

## Ручная проверка владельца после публикации

1. Открыть https://potok-staging-test.vercel.app/staging-generator-check.html в том же браузере и войти в тестовый аккаунт.
2. Выбрать цель, сгенерировать и нажать «Сохранить неделю на устройстве».
3. Закрыть вкладку, открыть ссылку снова. Сверить блюда/КБЖУ всех дней; повторный подбор не требуется.
4. Сменить цель: текущий результат скрывается. «Открыть сохранённую неделю» возвращает сохранённую цель и блюда.
5. При необходимости «Удалить сохранённый черновик». В другом браузере/телефоне эта копия не появится.

Следующий сценарий: S2, качество подбора/БЖУ/ограничения и 2000 ккал; S3 подготовка рецептов идёт рядом. Непроверенные рецепты не блокируют код S1, но блокируют собственный Production admission. Новое разрешение на записи Staging для этой локальной реализации не нужно и не используется.

## Checkpoint публикации

- Draft PR: https://github.com/Tatianos7/POTOK/pull/368. Feature commit `2b2a4e3f5e2209d3c4075996ed8ae0b332299c7f`; CI runner correction `4eb01437947f416a337d26e56b1b134c19572d67`.
- Дополнительно повторены 12 сценариев с настоящим private reference catalog + реальным HTTP handler на трёх ширинах: PASS (19 API calls, 18 fixture Auth GET, zero page errors; 2000 expected empty). Auth остаётся synthetic, это не hosted signed-in E2E.
- Частный master восстановлен из сохранённого источника без изменений. Повторная проекция совпала с закреплённым SHA-256 `c59ff7ec366070e46f5d76c03d645a77381d189c6e5b3aa3633abab8555362b2`, packed 54184 bytes. Private bytes не попали в git.
- Первый профильный CI run 42586098591 прошёл contract tests/TypeScript, но остановился на установке Playwright system deps: libasound2 отсутствует на ubuntu-latest. Runner закреплён ubuntu-22.04, как в существующей browser acceptance проекта. Повторный CI на исправлении ещё не объявлен успешным.
- Новая source Preview сборка автоматически создана (`dpl_FqzRmRb33CZfW2c8UXmPYThqtnXM`), но её private catalog binding не подготовлен; стабильный alias на неё НЕ переключался.
- Изменение branch-only catalog binding без value не прошло Vercel size validation для encrypted ciphertext; read API отдаёт усечённую value, она не использовалась. Повторная передача исходных неизменённых 54184 bytes в тот же Vercel project была отклонена автоматической проверкой: требуется отдельное однозначное owner permission для этого upload.
- Флаг теста возвращён к прежней corridor preview-ветке; исходный private catalog binding сохранён. Прежний стабильный alias и рабочая сборка `dpl_GoJHB2SLEvqhBVa7vGAozYo51oyj` не менялись. Production и Supabase writes отсутствуют.
- Блокер публикации: отдельно согласовать повторное использование прежнего private catalog в `potok-staging-test`, preview новой ветки. После разрешения: записать неизменённые параметры только этой preview-ветке → redeploy exact candidate → verify READY, HTTP 200 и API 401/405 → переключить существующий тестовый alias → ручная приёмка владельца. Перед этим проверить повторный профильный CI. Не расширять действие до Production/trusted worker.
