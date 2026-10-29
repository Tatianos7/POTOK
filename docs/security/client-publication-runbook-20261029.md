# Подготовленная публикация клиента — пока не запускать

## Зафиксированный выпуск

Создана отдельная ветка `security/client-release-candidate-20261029`, точно на
`1976b330111a802942af7e29161050e316990f99`. После создания SHA независимо прочитан
через GitHub branches API и совпал. Ветка не включена в push triggers deploy.yml;
публикационный workflow не отправлялся. Ветку не передвигать и не использовать
для дальнейшей разработки. Если SHA изменится — STOP, не молчаливое обновление pin.

На exact commit оба CI success:
- Release source/native PostgreSQL: https://github.com/Tatianos7/POTOK/actions/runs/40876404620
- TypeScript/build/regressions: https://github.com/Tatianos7/POTOK/actions/runs/40876404381

Клиентский набор src/package.json/package-lock.json/.node-version/vite.config.ts/
deploy.yml совпадает с принятым `996a81c30906000b9cb6ffe88456a98b55cb692f`.
Это проверено git diff --exit-code. Код после тестов не менялся; новый runbook —
только документация и не перемещает ветку выпуска.

SHA256 deploy.yml: fd815eaf7f731a4afcbec69d702482e9b158808554d24f875a1f6e56ea6475e8
SHA256 package-lock.json: ba7a198dbe98ca34359ee83b8b5e6b74edd86dbfa9da72652fa620dca4035751

## Последняя наблюдаемая штатная публикация

Проверены success push runs четырёх разрешённых deploy.yml веток: master,
main, feature/initial-setup, feature/workout-diary. Найденный самый новый deploy
из этих веток: run 39418398642, master/555d3263ce20e70ae59576e9dd3e2d2c4a97240e,
20 октября 11:55:10 UTC (14:55:10 Москва). Jobs build и deploy success.
Последний успешный feature/initial-setup push deployment — 20 июля; у main и
feature/workout-diary success push runs отсутствуют. Все два успешных ручных
workflow_dispatch runs также старше: август и январь. Читаемые журналы deploy job
подтверждают адрес https://tatianos7.github.io/POTOK/.
В момент дополнительного наблюдения общие in_progress=0 и queued=0.

Это подтверждение GitHub Actions publication provenance, не побайтовая сверка
нынешнего CDN response с артефактом. Прямые сторонние публикации, изменения Pages
settings, delivery/CDN и открытые старые вкладки этим наблюдением не исключены.
Перед будущим запуском проверить актуальные runs снова; это не разрешение запуска.

## Допуск и будущие действия владельца

Только после подтверждённой облачной копии, завершения exact SQL установки,
независимого postcommit JSON, ограниченных HTTP checks и отдельного разрешения
на публикацию данного client SHA. См. coordinated-window-20261029.md. До этого
ни Run workflow, ни merge в master не выполнять. Никаких секретов не вводить в чат.

После допуска:
1. Открыть https://github.com/Tatianos7/POTOK/actions/workflows/deploy.yml.
2. Выбрать Run workflow и ветку security/client-release-candidate-20261029.
   Непосредственно перед этим независимо сверить, что она всё ещё на exact SHA
   1976b330111a802942af7e29161050e316990f99 и нет другой Pages publication.
3. Отправить один запуск. Сохранить run ID/head_sha. При несовпадении SHA не
   публиковать другой ref вместо него. При потере ответа не жать кнопку повторно:
   сначала проверить список runs и состояние уже созданного запуска.
4. Проверить head_sha и success обоих jobs build/deploy, адрес из deployment.
   Один зелёный build без deploy success не означает публикацию.
5. Открыть приложение с принудительным обновлением вкладки и выполнить ограниченные
   проверки владельца: существующий вход, профиль, чтение дневника/своих фото,
   Моя программа. Ничего не генерировать, не включать Edge, не покупать/выдавать
   premium и не создавать массовые тестовые записи. При отсутствии своей активной
   программы корректный пустой экран не выдавать за тест pause/resume.
6. После проверки записать source SHA/run ID/время/URL и фактические результаты;
   отсутствующие сценарии или неподтверждённую версию не объявлять пройденными.

Если приложение не работает после публикации: сохранить наблюдения, остановить
редактирование и отдельно разобрать узкое исправление. Автоматически возвращать
старый уязвимый клиент, расширять права или запускать SQL повторно нельзя.
Ветка выпуска, успешный build и этот runbook не закрывают весь security milestone.
