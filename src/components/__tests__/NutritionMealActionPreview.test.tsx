import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import NutritionMealActionPreview from '../NutritionMealActionPreview';
import type { MealConfirmationChoice } from '../../utils/nutritionAdaptation';

test('food-action previews describe separate PLAN/FACT effects and keep saving disabled', () => {
  const cases: Array<[MealConfirmationChoice, string]> = [
    ['ate-as-planned', 'точный состав и порция из выбранной версии плана'],
    ['ate-with-changes', 'Плановая порция не подставляется как съеденная'],
    ['did-not-eat', 'Запись о съеденной еде в дневнике не создаётся'],
    ['extra-food', 'Следующие блюда и дни не уменьшаются автоматически'],
  ];
  for (const [choice, message] of cases) {
    const html = renderToStaticMarkup(<NutritionMealActionPreview choice={choice} onClose={() => undefined} />);
    assert.ok(html.includes(message), choice);
    assert.match(html, /План и дневник не изменены/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Сохранение пока недоступно/);
    assert.doesNotMatch(html, /Сохранено|Записано в дневник/);
  }
});
