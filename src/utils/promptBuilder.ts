import { UserGoalData } from '../types/aiAdvice';

/**
 * Формирует промпт для генерации рекомендаций по питанию
 */
export function buildNutritionPrompt(data: UserGoalData): string {
  const goalText = 
    data.goal === 'lose' ? 'похудение' :
    data.goal === 'gain' ? 'набор массы' : 'поддержание формы';

  const activityText =
    data.activityLevel === 'low' ? 'низкая активность' :
    data.activityLevel === 'medium' ? 'средняя активность' : 'высокая активность';

  return `Создай персональные рекомендации по питанию для ${data.gender === 'male' ? 'мужчины' : 'женщины'} ${data.age} лет.

Параметры:
- Цель: ${goalText}
- Вес: ${data.weight} кг
- Рост: ${data.height} см
- Уровень активности: ${activityText}
- Целевые калории: ${data.calories} ккал/день
- Белки: ${data.protein} г/день
- Жиры: ${data.fat} г/день
- Углеводы: ${data.carbs} г/день
${data.targetWeight ? `- Целевой вес: ${data.targetWeight} кг` : ''}
${data.intensity ? `- Интенсивность: дефицит ${data.intensity}%` : ''}

Включи в рекомендации:
1. Примерный рацион на день с распределением приёмов пищи
2. Примеры продуктов
3. Советы по режиму питания
4. Советы по воде
5. Что избегать
6. Как адаптировать рацион

Формат: структурированный текст с эмодзи для лучшей читаемости.`;
}

/**
 * Формирует промпт для генерации рекомендаций по тренировкам
 */
export function buildTrainingPrompt(data: UserGoalData): string {
  const goalText = 
    data.goal === 'lose' ? 'похудение' :
    data.goal === 'gain' ? 'набор массы' : 'поддержание формы';

  const activityText =
    data.activityLevel === 'low' ? 'низкая активность' :
    data.activityLevel === 'medium' ? 'средняя активность' : 'высокая активность';

  return `Создай персональные рекомендации по тренировкам для ${data.gender === 'male' ? 'мужчины' : 'женщины'} ${data.age} лет.

Параметры:
- Цель: ${goalText}
- Вес: ${data.weight} кг
- Рост: ${data.height} см
- Уровень активности: ${activityText}
${data.targetWeight ? `- Целевой вес: ${data.targetWeight} кг` : ''}
${data.intensity ? `- Интенсивность: дефицит ${data.intensity}%` : ''}

Включи в рекомендации:
1. Рекомендации по силовым тренировкам (частота, длительность, интенсивность)
2. Рекомендации по кардио (частота, длительность, интенсивность)
3. Примерный план тренировок на неделю
4. Советы по восстановлению
5. Предупреждения и меры предосторожности

Формат: структурированный текст с эмодзи для лучшей читаемости.`;
}

