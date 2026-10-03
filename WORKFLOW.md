# POTOK — рабочий регламент разработки

Этот документ описывает единый рабочий процесс POTOK и применяется вместе с
`AGENTS.md`. При любом расхождении приоритет имеет `AGENTS.md`.

## 1. Кто за что отвечает

**Product Owner**

Определяет, что строим, порядок работ и критерии готовности. Даёт отдельное
разрешение на рискованные действия:

- Supabase write;
- production;
- deploy;
- merge в `master`;
- платёжные и security-sensitive изменения.

**Координатор / архитектурный контроль**

Помогает формулировать задачи, проверяет решения Codex, следит за архитектурой,
безопасностью, статусами, зависимостями и последовательностью.

**Codex Cloud**

Берёт конкретную задачу, читает `AGENTS.md`, `ARCHITECTURE.md`,
`CURRENT_STATE.md` и релевантные документы, работает в отдельной branch,
запускает проверки и открывает PR.

**GitHub**

Техническая точка истины по реализованному состоянию. `master` содержит только
проверенное состояние.

**Supabase**

Server/data layer. STAGING используется для проверок и отдельно разрешённых
изменений. Production нельзя трогать без явного owner approval.

## 2. Где хранится контекст

Для каждой новой задачи Codex сначала читает:

- `AGENTS.md`;
- `ARCHITECTURE.md`;
- `CURRENT_STATE.md`;
- профильные docs/contracts/tests текущего блока.

Чаты используются для обсуждения, решений, UX, требований и истории. GitHub
хранит реализованное состояние.

## 3. Как начинается новая задача

Перед реализацией нужно определить:

- цель;
- новый контекст;
- ограничения;
- acceptance criteria.

Для обычной задачи не требуется большое ТЗ.

Базовый формат задачи:

```text
Продолжаем POTOK.

Прочитай:
- AGENTS.md
- ARCHITECTURE.md
- CURRENT_STATE.md
- релевантные файлы текущего блока.

Цель:
[что нужно сделать]

Ограничения:
[что нельзя трогать]

Работай в отдельной branch.
Не меняй master напрямую.

Выполни необходимые проверки и открой PR.

В конце верни:
- branch
- commit SHA
- changed paths
- tests/checks
- risks
- PR
```

## 4. Когда нужно отдельное ТЗ

Отдельная спецификация нужна для новых крупных систем:

- Premium-модуль;
- платежи;
- Trainer;
- новый Goal Engine;
- новая модель данных;
- новый server workflow;
- большой UX-блок.

Спецификация должна содержать:

- цель продукта;
- пользовательский сценарий;
- бизнес-правила;
- данные и состояния;
- архитектурный контракт;
- безопасность;
- edge cases;
- acceptance criteria;
- rollout.

Не следует создавать одно огромное ТЗ на весь POTOK.

## 5. Нормальный путь задачи

Идея → решение → Codex Cloud → branch → tests → PR → review → merge → deploy при
необходимости.

После завершения существенного блока нужно обновлять `CURRENT_STATE.md`.

## 6. Что Codex может делать без отдельного owner approval

Разрешено:

- читать код и docs;
- анализировать архитектуру;
- менять файлы в своей branch;
- писать тесты;
- запускать build/tests/lint;
- создавать commit;
- push рабочей branch;
- открывать PR;
- исследовать безопасные альтернативы.

## 7. Что требует отдельного owner approval

Всегда требуется отдельное разрешение перед:

- merge в `master`;
- Supabase schema/data/RLS/RPC mutation;
- изменениями production DB;
- Edge deploy;
- feature flag activation;
- payment integration;
- доступом к production secrets;
- destructive migration;
- backfill;
- удалением данных.

Для Codex Cloud прямой commit или push в `master`, force push и history rewrite
запрещены правилами `AGENTS.md`; вместо них всегда используется отдельная branch
и PR.

## 8. Git rules

Всегда:

- отдельная branch;
- PR в `master`;
- exact selective staging;
- никогда `git add .`;
- никогда `git add -A`;
- никогда `git reset --hard`;
- никогда `git clean -fd`;
- никакого force push;
- не трогать owner dirty/untracked files без явного разрешения;
- не смешивать разные логические блоки в один commit.

## 9. Supabase rules

STAGING по умолчанию read-only.

Рабочая схема:

audit → proposal → owner approval → apply STAGING → acceptance → postcheck →
production decision

Успешный STAGING никогда автоматически не означает production rollout.

## 10. Security rules

Нельзя:

- писать secrets в чат;
- коммитить `service_role`;
- давать Codex production credentials;
- использовать client-side admin authority;
- обходить RLS;
- скрыто включать generator или Edge;
- делать неоговорённые fallbacks в sensitive server flows;
- смешивать PLAN и FACT.

Неоднозначность в чувствительном server flow → fail closed.

## 11. Как принимается PR

Перед merge нужно проверить:

- изменены только ожидаемые файлы;
- архитектура не нарушена;
- тесты прошли;
- секретов нет;
- случайных изменений нет;
- hidden production effect отсутствует;
- `master` напрямую не менялся;
- статус задачи соответствует факту.

После merge:

- обновить `CURRENT_STATE.md`;
- зафиксировать новый `master` SHA;
- отметить следующий шаг.

## 12. Статусы

Использовать:

- `DONE`;
- `IMPLEMENTED_NOT_VERIFIED`;
- `IN_PROGRESS`;
- `BLOCKED`;
- `LATER`.

Для server work отдельно фиксировать:

- STAGING applied / not applied;
- acceptance PASS / FAIL;
- production touched / not touched;
- Edge deployed / not deployed;
- generator activated / not activated.

## 13. Работа с телефона

Для Cloud-задач компьютер не требуется.

Рабочая схема с телефона:

- открыть Codex;
- выбрать `Облако`;
- выбрать environment `POTOK`;
- дать задачу;
- получить branch/PR;
- провести review;
- merge только после owner approval.

Локальные старые dirty/untracked files на Mac остаются отдельной локальной
историей до отдельного решения.

## 14. Главное правило

Новая задача не должна зависеть от памяти одного чата.

Критический контекст должен жить в:

- GitHub;
- `AGENTS.md`;
- `ARCHITECTURE.md`;
- `CURRENT_STATE.md`;
- `WORKFLOW.md`;
- профильных спецификациях;
- тестах;
- migration/acceptance artifacts.

Чат нужен для решений, а не как единственная база проекта.
