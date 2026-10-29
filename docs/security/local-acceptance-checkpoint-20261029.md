# Локальная приёмка: контрольная точка 29 октября 2026

Это фактический владельческий результат, не разрешение на Production/Staging.
Порядок: завершить согласованный этап безопасности → фейерверк → генерация
питания → настоящие платёжные квитанции [#198](https://github.com/Tatianos7/POTOK/issues/198).

## Подтверждённый MyProgram UI

Владелец выполнил пакет commit `8706594ef46968ae36647f7306262fa481cb3472`.
SHA-256 22-file manifest:
`69e4e6ad31152e808cad5586960756499887527d6c08f38ea047ec1926a6e3b6`.
`program-ui-izBBNW` вернул `PRIVATE_PROGRAM_UI_OK`, tmp free 478 MiB.

Настоящие Login/MyProgram и два прежних OTP-аккаунта подтвердили показ своей
nutrition-программы, четыре действия pause/resume и reload, отказ в чужом
чтении и отключённый генератор. Точные временные fixtures удалены; независимые
postchecks подтвердили сохранность исходных данных, прав и Storage.
Training/day-action UI и hosted release этим результатом не подтверждены.
Повторять этот прогон ради нового маркера не требуется.

Перед ним `program-reviewed-precheck-ZYv4ss` вернул
`PROGRAM_REVIEWED_AUTH_PRECHECK_OK`. Исторические raw hashes не заменены;
учтены только два проверенных planner estimates и два ожидаемых RI-триггера
на границе установки authority FK. Подробности — `program-ui-acceptance-20261028.md`.
Все семь автоматических workflows на exact head 8706594 успешны, включая
реальный PG OID/trigger admission и native Auth/SDK/UI; это отдельное от Mac evidence.

## Ранее подтверждённые affected workflows — без повторов

| Scope | Private evidence | Маркер |
| --- | --- | --- |
| Login/Profile browser | private-browser-4xteKI | PRIVATE_BROWSER_OK |
| Diary CRUD, photo metadata, чужой доступ, cleanup | scoped-diary-photo-Xx1zVk | SCOPED_DIARY_PHOTO_OK |
| 63 исходных Storage binaries через HTTP/SHA-256 | storage-readonly-T2eY0k | PRIVATE_STORAGE_READONLY_OK |
| Storage A/B, 3 buckets, 6 temporary binaries, cleanup | storage-ab-z2Dfdn | PRIVATE_STORAGE_AB_OK |
| Program SDK, 4 nutrition/training programs, 12 annotations | program-client-KTEgS1 | PRIVATE_PROGRAM_CLIENT_OK |
| AuthProvider/MyProgram reload без program fixtures | program-auth-reload-9HiE7u | PRIVATE_PROGRAM_AUTH_RELOAD_OK |

Это перечисленные workflows, не универсальная приёмка всех экранов, нагрузки,
генерации или оплаты. Raw snapshots, журналы, ключи и строки остаются приватными.

## Что остаётся до рабочего выпуска

1. Подготовить отдельный target-bound пакет 12 закреплённых SQL и совместимого
   клиента: preconditions, locks/timeouts, content/rights/empty-authority checks,
   post-commit verification и recovery. Существующий `forward.review.sql`
   остаётся review-only с безусловным STOP и ROLLBACK; его защиту не удалять.
2. Перед окном получить свежие target/config/defaults/extension/exposure evidence
   и подтвердить актуальность backup/recovery. Копия 24 октября не доказывает
   отсутствие новых записей. Managed pg_trgm rehearsal/extra search_path и
   reserved-owner defaults требуют своего решения по release-packet/managed-boundary.
3. Представить владельцу точный target, client commit, forward hash, клиентское
   окно и recovery. Только после точного одобрения выполнять hosted изменения
   и независимые рабочие проверки. UNKNOWN около COMMIT требует reconciliation,
   без автоматического повтора/restore или возврата широких прав.

Для source review и подготовки Mac сейчас не нужен. Новых терминальных команд
по закрытым локальным тестам нет. Перед выпуском может потребоваться доступ
к приватным файлам/актуальному backup. Production/Staging не менялись,
authority не выдавалась, generator/Edge/payment verification не активированы.
