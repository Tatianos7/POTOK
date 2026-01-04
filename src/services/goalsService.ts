import { DailyMeals, MealEntry, Food } from '../types';

/**
 * Сервис для работы с дневными целями пользователя
 */

export interface DailyGoals {
  caloriesTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
}

export interface ActualConsumption {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface DailyExcess {
  extraCalories: number;
  extraProtein: number;
  extraFat: number;
  extraCarbs: number;
}

export interface DailyExcessWithDate extends DailyExcess {
  date: string;
}

export interface PeriodExcess {
  totalExtraCalories: number;
  totalExtraProtein: number;
  totalExtraFat: number;
  totalExtraCarbs: number;
  dailyExcess: DailyExcessWithDate[];
}

export interface SweetAndFlourCalories {
  totalSweetCalories: number;
  totalFlourCalories: number;
  extraSweetCalories: number;
  extraFlourCalories: number;
}

export type ExcessLevel = 'none' | 'low' | 'moderate' | 'high';

export type DayStatus = 'normal' | 'excess' | 'significant_excess';

export interface ExcessInterpretation {
  calories: ExcessLevel;
  protein: ExcessLevel;
  fat: ExcessLevel;
  carbs: ExcessLevel;
  dayStatus: DayStatus;
}

class GoalsService {
  private readonly GOAL_STORAGE_PREFIX = 'goal_';

  // Категории сладкого и мучного
  private sweetCategories = ['sweet', 'sweets', 'dessert', 'конфеты', 'сладости', 'десерт', 'сладкое'];
  private flourCategories = ['flour', 'bread', 'bakery', 'хлеб', 'мучное', 'выпечка', 'хлебобулочные'];

  // Проверка, является ли продукт сладким по категории или тегам
  private isSweet(food: Food): boolean {
    if (food.category) {
      const categoryLower = food.category.toLowerCase();
      return this.sweetCategories.some(cat => categoryLower.includes(cat.toLowerCase()));
    }
    // TODO: Проверка по tags, если будет добавлено поле tags
    // if (food.tags) {
    //   return food.tags.some(tag => this.sweetCategories.includes(tag.toLowerCase()));
    // }
    return false;
  }

  // Проверка, является ли продукт мучным по категории или тегам
  private isFlour(food: Food): boolean {
    if (food.category) {
      const categoryLower = food.category.toLowerCase();
      return this.flourCategories.some(cat => categoryLower.includes(cat.toLowerCase()));
    }
    // TODO: Проверка по tags, если будет добавлено поле tags
    // if (food.tags) {
    //   return food.tags.some(tag => this.flourCategories.includes(tag.toLowerCase()));
    // }
    return false;
  }

  /**
   * Получает дневные цели пользователя
   * Цели могут быть:
   * - фиксированные (одинаковые каждый день) - хранятся в localStorage
   * - рассчитанные заранее (уже есть в профиле) - также хранятся в localStorage
   * 
   * @param userId - ID пользователя
   * @returns Объект с дневными целями или значения по умолчанию
   */
  getDailyGoals(userId: string): DailyGoals {
    try {
      const stored = localStorage.getItem(`${this.GOAL_STORAGE_PREFIX}${userId}`);
      
      if (!stored) {
        // Возвращаем значения по умолчанию, если цели не установлены
        return this.getDefaultGoals();
      }

      const parsed = JSON.parse(stored);
      
      // Преобразуем данные из формата localStorage в формат DailyGoals
      // В localStorage могут быть поля: calories, proteins, fats, carbs
      // Также поддерживаем прямой формат с Target суффиксами
      return {
        caloriesTarget: parseFloat(parsed.caloriesTarget || parsed.calories) || this.getDefaultGoals().caloriesTarget,
        proteinTarget: parseFloat(parsed.proteinTarget || parsed.proteins) || this.getDefaultGoals().proteinTarget,
        fatTarget: parseFloat(parsed.fatTarget || parsed.fats) || this.getDefaultGoals().fatTarget,
        carbsTarget: parseFloat(parsed.carbsTarget || parsed.carbs) || this.getDefaultGoals().carbsTarget,
      };
    } catch (error) {
      console.error('[goalsService] Ошибка получения целей:', error);
      // В случае ошибки возвращаем значения по умолчанию
      return this.getDefaultGoals();
    }
  }

  /**
   * Возвращает значения целей по умолчанию
   */
  private getDefaultGoals(): DailyGoals {
    return {
      caloriesTarget: 2000,
      proteinTarget: 100,
      fatTarget: 70,
      carbsTarget: 250,
    };
  }

  /**
   * Рассчитывает фактическое потребление за один день
   * 
   * Вход:
   * - список приёмов пищи за день (DailyMeals)
   * - продукты с КБЖУ (уже учтены в MealEntry)
   * 
   * Выход:
   * - объект с фактическим потреблением КБЖУ
   * 
   * Требования:
   * - учитывает вес продукта (уже учтён в entry.calories, entry.protein и т.д.)
   * - корректно суммирует все приёмы пищи
   * 
   * @param dailyMeals - данные о приёмах пищи за день
   * @returns Объект с фактическим потреблением КБЖУ
   */
  calculateActualConsumption(dailyMeals: DailyMeals): ActualConsumption {
    // Защита: если день пустой или данные некорректны
    if (!dailyMeals) {
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }

    // Собираем все записи из всех приёмов пищи
    const allEntries: MealEntry[] = [
      ...(dailyMeals.breakfast || []),
      ...(dailyMeals.lunch || []),
      ...(dailyMeals.dinner || []),
      ...(dailyMeals.snack || []),
    ];

    // Если день пустой → все значения 0
    if (allEntries.length === 0) {
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }

    // Суммируем КБЖУ из всех записей
    // Вес продукта уже учтён в entry.calories, entry.protein и т.д.
    // Безопасный fallback для некорректных данных
    return allEntries.reduce(
      (totals, entry) => ({
        calories: totals.calories + (Number(entry.calories) || 0),
        protein: totals.protein + (Number(entry.protein) || 0),
        fat: totals.fat + (Number(entry.fat) || 0),
        carbs: totals.carbs + (Number(entry.carbs) || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }

  /**
   * Рассчитывает «лишнее» за один день
   * 
   * Вход:
   * - фактическое потребление (ActualConsumption)
   * - дневные цели пользователя (DailyGoals)
   * 
   * Формула:
   * лишнее = max(0, факт − цель)
   * 
   * Выход:
   * - объект с лишним КБЖУ
   * 
   * ВАЖНО:
   * - Если пользователь недоел (факт < цель) — лишнее = 0
   * - Никаких отрицательных значений
   * 
   * @param actual - фактическое потребление за день
   * @param goals - дневные цели пользователя
   * @returns Объект с лишним КБЖУ
   */
  calculateDailyExcess(actual: ActualConsumption, goals: DailyGoals): DailyExcess {
    // Защита: если нет целей → лишнее не считается (вернуть 0)
    if (!goals) {
      return { extraCalories: 0, extraProtein: 0, extraFat: 0, extraCarbs: 0 };
    }

    // Защита: если данные некорректны → безопасный fallback
    const safeActual = {
      calories: Number(actual?.calories) || 0,
      protein: Number(actual?.protein) || 0,
      fat: Number(actual?.fat) || 0,
      carbs: Number(actual?.carbs) || 0,
    };

    const safeGoals = {
      caloriesTarget: Number(goals.caloriesTarget) || 0,
      proteinTarget: Number(goals.proteinTarget) || 0,
      fatTarget: Number(goals.fatTarget) || 0,
      carbsTarget: Number(goals.carbsTarget) || 0,
    };

    // Если цели равны 0, считаем что целей нет
    if (safeGoals.caloriesTarget === 0 && safeGoals.proteinTarget === 0 && 
        safeGoals.fatTarget === 0 && safeGoals.carbsTarget === 0) {
      return { extraCalories: 0, extraProtein: 0, extraFat: 0, extraCarbs: 0 };
    }

    return {
      extraCalories: Math.max(0, safeActual.calories - safeGoals.caloriesTarget),
      extraProtein: Math.max(0, safeActual.protein - safeGoals.proteinTarget),
      extraFat: Math.max(0, safeActual.fat - safeGoals.fatTarget),
      extraCarbs: Math.max(0, safeActual.carbs - safeGoals.carbsTarget),
    };
  }

  /**
   * Агрегирует «лишнее» за период
   * 
   * Вход:
   * - список дней (DailyMeals[])
   * - лишнее за каждый день (DailyExcess[])
   * 
   * Выход:
   * - суммарное лишнее за период
   * - массив лишнего по дням (для графиков в будущем)
   * 
   * @param dailyMeals - список дней с приёмами пищи
   * @param dailyExcessList - массив лишнего за каждый день
   * @returns Объект с суммарным лишним и массивом по дням
   */
  aggregatePeriodExcess(
    dailyMeals: DailyMeals[],
    dailyExcessList: DailyExcess[]
  ): PeriodExcess {
    // Суммируем лишнее за весь период
    const totals = dailyExcessList.reduce(
      (acc, excess) => ({
        totalExtraCalories: acc.totalExtraCalories + excess.extraCalories,
        totalExtraProtein: acc.totalExtraProtein + excess.extraProtein,
        totalExtraFat: acc.totalExtraFat + excess.extraFat,
        totalExtraCarbs: acc.totalExtraCarbs + excess.extraCarbs,
      }),
      {
        totalExtraCalories: 0,
        totalExtraProtein: 0,
        totalExtraFat: 0,
        totalExtraCarbs: 0,
      }
    );

    // Формируем массив лишнего по дням с датами
    const dailyExcess: DailyExcessWithDate[] = dailyMeals.map((daily, index) => ({
      date: daily.date,
      ...dailyExcessList[index],
    }));

    return {
      ...totals,
      dailyExcess,
    };
  }

  /**
   * Рассчитывает калории из сладкого и мучного за период
   * 
   * Вход:
   * - список дней (DailyMeals[])
   * - массив лишнего за каждый день (DailyExcess[])
   * - массив фактического потребления за каждый день (ActualConsumption[])
   * - дневные цели (DailyGoals)
   * 
   * Рассчитать:
   * - всего калорий из сладкого
   * - всего калорий из мучного
   * - сколько из них попало в «лишнее»
   * 
   * ВАЖНО:
   * - если продукт не превышает цель — он не считается лишним
   * - лишние калории рассчитываются пропорционально превышению нормы
   * 
   * @param dailyMeals - список дней с приёмами пищи
   * @param dailyExcessList - массив лишнего за каждый день
   * @param dailyActualList - массив фактического потребления за каждый день
   * @param goals - дневные цели пользователя
   * @returns Объект с калориями из сладкого и мучного
   */
  calculateSweetAndFlourCalories(
    dailyMeals: DailyMeals[],
    dailyExcessList: DailyExcess[],
    dailyActualList: ActualConsumption[],
    _goals: DailyGoals
  ): SweetAndFlourCalories {
    let totalSweetCalories = 0;
    let totalFlourCalories = 0;
    let extraSweetCalories = 0;
    let extraFlourCalories = 0;

    dailyMeals.forEach((daily, index) => {
      const excess = dailyExcessList[index];
      const actual = dailyActualList[index];
      
      // Собираем все записи за день
      const allEntries: MealEntry[] = [
        ...daily.breakfast,
        ...daily.lunch,
        ...daily.dinner,
        ...daily.snack,
      ];

      let daySweetCalories = 0;
      let dayFlourCalories = 0;

      // Считаем калории из сладкого и мучного
      allEntries.forEach((entry) => {
        if (this.isSweet(entry.food)) {
          daySweetCalories += entry.calories || 0;
        }
        if (this.isFlour(entry.food)) {
          dayFlourCalories += entry.calories || 0;
        }
      });

      totalSweetCalories += daySweetCalories;
      totalFlourCalories += dayFlourCalories;

      // Рассчитываем лишние калории из сладкого и мучного
      // ВАЖНО: если продукт не превышает цель — он не считается лишним
      // Лишние калории рассчитываются пропорционально превышению нормы
      if (excess.extraCalories > 0 && actual.calories > 0) {
        // Коэффициент превышения: сколько процентов от факта составляет лишнее
        const excessRatio = excess.extraCalories / actual.calories;
        
        // Лишние калории из сладкого = калории из сладкого × коэффициент превышения
        extraSweetCalories += daySweetCalories * excessRatio;
        extraFlourCalories += dayFlourCalories * excessRatio;
      }
    });

    return {
      totalSweetCalories,
      totalFlourCalories,
      extraSweetCalories,
      extraFlourCalories,
    };
  }

  /**
   * Определяет уровень лишнего по калориям
   * 
   * Правила:
   * - < 100 → «незначительно» (low)
   * - 100–300 → «умеренно» (moderate)
   * - > 300 → «много» (high)
   * - 0 → «нет» (none)
   * 
   * @param extraCalories - лишние калории
   * @returns Уровень лишнего
   */
  getExcessLevel(extraCalories: number): ExcessLevel {
    if (extraCalories === 0) {
      return 'none';
    }
    if (extraCalories < 100) {
      return 'low';
    }
    if (extraCalories <= 300) {
      return 'moderate';
    }
    return 'high';
  }

  /**
   * Получает текстовое объяснение лишнего по калориям
   * 
   * @param extraCalories - лишние калории
   * @returns Текстовое объяснение
   */
  getExcessText(extraCalories: number): string {
    const level = this.getExcessLevel(extraCalories);
    switch (level) {
      case 'none':
        return 'нет';
      case 'low':
        return 'незначительно';
      case 'moderate':
        return 'умеренно';
      case 'high':
        return 'много';
      default:
        return 'нет';
    }
  }

  /**
   * Определяет статус дня на основе лишнего
   * 
   * Правила:
   * - extraCalories === 0 → «в норме» (normal)
   * - extraCalories > 0 && <= 300 → «перебор» (excess)
   * - extraCalories > 300 → «значительный перебор» (significant_excess)
   * 
   * @param excess - лишнее за день
   * @returns Статус дня
   */
  getDayStatus(excess: DailyExcess): DayStatus {
    if (excess.extraCalories === 0) {
      return 'normal';
    }
    if (excess.extraCalories <= 300) {
      return 'excess';
    }
    return 'significant_excess';
  }

  /**
   * Получает текстовое описание статуса дня
   * 
   * @param status - статус дня
   * @returns Текстовое описание
   */
  getDayStatusText(status: DayStatus): string {
    switch (status) {
      case 'normal':
        return 'в норме';
      case 'excess':
        return 'перебор';
      case 'significant_excess':
        return 'значительный перебор';
      default:
        return 'в норме';
    }
  }

  /**
   * Получает полную интерпретацию лишнего за день
   * 
   * Включает:
   * - уровень лишнего по каждому показателю
   * - статус дня
   * 
   * @param excess - лишнее за день
   * @returns Интерпретация лишнего
   */
  interpretExcess(excess: DailyExcess): ExcessInterpretation {
    return {
      calories: this.getExcessLevel(excess.extraCalories),
      protein: this.getExcessLevel(excess.extraProtein),
      fat: this.getExcessLevel(excess.extraFat),
      carbs: this.getExcessLevel(excess.extraCarbs),
      dayStatus: this.getDayStatus(excess),
    };
  }
}

export const goalsService = new GoalsService();

