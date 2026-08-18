import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

import ProgressDailyGoalCard from '../ProgressDailyGoalCard';
import { deriveProgressDailyGoalState } from '../../utils/progressDailyGoal';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, '../ProgressDailyGoalCard.tsx'), 'utf8');
const styles = readFileSync(resolve(currentDir, '../../pages/ProgressHub.css'), 'utf8');

test('ProgressDailyGoalCard renders compact zero state', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 0,
        calorieTarget: 2000,
        hasWorkoutEntries: false,
        progressViewed: false,
        waterEnabled: false,
      })}
    />,
  );

  assert.match(html, /Цель дня/);
  assert.match(html, /Держаться в рамках питания и выполнить активность/);
  assert.match(html, /0\/4/);
  assert.match(html, /Вкл/);
  assert.match(html, /Питание в рамках цели/);
  assert.match(html, /Провести тренировку \/ активность/);
  assert.match(html, /Выпить воду/);
  assert.match(html, /Проверить Progress/);
});

test('ProgressDailyGoalCard disabled state hides checklist and month while keeping header', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 2000,
        calorieTarget: 2000,
        hasWorkoutEntries: true,
        progressViewed: true,
        waterGlasses: 5,
        waterEnabled: true,
        periodMetrics: {
          streakDays: 0,
          weekCompletedDays: 0,
          weekTotalDays: 7,
          monthCompletedDays: 12,
          monthTotalDays: 30,
          conclusion: 'Каждый закрытый день помогает видеть реальный прогресс.',
        },
        preferences: {
          enabled: false,
          selectedItemIds: ['nutrition', 'activity', 'water', 'progress'],
        },
      })}
    />,
  );

  assert.match(html, /Цель дня/);
  assert.match(html, /Выкл/);
  assert.match(html, /Помогает отмечать базовые действия и видеть прогресс за месяц\./);
  assert.doesNotMatch(html, />Включить</);
  assert.doesNotMatch(html, /Питание в рамках цели/);
  assert.doesNotMatch(html, /Месяц/);
  assert.doesNotMatch(html, /12\/30 дней/);
  assert.doesNotMatch(html, /Настроить пункты/);
});

test('ProgressDailyGoalCard renders success copy', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 2000,
        calorieTarget: 2000,
        hasWorkoutEntries: true,
        progressViewed: true,
        waterGlasses: 2,
        waterEnabled: true,
      })}
    />,
  );

  assert.match(html, /4\/4/);
  assert.match(html, /Цель дня выполнена/);
  assert.match(html, /Отлично\. Сегодня вы закрыли основные действия\./);
});

test('ProgressDailyGoalCard renders long nutrition meta separately from label', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 1075,
        calorieTarget: 1546,
        hasWorkoutEntries: false,
        progressViewed: true,
        waterGlasses: 5,
        waterEnabled: true,
      })}
    />,
  );

  assert.match(html, /progress-daily-goal-item-content/);
  assert.match(html, /progress-daily-goal-item-label/);
  assert.match(html, /progress-daily-goal-item-note/);
  assert.match(html, /Питание в рамках цели/);
  assert.match(html, /Записано 1075 ккал из 1546 ккал/);
  assert.match(html, /5 ст\./);
  assert.match(html, /UI-only/);
});

test('ProgressDailyGoalCard renders month-only read-only period metric compactly', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 2000,
        calorieTarget: 2000,
        hasWorkoutEntries: true,
        progressViewed: true,
        waterGlasses: 5,
        waterEnabled: true,
        periodMetrics: {
          streakDays: 3,
          weekCompletedDays: 4,
          weekTotalDays: 7,
          monthCompletedDays: 18,
          monthTotalDays: 30,
          conclusion: 'Каждый закрытый день помогает видеть реальный прогресс.',
        },
      })}
    />,
  );

  assert.match(html, /Динамика цели дня за месяц/);
  assert.match(html, /Месяц/);
  assert.match(html, /18\/30 дней/);
  assert.doesNotMatch(html, /Серия/);
  assert.doesNotMatch(html, /Неделя/);
  assert.doesNotMatch(html, /4\/7/);
  assert.match(html, /Каждый закрытый день помогает видеть реальный прогресс\./);
  assert.match(html, /Настроить пункты/);
});

test('ProgressDailyGoalCard selected items hide unselected checklist rows', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 2000,
        calorieTarget: 2000,
        hasWorkoutEntries: true,
        progressViewed: true,
        waterGlasses: 5,
        waterEnabled: true,
        preferences: {
          enabled: true,
          selectedItemIds: ['nutrition'],
        },
      })}
    />,
  );

  assert.match(html, /1\/1/);
  assert.match(html, /Питание в рамках цели/);
  assert.doesNotMatch(html, /Провести тренировку \/ активность/);
  assert.doesNotMatch(html, /Выпить воду/);
  assert.doesNotMatch(html, /Проверить Progress/);
});

test('ProgressDailyGoalCard renders soft copy for zero month progress', () => {
  const html = renderToStaticMarkup(
    <ProgressDailyGoalCard
      state={deriveProgressDailyGoalState({
        caloriesLogged: 0,
        calorieTarget: 2000,
        hasWorkoutEntries: false,
        progressViewed: true,
        waterGlasses: 0,
        waterEnabled: true,
        periodMetrics: {
          streakDays: 0,
          weekCompletedDays: 0,
          weekTotalDays: 7,
          monthCompletedDays: 0,
          monthTotalDays: 30,
          conclusion: 'Начните закрывать дни — здесь появится прогресс за месяц.',
        },
      })}
    />,
  );

  assert.match(html, /0\/30 дней/);
  assert.match(html, /Начните закрывать дни/);
});

test('ProgressDailyGoalCard styles support narrow mobile wrapping', () => {
  assert.match(styles, /\.progress-daily-goal-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*56px/s);
  assert.match(styles, /\.progress-daily-goal-item-content\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(styles, /\.progress-daily-goal-item-label\s*\{[^}]*word-break:\s*normal/s);
  assert.doesNotMatch(styles, /\.progress-daily-goal-item-label\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(styles, /\.progress-daily-goal-item-note\s*\{[^}]*max-width:\s*100%/s);
  assert.match(styles, /\.progress-daily-goal-periods\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(styles, /\.progress-daily-goal-actions\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.progress-daily-goal-toggle\s*\{[^}]*width:\s*100%/s);
  assert.match(styles, /@media \(max-width: 360px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*52px/s);
  assert.match(styles, /\.progress-daily-goal-setup-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('ProgressDailyGoalCard has no diary or workout write imports', () => {
  assert.doesNotMatch(source, /mealService/);
  assert.doesNotMatch(source, /workoutService/);
  assert.doesNotMatch(source, /updateWater/);
  assert.doesNotMatch(source, /addExercisesToWorkout/);
});

test('ProgressDailyGoalCard source includes inline setup controls and progress-only guard copy', () => {
  assert.match(source, /onPreferencesChange/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /Оставьте питание или активность/);
  assert.match(source, /Настройка цели дня/);
  assert.match(source, /state\.enabled \? 'Вкл' : 'Выкл'/);
  assert.match(source, /className="progress-daily-goal-actions"/);
  assert.ok(source.indexOf('className="progress-daily-goal-toggle"') < source.indexOf('className="progress-daily-goal-score"'));
  assert.doesNotMatch(source, />\\s*Включить\\s*</);
});
