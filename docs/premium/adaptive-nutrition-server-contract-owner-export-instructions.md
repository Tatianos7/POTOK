# Adaptive Nutrition — owner-run metadata export

2026-09-20. Подготовлен локально; SQL не выполнялся, подключения к Supabase не было.
Цель — evidence для [required server contract v1](adaptive-nutrition-server-contract-required-v1.md).
Это не готовая схема и не подтверждение deployed contract.

## 1. Проверить проект

В своей существующей сессии Supabase Dashboard откройте **STAGING** с project ref
**`ozidryfvhkcbtpnulakq`**, затем SQL Editor. Проверьте ref в URL/настройках проекта
перед запуском. **PRODUCTION запрещён.** Если ref не совпадает — остановитесь.

Не нужны CLI, login-role initialization, service role, новые роли или выдача прав.
Не передавайте JWT/password/API keys. Если существующая Dashboard-сессия не даёт
доступа, остановитесь и сообщите об отсутствии доступа без credentials.

`expected_project_ref_label_only` в результате — константа для маркировки, а не
проверка проекта сервером. `current_database()` тоже не доказывает project ref.
Подтверждение выбранного проекта делает владелец в Dashboard.

## 2. Запустить только подготовленный SELECT

Файл: [adaptive-nutrition-server-contract-owner-readonly.sql](../../scripts/sql/adaptive-nutrition-server-contract-owner-readonly.sql).

SHA-256 точного файла:

```text
655edd04ca8d6956ddcaa15373b6b6a94ff425c3e9bef39c5b3bfce64bebc032
```

Откройте новый пустой запрос, вставьте **весь файл без изменений** и выполните его
вручную. Это один SELECT с SELECT-only CTE и одной результирующей таблицей;
все секции возвращаются вместе. Не добавляйте другие scripts, transaction/role
commands или вызовы найденных RPC. Старый recipe atomic audit не запускайте.

Локальная статическая проверка: один statement; нет write/DDL/permission/transaction
statements, SELECT INTO, locking, динамического исполнения или mutating calls.
Источники — только `pg_catalog`, `information_schema` и внутренние SELECT CTE.
Вызовы ограничены известными catalog/deparser/JSON/aggregate builtins;
application functions/triggers не вызываются. Проверка лексическая и ручная,
без PostgreSQL parser/server execution; совместимость на staging ещё не проверена.

`pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_constraintdef` и `pg_get_indexdef`
возвращают **текст metadata**. В таком тексте могут быть write/DDL keywords —
это описание существующего объекта, не выполнение этого текста.
**Не выполняйте SQL из ячеек результата.**

## 3. Сохранить полный результат

Сохраните одну CSV/JSON-выгрузку результата, например
`adaptive-nutrition-metadata-ozidryfvhkcbtpnulakq-YYYY-MM-DD.csv`.
Нужны все четыре информационные колонки: `section_id`, `section`,
`section_row_count`, `export_row_count`, а также полный JSON `evidence`.
Сохраните многострочные definitions целиком, без обрезки UI и скриншотов вместо текста.

| Section | Evidence |
| --- | --- |
| 00 | Время наблюдения, database/session role, PostgreSQL version, границы export |
| 01 | Inventory имён application relations, kind и причина включения/исключения |
| 02 | Tables/views, owner, RLS enabled/forced, options, view definition |
| 03 | Columns, types/domain, nullability, defaults, precision/scale, identity/generated |
| 04 | PK/unique/FK/check/domain constraints; ordered FK columns, validation/deferral, обе стороны связи |
| 05 | Index definitions, unique/primary, validity, predicates/expression indexes |
| 06 | RLS policies, roles, command, permissive/restrictive, USING/WITH CHECK |
| 07–08 | Table ACL с default privileges; explicit column ACL |
| 09–10 | Relevant functions/RPC: signatures, returns, definition, definer/invoker, search_path, EXECUTE ACL |
| 11 | Triggers: table, name, enabled state, internal flag, function identity, definition |
| 12 | Прямые catalog dependency edges в обоих направлениях, включая границы scope |
| 13 | Candidates для ownership, identity, dated slot, week/timezone, revision/idempotency/history |
| 14 | Schema privileges |
| 15 | Inventory имён/signatures функций; отмечено, чьи definitions включены |

Сравните число сохранённых строк с `export_row_count` (без CSV header). Должны
присутствовать все section IDs 0–15. Если секция пуста, будет одна marker row с
`section_row_count = 0`; для непустой секции число строк равно её section_row_count.
Если Dashboard ограничил выдачу, используйте доступное управление лимитом/export
результатов. При невозможности сохранить всё сообщите об обрезке; частичный export
не является доказательством отсутствия остальных объектов.

При error/permission denied остановитесь, сохраните обезличенный текст ошибки.
Не выдавайте новые права и не переключайтесь на CLI, другой проект или credentials.

## 4. Передать evidence без secrets

Перед отправкой локально просмотрите выгрузку: definitions/defaults могут содержать
hardcoded tokens, connection strings, адреса или identifiers, хотя строки
пользовательских таблиц не запрашивались. Замените чувствительные literals на
`[REDACTED]`, сохранив структуру и указав section/object/причину в кратком manifest.
Не удаляйте неудобные для проверки строки молча. Оригинал храните у себя;
redactions, скрывающие существенную проверку доступа, останутся evidence gap.

Передайте обратно redacted CSV/JSON и короткую заметку:

- Владелец проверил STAGING ref `ozidryfvhkcbtpnulakq`; дата/время запуска.
- SHA-256 использованного SQL, итоговая row count, полный export или ограничения.
- Известный deployment/build identifier, если уже доступен; иначе `unknown`.
- Ошибки, пустые секции и список redactions. Не прикладывайте cookies, JWT,
  passwords, API/service-role keys, connection strings или пользовательские diary rows.

## Границы evidence и следующий checkpoint

Scope по именам/колонкам эвристический. Inventory помогает обнаружить нестандартные
имена; missing match/пустая секция не доказывают отсутствие объекта. Встроенные
`auth`/`storage` и другие системные схемы не обходятся; FK/dependency могут показать
имя `auth.users` или внешней функции без чтения данных/definition за этой границей.
Private `recipes`/`recipe_ingredients`, canonical `foods` и известные atomic recipe
RPC исключены из детального scope; имена/FK границ могут присутствовать.
Premium catalog metadata включена только как возможная граница plan snapshots.
Это не recipe expansion/import и не возобновление recipe atomic audit.

`kind`: r = table, p = partitioned table, v = view, m = materialized view, f = foreign
table. Constraint codes: p = PK, u = unique, f = FK, c = check, x = exclusion.
Trigger enabled: O = origin, D = disabled, R = replica, A = always.
Policy command: r = SELECT, a = INSERT, w = UPDATE, d = DELETE, * = ALL.
Function kind f/p описывает function/procedure; ни одна не вызывается.

NULL function search_path означает отсутствие function-level override, не безопасный
путь по умолчанию. ACL с NULL разворачивается через PostgreSQL default ACL, включая
возможный PUBLIC EXECUTE. Column ACL дополняет table ACL. Эти данные не моделируют
всё наследование ролей и не доказывают effective authenticated access: Dashboard
role может обходить RLS. `information_schema_visible = false` означает, что precision/
scale из этого источника не подтверждены; NULL нельзя трактовать как нулевое значение.

`pg_depend` не является полным call graph: PL/pgSQL, dynamic SQL, внешние endpoints
и helpers могут не иметь записанных edges. Inventory/definitions читаются как
metadata; отсутствующие тела/протоколы запрашиваются отдельным scoped checkpoint.
Колонка `updated_at`, revision или unique key сама по себе не доказывает CAS,
atomicity, append-only history, timeout recovery или durable idempotency receipt.
После локальной сверки export с required-contract matrix отдельно потребуется
подтверждённый mutation/read/lookup protocol и уже доступная behavioral evidence.

**Этот export НЕ является разрешением на mutation**, schema/RPC/RLS changes,
write tests, persistence/network integration, production activation или push/deploy.
Canonical food export, recipe atomic metadata и recipe expansion остаются **PARKED**.
Подготовка пакета на этом завершена; следующий шаг — только ручной export владельцем.
