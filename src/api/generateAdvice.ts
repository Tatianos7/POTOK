import { UserGoalData, AiAdviceResponse } from '../types/aiAdvice';
import { buildNutritionPrompt, buildTrainingPrompt } from '../utils/promptBuilder';

/**
 * API endpoint для генерации AI-советов
 * 
 * TODO: replace stub with OpenAI / Claude / Gemini
 * 
 * @param data - Данные пользователя для генерации советов
 * @returns Promise с рекомендациями по питанию и тренировкам
 */
export async function generateAdvice(data: UserGoalData): Promise<AiAdviceResponse> {
  // TODO: replace stub with OpenAI / Claude / Gemini
  
  // Симуляция задержки API-запроса
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Формируем промпты
  const nutritionPrompt = buildNutritionPrompt(data);
  const trainingPrompt = buildTrainingPrompt(data);

  // Заглушка: генерируем советы на основе шаблонов
  // В будущем здесь будет вызов реального AI API
  const nutritionAdvice = generateNutritionStub(data, nutritionPrompt);
  const trainingAdvice = generateTrainingStub(data, trainingPrompt);

  return {
    nutrition: nutritionAdvice,
    training: trainingAdvice,
  };
}

/**
 * Заглушка для генерации рекомендаций по питанию
 * В будущем будет заменена на вызов AI API
 */
function generateNutritionStub(data: UserGoalData, _prompt: string): string {

  let advice = `Персональные рекомендации по питанию для ${data.gender === 'male' ? 'мужчины' : 'женщины'} ${data.age} лет, вес ${data.weight} кг.\n\n`;

  advice += `📊 ВАШИ ЦЕЛЕВЫЕ ПОКАЗАТЕЛИ:\n`;
  advice += `• Калории: ${data.calories} ккал/день\n`;
  advice += `• Белки: ${data.protein} г/день\n`;
  advice += `• Жиры: ${data.fat} г/день\n`;
  advice += `• Углеводы: ${data.carbs} г/день\n\n`;

  if (data.goal === 'lose') {
    advice += `🎯 ЦЕЛЬ: ПОХУДЕНИЕ\n`;
    if (data.targetWeight) {
      advice += `Целевой вес: ${data.targetWeight} кг (нужно сбросить ${(data.weight - data.targetWeight).toFixed(1)} кг)\n`;
    }
    if (data.intensity) {
      advice += `Интенсивность: дефицит ${data.intensity}% от TDEE\n`;
    }
    advice += `\n📋 РЕКОМЕНДАЦИИ:\n`;
    advice += `• Создайте дефицит калорий ${data.calories} ккал/день\n`;
    advice += `• Ешьте ${data.protein} г белка ежедневно для сохранения мышечной массы\n`;
    advice += `• Распределите приемы пищи: 3 основных + 2 перекуса\n`;
    advice += `• Пейте 2-2.5 литра воды в день\n`;
    advice += `• Избегайте: сахар, фастфуд, алкоголь, сладкие напитки\n`;
    advice += `• Предпочтительные продукты: куриная грудка, рыба, овощи, крупы, яйца\n\n`;
  } else if (data.goal === 'gain') {
    advice += `🎯 ЦЕЛЬ: НАБОР МАССЫ\n`;
    advice += `\n📋 РЕКОМЕНДАЦИИ:\n`;
    advice += `• Создайте профицит калорий ${data.calories} ккал/день\n`;
    advice += `• Употребляйте ${data.protein} г белка для роста мышц\n`;
    advice += `• Ешьте 4-5 раз в день с интервалом 3-4 часа\n`;
    advice += `• Пейте 2.5-3 литра воды в день\n`;
    advice += `• Включите: сложные углеводы (рис, гречка, овсянка), полезные жиры (орехи, авокадо)\n`;
    advice += `• После тренировки: белок + углеводы в течение 30-60 минут\n\n`;
  } else {
    advice += `🎯 ЦЕЛЬ: ПОДДЕРЖАНИЕ ФОРМЫ\n`;
    advice += `\n📋 РЕКОМЕНДАЦИИ:\n`;
    advice += `• Поддерживайте баланс калорий ${data.calories} ккал/день\n`;
    advice += `• Соблюдайте БЖУ: ${data.protein}г белка, ${data.fat}г жиров, ${data.carbs}г углеводов\n`;
    advice += `• Ешьте регулярно: 3 основных приема пищи\n`;
    advice += `• Пейте 2-2.5 литра воды в день\n`;
    advice += `• Сбалансированное питание: белки, сложные углеводы, полезные жиры\n`;
    advice += `• Ограничьте: сахар, обработанные продукты\n\n`;
  }

  advice += `🍽 ПРИМЕРНЫЙ РАЦИОН НА ДЕНЬ:\n`;
  advice += `\nЗавтрак (${Math.round(data.calories * 0.25)} ккал):\n`;
  advice += `• Овсянка с ягодами и орехами\n`;
  advice += `• Или яичница с овощами и хлебом\n\n`;
  
  advice += `Обед (${Math.round(data.calories * 0.35)} ккал):\n`;
  advice += `• ${data.gender === 'male' ? '200' : '150'}г куриной грудки или рыбы\n`;
  advice += `• Гречка или рис (${Math.round(data.carbs * 0.3)}г)\n`;
  advice += `• Овощной салат\n\n`;
  
  advice += `Ужин (${Math.round(data.calories * 0.25)} ккал):\n`;
  advice += `• ${data.gender === 'male' ? '150' : '120'}г белка (рыба, индейка, творог)\n`;
  advice += `• Овощи на пару или салат\n\n`;
  
  advice += `Перекусы (${Math.round(data.calories * 0.15)} ккал):\n`;
  advice += `• Творог, орехи, фрукты, протеиновый коктейль\n\n`;

  advice += `⏰ РЕЖИМ ПИТАНИЯ:\n`;
  advice += `• Завтрак: через 30-60 минут после пробуждения\n`;
  advice += `• Обед: через 4-5 часов после завтрака\n`;
  advice += `• Ужин: за 2-3 часа до сна\n`;
  advice += `• Перекусы: между основными приемами пищи\n\n`;

  advice += `💧 ВОДА:\n`;
  advice += `• Пейте 2-2.5 литра чистой воды в день\n`;
  advice += `• Стакан воды за 30 минут до еды\n`;
  advice += `• Ограничьте кофе и чай (не более 2-3 чашек)\n\n`;

  advice += `❌ ЧТО ИЗБЕГАТЬ:\n`;
  advice += `• Сахар и сладости\n`;
  advice += `• Фастфуд и полуфабрикаты\n`;
  advice += `• Алкоголь\n`;
  advice += `• Сладкие газированные напитки\n`;
  advice += `• Переработанные продукты с консервантами\n\n`;

  advice += `🔄 КАК АДАПТИРОВАТЬ РАЦИОН:\n`;
  advice += `• Если не наедаетесь: увеличьте овощи и белок\n`;
  advice += `• Если переедаете: уменьшите порции на 10-15%\n`;
  advice += `• Если нет прогресса: пересчитайте калории через 2-3 недели\n`;
  advice += `• Ведите дневник питания для отслеживания\n`;

  return advice;
}

/**
 * Заглушка для генерации рекомендаций по тренировкам
 * В будущем будет заменена на вызов AI API
 */
function generateTrainingStub(data: UserGoalData, _prompt: string): string {

  let advice = `Персональные рекомендации по тренировкам для ${data.gender === 'male' ? 'мужчины' : 'женщины'} ${data.age} лет.\n\n`;
  const trainingPlaceText =
    data.trainingPlace === 'none'
      ? 'без тренировок'
      : data.trainingPlace === 'gym'
        ? 'в зале'
        : 'дома/на улице';
  advice += `Формат тренировок: ${trainingPlaceText}.\n\n`;

  const workoutsPerWeek = 
    data.activityLevel === 'low' ? 2 :
    data.activityLevel === 'medium' ? 4 : 6;

  if (data.goal === 'lose') {
    advice += `🎯 ЦЕЛЬ: ПОХУДЕНИЕ\n`;
    if (data.targetWeight) {
      advice += `Целевой вес: ${data.targetWeight} кг\n`;
    }
    advice += `\n💪 СИЛОВЫЕ ТРЕНИРОВКИ:\n`;
    advice += `• Частота: ${workoutsPerWeek} раз в неделю\n`;
    advice += `• Длительность: 45-60 минут\n`;
    advice += `• Интенсивность: средняя-высокая\n`;
    advice += `• Фокус: комплексные упражнения (приседания, жимы, тяги)\n`;
    advice += `• Подходы: 3-4 по 8-12 повторений\n`;
    advice += `• Отдых между подходами: 60-90 секунд\n\n`;
    
    advice += `🏃 КАРДИО:\n`;
    advice += `• Частота: ${workoutsPerWeek === 2 ? 3 : workoutsPerWeek === 4 ? 2 : 3} раза в неделю\n`;
    advice += `• Длительность: 30-45 минут\n`;
    advice += `• Интенсивность: средняя (пульс 60-70% от максимума)\n`;
    advice += `• Типы: бег, велосипед, эллипс, плавание\n`;
    advice += `• Интервальные тренировки: 1-2 раза в неделю (20-30 минут)\n\n`;
    
    advice += `📅 ПРИМЕРНЫЙ ПЛАН НЕДЕЛИ:\n`;
    advice += `• Понедельник: Силовая (верх тела)\n`;
    advice += `• Вторник: Кардио 30-45 мин\n`;
    advice += `• Среда: Силовая (низ тела)\n`;
    advice += `• Четверг: Кардио 30-45 мин\n`;
    advice += `• Пятница: Силовая (все тело)\n`;
    advice += `• Суббота: Активный отдых (ходьба, йога)\n`;
    advice += `• Воскресенье: Отдых\n\n`;
  } else if (data.goal === 'gain') {
    advice += `🎯 ЦЕЛЬ: НАБОР МАССЫ\n`;
    advice += `\n💪 СИЛОВЫЕ ТРЕНИРОВКИ:\n`;
    advice += `• Частота: ${workoutsPerWeek} раз в неделю\n`;
    advice += `• Длительность: 60-90 минут\n`;
    advice += `• Интенсивность: высокая\n`;
    advice += `• Фокус: базовые упражнения (приседания, жим лежа, становая тяга)\n`;
    advice += `• Подходы: 4-5 по 6-10 повторений\n`;
    advice += `• Отдых между подходами: 2-3 минуты\n`;
    advice += `• Прогрессия: увеличивайте вес каждую неделю\n\n`;
    
    advice += `🏃 КАРДИО:\n`;
    advice += `• Частота: 1-2 раза в неделю (легкое)\n`;
    advice += `• Длительность: 20-30 минут\n`;
    advice += `• Интенсивность: низкая (пульс 50-60% от максимума)\n`;
    advice += `• Цель: поддержание здоровья сердца, не сжигание калорий\n\n`;
    
    advice += `📅 ПРИМЕРНЫЙ ПЛАН НЕДЕЛИ:\n`;
    advice += `• Понедельник: Грудь + трицепс\n`;
    advice += `• Вторник: Спина + бицепс\n`;
    advice += `• Среда: Ноги + плечи\n`;
    advice += `• Четверг: Отдых\n`;
    advice += `• Пятница: Грудь + трицепс\n`;
    advice += `• Суббота: Спина + бицепс\n`;
    advice += `• Воскресенье: Отдых\n\n`;
  } else {
    advice += `🎯 ЦЕЛЬ: ПОДДЕРЖАНИЕ ФОРМЫ\n`;
    advice += `\n💪 СИЛОВЫЕ ТРЕНИРОВКИ:\n`;
    advice += `• Частота: ${workoutsPerWeek} раз в неделю\n`;
    advice += `• Длительность: 45-60 минут\n`;
    advice += `• Интенсивность: средняя\n`;
    advice += `• Фокус: поддержание мышечной массы и силы\n`;
    advice += `• Подходы: 3-4 по 10-15 повторений\n`;
    advice += `• Отдых между подходами: 60-90 секунд\n\n`;
    
    advice += `🏃 КАРДИО:\n`;
    advice += `• Частота: 2-3 раза в неделю\n`;
    advice += `• Длительность: 30-40 минут\n`;
    advice += `• Интенсивность: средняя\n`;
    advice += `• Типы: бег, велосипед, плавание, групповые занятия\n\n`;
    
    advice += `📅 ПРИМЕРНЫЙ ПЛАН НЕДЕЛИ:\n`;
    advice += `• Понедельник: Силовая (верх)\n`;
    advice += `• Вторник: Кардио\n`;
    advice += `• Среда: Силовая (низ)\n`;
    advice += `• Четверг: Отдых\n`;
    advice += `• Пятница: Силовая (все тело)\n`;
    advice += `• Суббота: Кардио или активный отдых\n`;
    advice += `• Воскресенье: Отдых\n\n`;
  }

  advice += `🛌 ВОССТАНОВЛЕНИЕ:\n`;
  advice += `• Сон: 7-9 часов каждую ночь\n`;
  advice += `• Отдых между тренировками: минимум 48 часов для одной группы мышц\n`;
  advice += `• Растяжка: 10-15 минут после каждой тренировки\n`;
  advice += `• Массаж: раз в неделю для улучшения восстановления\n\n`;

  advice += `⚠️ ПРЕДУПРЕЖДЕНИЯ:\n`;
  advice += `• Начинайте с легких весов и постепенно увеличивайте нагрузку\n`;
  advice += `• При болях в суставах прекратите упражнение и обратитесь к врачу\n`;
  advice += `• Разминка обязательна перед каждой тренировкой (5-10 минут)\n`;
  advice += `• Заминка и растяжка после тренировки (10-15 минут)\n`;
  advice += `• Пейте воду во время тренировки\n`;
  if (data.age > 40) {
    advice += `• Учитывайте возраст: больше времени на разминку и восстановление\n`;
  }

  return advice;
}
