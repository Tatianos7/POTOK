# Sprint 7.4.1 — Manual Mode E2E (Runtime)

Таблица ключевых сценариев Manual Mode: Goal → Measurements → Food Diary → Training Diary → Progress → Habits.

| Scenario | Preconditions | Steps | Expected State | Trust/Explainability Check | Offline/Recovery Path |
| --- | --- | --- | --- | --- | --- |
| Goal → Measurements | Новый пользователь, активная сессия | Рассчитать цель → сохранить → перейти в замеры | Goal = success, Measurements = active | “Почему такие КБЖУ?” | Offline: сохранение в cache, после сети sync |
| Measurements → Food Diary | Замеры сохранены | Добавить вес + фото → открыть дневник питания | Measurements = success, Food Diary = active | “Почему прогресс пустой?” | Offline: фото в локальной очереди |
| Food Diary → Training Diary | Цель есть, дневник пуст | Добавить приём пищи → открыть тренировки | Food Diary = success, Training = active | Баланс КБЖУ объяснён | Offline: entry локально, retry sync |
| Training Diary → Progress | Есть тренировки | Добавить упражнение → открыть прогресс | Training = success, Progress = active | “Почему тренд такой?” | Offline: тренировки из cache |
| Habits (создание) | Manual Mode | Создать привычку → отметить | Habits = active, streak = 1 | “Почему это важно?” | Offline: локальный лог |
| Progress (агрегация) | Есть данные | Открыть Progress | Progress = active, partial ok | Explainability bundle на метрики | Offline snapshot + banner |
| Error recovery | Сетевая ошибка | Повторить операцию | error → recovery → active | Ошибка объяснена без стыда | Retry + revalidate |

