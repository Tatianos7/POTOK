# Managed pg_trgm и HTTP schema boundary — 27 октября 2026

Основа — #222 `b06aed1b4a58a6a7d4f5b8fa6b33ee0937ef1bbf`. Этот этап выполняет только чтение. Сводка наблюдений без ключей/пользовательских строк — `managed-boundary-observation-20261027.json`. Исходные 12 SQL, приложение, права, конфигурация API и source-review manifest не меняются.

## Поддерживаемый путь переноса установлен

[Официальная Supabase KB](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema) описывает перенос relocatable pg_trgm через `ALTER EXTENSION ... SET SCHEMA extensions` из SQL Editor/direct connection. Она объясняет reserved defaults supabase_admin и требует проверить зависимости/search_path. Это документированный managed-путь; отсутствие ordinary membership в supabase_admin само по себе его не запрещает. Мы не выполняли этот ALTER, не меняли роли, каталоги, grants или defaults.

Read-only наблюдение POTOK в **13:58:39 по Москве**:

- pg_trgm находится в public, принадлежит supabase_admin и relocatable.
- supautils privileged role — supabase_privileged_role; postgres является её эффективным участником; pg_trgm присутствует в privileged_extensions.
- extensions существует, нужный USAGE есть, клиентского CREATE нет.
- 47 extension members и один связанный индекс; индекс valid/ready.
- Две reserved public TRUNCATE default entries остаются. Их не удаляем повышением роли; SQL boundary после переноса/ограничения своих объектов проверяется отдельно.

Совместно документация и настройки подтверждают механизм, но не фактическое успешное выполнение ALTER на hosted. Моделирование обычного PostgreSQL не заменяет managed rehearsal.

## Проверка зависимостей прошла без изменения базы

`trgm-readonly.sql` — только DO preflight из закреплённого `a1b91d8bfbfba8135478803605512e1014dbafcc/scripts/security/pg-trgm/rehearsal.sql`, raw SHA a22d809784f341030029be46fe3975c3842813b41eb57414ee17ab6d9e1a52d7. Убрана вся mutating часть репетиции: временные таблицы, ALTER EXTENSION и проверки после переноса здесь не исполняются. Блок помещён в BEGIN READ ONLY/ROLLBACK с фиксированным search_path и timeout.

Он выполнен на POTOK и вернул **TRGM_SOURCE_PREFLIGHT_READ_ONLY_OK**. Скан проверяет явные public-ссылки, конфликтующий function search_path, target schema usage/create и наличие relocatable extension. Это консервативный regexp-скан, не полный parser/dependency/runtime proof; динамические SQL, внешний код, API extra search_path и бизнес-функции проверяются в согласованной репетиции. Никаких функций приложения он не вызывает.

Тест сопоставляет read-only блок с тем же trgm-разделом source-review пакета #222 и запрещает top-level mutation/COMMIT/EXECUTE. Двенадцать исходных SHA сохраняются.

## Реальная HTTP-проверка четырёх профилей

В **14:02:16 по Москве** выполнено пять GET к фиксированному POTOK origin. Использован только существующий publishable key, полученный через Supabase connector; bearer user/service-role token отсутствовал. Ключ передавался в apiKey header через stdin с отключённым terminal echo, не записывался в файл/репозиторий/отчёт. Ничего не создавалось и не ротировалось.

Запросы идут только к заведомому metadata resource `__potok_schema_metadata_probe__`, `select=id&limit=0`; RPC, POST/PATCH/DELETE и чтения пользовательских строк нет.

| Accept-Profile | HTTP / код | Вывод в проверенном контексте |
| --- | --- | --- |
| extensions | 406 / PGRST106 | Профиль отклонён |
| potok_control | 406 / PGRST106 | Профиль отклонён |
| potok_nutrition | 406 / PGRST106 | Профиль отклонён |
| potok_delivery | 406 / PGRST106 | Профиль отклонён |
| public | 404 / PGRST205 | Профиль принят, metadata resource отсутствует; контроль работоспособности API/ключа |

[PostgREST описывает PGRST106](https://docs.postgrest.org/en/stable/references/errors.html) как отказ schema switching, когда профиль отсутствует в db-schemas. Рабочий сервис возвращает короткое `Invalid schema: <name>`, без перечня разрешённых схем. Первые обращения проверяли старый формат сообщения и корректно остановились без ложного успеха; метод изменён на независимые named-profile проверки. Тесты поддерживают оба наблюдаемых формата и не выводят неизвестный список из короткой ошибки.

Это **OBSERVED_HTTP_SCHEMA_EXCLUSIONS** для четырёх названных профилей с public-key/без user JWT. Это не полный экспорт `db_schema`, не список всех возможных exposed schemas, не проверка grant/RLS всех объектов, не authenticated A/B и не гарантия будущих настроек. Три candidate namespace ещё отсутствуют; проверено, что HTTP их не принимает сейчас. После создания и перед/после реального применения проверку нужно повторно включить в общий acceptance. Старую работу на Mac ради маркера повторять не требуется.

Полная Management config не получена: подключённый инструмент не имеет read-config метода, а [GET /v1/projects/{ref}/postgrest](https://supabase.com/docs/reference/api/v1-get-postgrest-service-config) требует отдельного разрешённого management-доступа и может содержать секреты при расширенных правах. Ни токены доступа, ни jwt_secret для этой проверки не запрашивались. Extra search_path нельзя вывести из результатов Accept-Profile; до фактического переноса подтвердить его совместимость через разрешённую конфигурацию/репетицию.

## Инструменты и проверки

`http-profile.mjs` допускает один жёстко закреплённый origin, четыре профиля плюс public, GET, redirect=error, bounded timeout и limit=0. Legacy JWT допускается лишь с role=anon/ref текущего проекта/no sub; service/user/cross-project credentials отвергаются до сети. CLI принимает вход через stdin и не печатает его даже при повреждённом JSON. Неизвестные ответы/сеть не становятся закрытой границей; при принятом приватном профиле итог NEEDS_REVIEW.

Десять новых локальных tests покрывают оба формата PGRST106, противоречивый список, неизвестные/ошибочные ответы, fixed route/method/no user JWT, open-profile failure, no key echo и соответствие readonly source. Вместе с девятью прежними recovery tests — 19 успешных. CI воспроизводит #222 packet, запускает оба набора, прежний native guard и обычную сборку. В CI нет настоящего ключа и повторных обращений к POTOK: live HTTP доказательство — отдельное выполненное наблюдение выше.

## Что теперь закрыто и что остаётся

- Установлен официальный managed-путь; текущие настройки и read-only source preflight ему не противоречат.
- Четыре нужные schema exclusions подтверждены реальным HTTP в указанном контексте, независимо от отсутствующих pgrst-настроек в SQL catalog.
- Полный config export/extra search_path и managed ALTER/rehearsal не объявлены выполненными. Перед выпуском нужны актуальная копия/recovery, target-bound preconditions/locks/content checks и конкретное согласование применения.

Ни один результат этого этапа не разрешает hosted apply. Release-review guard и mayApply=false остаются. Генератор/Edge и issuance не активируются. Следующий этап — актуальность приватной копии и точный план разрешённой репетиции/применения; согласованный security milestone, фейерверк, затем генерация питания и квитанции #198 сохраняются.
