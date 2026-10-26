# Защита существующих строк журналов программ

Следующий ограниченный шаг после #207 (`4416a1cef2a934425c8a4eadb2e43c627604d663`). Review-only SQL: `scripts/security/program-history/review.sql`. Публичные исходники и синтетические данные; Production/Staging не изменяются.

## Что меняется

| Таблица | Проверяемые текущие записи клиента | Новое ограничение |
| --- | --- | --- |
| program_versions | Добавление snapshot при первоначальном создании/перепланировании | Уже записанную строку нельзя менять/удалять клиентским UPDATE/DELETE |
| program_adaptations | Добавление результата адаптации | То же |
| program_explainability | Добавление объяснения генерации/адаптации/паузы | То же; #207 server projection/ограничения чтения сохраняются |
| program_guard_events | Добавление записи о риске/паузе | То же; клиент не может удалить существующую строку guard event |

В рассмотренных `programGenerationService`/`programDeliveryService` эти пути используют INSERT, а не исправление уже существующих записей. Кандидат снимает у PUBLIC/anon/authenticated UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN на четырёх таблицах и все отдельные column UPDATE/REFERENCES grants. Проверяет **effective** права: неизвестное наследуемое разрешение останавливает транзакцию, memberships не изменяются.

Это защита от прямых клиентских изменений прошлых строк, **не доверенный immutable ledger для всех ролей**. Existing owner/service права остаются; владелец и доверенные backend роли всё ещё могут исправлять данные в пределах своих прежних разрешений. Действия уже исполняющихся транзакций и все SECURITY DEFINER/external writers не считаются автоматически проверенными. Не обещать глобальную неизменяемость или полноценную медицинскую/safety проверку по одному запрету DELETE.

## Сохранность и допуск

Preflight требует PG17 nonsuperuser postgres/session postgres, обычные postgres-owned RLS таблицы и точные текущие списки колонок четырёх журналов. Табличные и колонковые SELECT/INSERT capabilities для API ролей и прежние service-role capabilities сохраняются в session-private TEMP snapshots и сверяются после REVOKE. Если service получает нужное право только через PUBLIC и оно исчезнет, пакет откатывается вместо добавления нового широкого GRANT. Остальные backend роли/внешние consumers требуют проверки перед release; PUBLIC права не восстанавливать для совместимости вслепую.

В файле всегда ROLLBACK; COMMIT применяется только фиксированной disposable fixture. Кандидат не читает/переписывает бизнес-строки, не меняет policies/functions/профили/значения прав и не выдаёт authority. Успешный повтор тех же REVOKE идемпотентен, не возвращает широкие права. Восемь старых pinned SQL и restored runner #202 не меняются; этот follow-up надо отдельно включить в финальную reviewed группу.

Обычное добавление собственной history строки остаётся по существующей owner RLS. SQL проверяет INSERT с безопасным RETURNING id; настоящий API — INSERT с `Prefer: return=minimal`, как у рассмотренных append вызовов без `.select('*')`. Чужой program INSERT должен отклоняться. Это конкретная проверка совместимости, не полный тест первоначальной генерации. Free чтение краткого объяснения и платный scoped full reader из #207 остаются.

## Что остаётся OPEN

Новая строка всё ещё может быть выдумана клиентом. Не считать существующий или новый snapshot/guard/adaptation автоматически подтверждённым результатом доверенного генератора, оплаты или safety engine. Legacy owner INSERT и родительский UPDATE program_version ещё не являются атомарной адаптацией. Последний тест намеренно показывает этот незакрытый путь. Нет уникальности/проверки порядка версий, CAS, receipts, immutable provenance или прав на конкретный алгоритмический результат, добавленных данным пакетом.

Следующая граница изменения плана должна объединить точного владельца и тип программы, verified capability/feature gate, lock/CAS версии, полную валидацию payload и append результата/версии, отказ без частичных изменений и восстановление неизвестного результата. Нельзя заменить её одной проверкой INSERT program_adaptations. Нельзя закрыть все plan таблицы общим REVOKE, оставив первоначальную Free generation и исполнение без совместимого пути. Сначала сопоставить существующие Graph v1/v2 contracts и разрешённые runtime пути; не создавать параллельный генератор или включать Edge.

История FACT/дневника питания не меняется, PLAN != FACT сохраняется. Client caches/account scope (#186), остальные payload/readers, полный private restored/API/application прогон, свежий recovery и exact hosted approval остаются отдельными gates. Настоящая проверка квитанций остаётся #198 после генерации планов питания. Ни этот пакет, ни его тесты не закрывают весь security этап.

## Проверки

12 embedded PG17 cases: исходные UPDATE/DELETE и anon TRUNCATE; точный ROLLBACK данных/ACL; inherited column UPDATE/REFERENCES отказ без membership изменений; inherited-only PUBLIC service capability rollback; COMMIT с сохранением полных синтетических строк четырёх журналов, parent/session/diary; клиентские UPDATE/DELETE/TRUNCATE и effective maintenance/reference/trigger denial; собственные новые inserts/safe id и сохранённый protected SELECT запрет; foreign INSERT denial; ON CONFLICT DO UPDATE denial; обычный status/session и existing service DML; идемпотентный replay; OPEN new-row/parent mutation. Native PG17 повторяет их.

Combined local Supabase Auth/PostgREST добавляет вымышленную history fixture и отдельно применяет follow-up после #206/#207. С теми же A/B JWT проверяет отказ собственного и чужого PATCH/DELETE и upsert замены старого id, успешный own no-returning INSERT каждой таблицы и чужой INSERT denial. Fresh SQL проверяет effective table/column mutation boundary; прежние source contracts/read projection, Premium grant/revoke, Login/Profile/AuthProvider/photo/catalog/history snapshot regressions продолжаются. Fixtures с намеренно опасными grant — тестовая модель, не снимок hosted ACL. CI нужно подтвердить на exact commit, пользовательские данные/секреты в GitHub не публикуются.
