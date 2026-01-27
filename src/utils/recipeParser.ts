import { pieceWeights } from '../data/unitConversions';

export type NormalizedUnit = 'g' | 'ml' | 'pcs' | null;

export interface ParsedRecipeIngredient {
  original: string;
  name: string;
  amount: number | null; // в базовых единицах (g/ml/pcs) ПОСЛЕ преобразования по правилам
  unit: NormalizedUnit;
  amountText: string; // для отображения (с исходной единицей)
  amountGrams: number; // для расчётов (всегда в граммах)
  displayAmount: string | null; // исходное количество для отображения
  displayUnit: string | null; // исходная единица для отображения
}

// ============================================
// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
// ============================================

// Диапазон: "1–2", "2-3"
const RANGE_REGEX = /(\d+[.,]?\d*)\s*[–-]\s*(\d+[.,]?\d*)/;

// Обычное число: "250", "0.5", "1,5"
const NUMBER_REGEX = /\d+[.,]?\d*/;

// ============================================
// СЛОВАРЬ ЕДИНИЦ ИЗМЕРЕНИЯ
// ============================================

interface UnitDefinition {
  patterns: RegExp[]; // Регулярные выражения для поиска
  norm: NormalizedUnit; // Нормализованная единица
  factor: number; // Множитель для преобразования в базовую единицу
  display: string; // Для отображения
}

// ВАЖНО: Порядок имеет значение! Ложки проверяются ПЕРВЫМИ, чтобы не путать с "л"
const UNIT_DEFINITIONS: UnitDefinition[] = [
  // ЛОЖКИ (приоритет 1 - проверяем ДО "л")
  {
    patterns: [
      /\bч\.?\s*л\.?\b/i,
      /\bч\s*л\b/i,
      /\bчайная\s+ложка\b/i,
      /\bчайные\s+ложки\b/i,
      /\bчайн\.?\s*ложка\b/i,
    ],
    norm: 'ml',
    factor: 5, // 1 ч.л. = 5 мл
    display: 'ч.л.',
  },
  {
    patterns: [
      /\bст\.?\s*л\.?\b/i,
      /\bст\s*л\b/i,
      /\bстоловая\s+ложка\b/i,
      /\bстоловые\s+ложки\b/i,
      /\bст\.?\s*ложка\b/i,
    ],
    norm: 'ml',
    factor: 15, // 1 ст.л. = 15 мл
    display: 'ст.л.',
  },
  // МАССА
  {
    patterns: [/\bкг\b/i, /\bкилограмм\b/i, /\bкилограммов\b/i],
    norm: 'g',
    factor: 1000, // 1 кг = 1000 г
    display: 'кг',
  },
  {
    patterns: [/\bгр?\b/i, /\bграмм\b/i, /\bграмма\b/i, /\bграммов\b/i],
    norm: 'g',
    factor: 1, // 1 г = 1 г
    display: 'г',
  },
  // ОБЪЁМ (проверяем ПОСЛЕ ложок, чтобы не путать "ч.л." с "л")
  {
    patterns: [/\bл\b/i, /\bлитр\b/i, /\bлитра\b/i, /\bлитров\b/i],
    norm: 'ml',
    factor: 1000, // 1 л = 1000 мл
    display: 'л',
  },
  {
    patterns: [/\bмл\b/i, /\bмиллилитр\b/i, /\bмиллилитров\b/i],
    norm: 'ml',
    factor: 1, // 1 мл = 1 мл
    display: 'мл',
  },
  // ШТУЧНЫЕ
  {
    patterns: [/\bшт\b/i, /\bштук\b/i, /\bштуки\b/i, /\bштука\b/i, /\bкуск\b/i, /\bкусок\b/i, /\bкусочка\b/i],
    norm: 'pcs',
    factor: 1,
    display: 'шт',
  },
  {
    patterns: [/\bдольк\w*\b/i, /\bдолей\b/i],
    norm: 'pcs',
    factor: 1,
    display: 'шт',
  },
  {
    patterns: [/\bзубчик\w*\b/i],
    norm: 'pcs',
    factor: 1,
    display: 'шт',
  },
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Парсит число из строки (поддерживает диапазоны, запятые, точки)
 */
function parseNumber(text: string): { value: number; originalText: string } | null {
  // Сначала проверяем диапазон
  const rangeMatch = text.match(RANGE_REGEX);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    if (!isNaN(a) && !isNaN(b)) {
      return {
        value: (a + b) / 2, // среднее значение
        originalText: rangeMatch[0],
      };
    }
  }

  // Обычное число
  const numMatch = text.match(NUMBER_REGEX);
  if (numMatch) {
    const num = parseFloat(numMatch[0].replace(',', '.'));
    if (!isNaN(num)) {
      return {
        value: num,
        originalText: numMatch[0],
      };
    }
  }

  return null;
}

/**
 * Находит единицу измерения в тексте рядом с числом
 * Возвращает информацию о единице и её позицию
 */
function findUnitNearNumber(
  text: string,
  numberStart: number,
  numberEnd: number
): { unit: UnitDefinition; match: string; matchStart: number; matchEnd: number } | null {
  // Ищем единицу после числа (в пределах 10 символов)
  const textAfter = text.substring(numberEnd, Math.min(text.length, numberEnd + 10));
  for (const unitDef of UNIT_DEFINITIONS) {
    for (const pattern of unitDef.patterns) {
      const match = textAfter.match(new RegExp(`^\\s*${pattern.source}`, 'i'));
      if (match) {
        return {
          unit: unitDef,
          match: match[0].trim(),
          matchStart: numberEnd + textAfter.indexOf(match[0]),
          matchEnd: numberEnd + textAfter.indexOf(match[0]) + match[0].length,
        };
      }
    }
  }

  // Ищем единицу перед числом (в пределах 10 символов)
  const textBefore = text.substring(Math.max(0, numberStart - 10), numberStart);
  for (const unitDef of UNIT_DEFINITIONS) {
    for (const pattern of unitDef.patterns) {
      const match = textBefore.match(new RegExp(`${pattern.source}\\s*$`, 'i'));
      if (match) {
        const matchStart = numberStart - 10 + textBefore.lastIndexOf(match[0]);
        return {
          unit: unitDef,
          match: match[0].trim(),
          matchStart: Math.max(0, matchStart),
          matchEnd: Math.max(0, matchStart) + match[0].length,
        };
      }
    }
  }

  return null;
}

/**
 * Очищает название продукта от единиц измерения и чисел
 * Удаляет ВСЕ варианты единиц, включая с точками и пробелами
 */
function cleanProductName(text: string): string {
  let cleaned = text;

  // Удаляем все варианты единиц измерения (регистронезависимо)
  // Используем более агрессивное удаление для ложек и других единиц с точками
  // БЕЗ границ слов для ложек, чтобы гарантировать удаление
  const unitPatterns = [
    // Ложки (разные варианты написания) - БЕЗ границ слов для более агрессивного удаления
    /ч\.?\s*л\.?/gi,
    /ч\s*л\b/gi,
    /чайная\s+ложка/gi,
    /чайные\s+ложки/gi,
    /чайн\.?\s*ложка/gi,
    /ст\.?\s*л\.?/gi,
    /ст\s*л\b/gi,
    /столовая\s+ложка/gi,
    /столовые\s+ложки/gi,
    /ст\.?\s*ложка/gi,
    // Масса
    /\bкг\b/gi,
    /\bкилограмм\b/gi,
    /\bкилограммов\b/gi,
    /\bгр?\b/gi,
    /\bграмм\b/gi,
    /\bграмма\b/gi,
    /\bграммов\b/gi,
    // Объём
    /\bл\b(?!\w)/gi, // "л" не должен быть частью слова (например, "молока")
    /\bлитр\b/gi,
    /\bлитра\b/gi,
    /\bлитров\b/gi,
    /\bмл\b/gi,
    /\bмиллилитр\b/gi,
    /\bмиллилитров\b/gi,
    // Штучные
    /\bшт\b/gi,
    /\bштук\b/gi,
    /\bштуки\b/gi,
    /\bштука\b/gi,
    /\bкуск\b/gi,
    /\bкусок\b/gi,
    /\bкусочка\b/gi,
    // Дольки/зубчики
    /\bдольк\w*\b/gi,
    /\bдолей\b/gi,
    /\bзубчик\w*\b/gi,
  ];

  // Удаляем все единицы несколько раз для гарантии
  for (let i = 0; i < 3; i++) {
    for (const pattern of unitPatterns) {
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  // Удаляем числа (включая диапазоны)
  cleaned = cleaned.replace(/\d+[.,]?\d*/g, ' ');
  cleaned = cleaned.replace(/\d+\s*[–-]\s*\d+/g, ' ');

  // Удаляем лишние символы и пробелы
  cleaned = cleaned.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Нормализует название продукта (убирает окончания для некоторых продуктов)
 */
function normalizeProductName(name: string): string {
  let normalized = name.trim();

  // "чеснока" → "чеснок"
  if (normalized.toLowerCase().endsWith('чеснока')) {
    normalized = normalized.replace(/чеснока$/i, 'чеснок');
  }

  // "морковки" → "морковь"
  if (normalized.toLowerCase().endsWith('морковки')) {
    normalized = normalized.replace(/морковки$/i, 'морковь');
  }

  // "масла" → "масло"
  if (normalized.toLowerCase().endsWith('масла')) {
    normalized = normalized.replace(/масла$/i, 'масло');
  }

  // "масла оливкового" → "масло оливковое"
  if (normalized.toLowerCase().includes('масла оливкового')) {
    normalized = normalized.replace(/масла оливкового/gi, 'масло оливковое');
  }

  // "масла оливкового" → "масло оливковое" (если в конце)
  if (normalized.toLowerCase().endsWith('масла оливкового')) {
    normalized = normalized.replace(/масла оливкового$/i, 'масло оливковое');
  }

  return normalized.trim();
}

/**
 * Преобразует amount в граммы для расчётов
 */
function convertToGrams(amount: number, unit: NormalizedUnit, productName: string): number {
  if (unit === 'g') {
    return amount;
  } else if (unit === 'ml') {
    return amount; // плотность ~1 для воды/жидкостей
  } else if (unit === 'pcs') {
    // Ищем средний вес для продукта
    const lowerName = productName.toLowerCase();
    const key = Object.keys(pieceWeights).find((k) => lowerName.includes(k));
    const pieceWeight = key ? pieceWeights[key] : 50; // по умолчанию 50г
    return amount * pieceWeight;
  }
  return 0;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ПАРСИНГА
// ============================================

/**
 * Парсит одну строку ингредиента
 * Строго следует правилам:
 * 1. Сначала находим число
 * 2. Затем находим единицу рядом с числом
 * 3. Удаляем число и единицу из строки
 * 4. Очищаем название от всех единиц
 * 5. Нормализуем единицы по правилам
 */
function parseLine(rawLine: string): ParsedRecipeIngredient | null {
  const original = rawLine.trim();
  if (!original) return null;

  // ШАГ 1: Находим число (может быть диапазон)
  // Сначала проверяем формат "250-грамм" (число с дефисом и единицей)
  const hyphenUnitMatch = original.match(/(\d+[.,]?\d*)\s*-\s*(грамм|гр|г|кг|литр|л|мл)/i);
  let numberInfo: { value: number; originalText: string } | null = null;
  let unitFromHyphen: UnitDefinition | null = null;

  if (hyphenUnitMatch) {
    const num = parseFloat(hyphenUnitMatch[1].replace(',', '.'));
    if (!isNaN(num)) {
      numberInfo = { value: num, originalText: hyphenUnitMatch[0] };
      // Находим единицу для этого формата
      const unitText = hyphenUnitMatch[2].toLowerCase();
      for (const unitDef of UNIT_DEFINITIONS) {
        for (const pattern of unitDef.patterns) {
          if (pattern.test(unitText)) {
            unitFromHyphen = unitDef;
            break;
          }
        }
        if (unitFromHyphen) break;
      }
    }
  }

  // Если не нашли в формате "250-грамм", ищем обычное число
  if (!numberInfo) {
    numberInfo = parseNumber(original);
  }

  if (!numberInfo) {
    // Если нет числа, возвращаем только название
    const cleanedName = cleanProductName(original);
    return {
      original,
      name: cleanedName || original,
      amount: null,
      unit: null,
      amountText: cleanedName || original,
      amountGrams: 0,
    };
  }

  const { value: amountValue, originalText: amountDisplay } = numberInfo;

  // Находим позицию числа в строке
  const numberIndex = original.indexOf(amountDisplay);
  const numberStart = numberIndex;
  const numberEnd = numberStart + amountDisplay.length;

  // ШАГ 2: Находим единицу измерения рядом с числом
  // Если единица уже найдена из формата "250-грамм", используем её
  let unitInfo: { unit: UnitDefinition; match: string; matchStart: number; matchEnd: number } | null = null;
  
  if (unitFromHyphen) {
    // Единица уже найдена из формата "250-грамм"
    unitInfo = {
      unit: unitFromHyphen,
      match: hyphenUnitMatch![2],
      matchStart: numberEnd,
      matchEnd: numberEnd + hyphenUnitMatch![2].length,
    };
  } else {
    // Ищем единицу рядом с числом
    unitInfo = findUnitNearNumber(original, numberStart, numberEnd);
  }

  // ШАГ 3: Удаляем число и единицу из строки, чтобы получить название продукта
  // Используем регулярные выражения для более точного удаления
  let name = original;

  if (unitInfo) {
    // Создаём паттерн для удаления единицы (экранируем спецсимволы)
    const unitMatchEscaped = unitInfo.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberEscaped = amountDisplay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Удаляем паттерн "число единица" или "единица число" (с пробелами и без)
    // Для ложек используем более агрессивное удаление без границ слов
    const isSpoon = unitInfo.unit.display.includes('ч.л.') || unitInfo.unit.display.includes('ст.л.');
    const unitPatternForRemoval = isSpoon 
      ? unitMatchEscaped.replace(/\\b/g, '') // Убираем границы слов для ложек
      : unitMatchEscaped;
    
    const patterns = [
      // "число единица" (с пробелами)
      new RegExp(`\\b${numberEscaped}\\s+${unitPatternForRemoval}${isSpoon ? '' : '\\b'}`, 'gi'),
      // "единица число" (с пробелами)
      new RegExp(`${isSpoon ? '' : '\\b'}${unitPatternForRemoval}\\s+${numberEscaped}\\b`, 'gi'),
      // "числоединица" или "единицачисло" (без пробелов)
      new RegExp(`${numberEscaped}${unitPatternForRemoval}|${unitPatternForRemoval}${numberEscaped}`, 'gi'),
    ];

    let removed = false;
    for (const pattern of patterns) {
      if (pattern.test(name)) {
        name = name.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
        removed = true;
        break;
      }
    }

    // Если не удалось удалить вместе, удаляем по отдельности
    if (!removed) {
      // Удаляем единицу (используем все варианты паттернов единицы из определения)
      // Для ложек используем более агрессивное удаление без границ слов
      for (const pattern of unitInfo.unit.patterns) {
        // Для ложек убираем границы слов для более агрессивного удаления
        if (unitInfo.unit.display.includes('ч.л.') || unitInfo.unit.display.includes('ст.л.')) {
          // Удаляем без границ слов
          const patternStr = pattern.source;
          const patternWithoutBoundaries = patternStr.replace(/\\b/g, '');
          name = name.replace(new RegExp(patternWithoutBoundaries, 'gi'), ' ');
        } else {
          name = name.replace(pattern, ' ');
        }
      }
      
      // Также удаляем по точному совпадению единицы
      name = name.replace(new RegExp(unitMatchEscaped.replace(/\\b/g, ''), 'gi'), ' ');
      
      // Удаляем число
      name = name.replace(new RegExp(`\\b${numberEscaped}\\b`, 'gi'), ' ');
      name = name.replace(/\s+/g, ' ').trim();
    }
  } else {
    // Если единица не найдена, удаляем только число
    const numberEscaped = amountDisplay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp(`\\b${numberEscaped}\\b`, 'gi'), ' ');
    name = name.replace(/\s+/g, ' ').trim();
  }

  // ШАГ 4: Очищаем название от всех единиц измерения
  name = cleanProductName(name);

  // ШАГ 4.5: Дополнительная агрессивная очистка от единиц (на случай, если что-то пропустили)
  // Удаляем все возможные варианты единиц еще раз, включая с точками и пробелами
  const additionalUnitPatterns = [
    /ч\.?\s*л\.?/gi,
    /ст\.?\s*л\.?/gi,
    /ч\s*л\b/gi,
    /ст\s*л\b/gi,
    /\bгр?\b/gi,
    /\bкг\b/gi,
    /\bл\b(?!\w)/gi,
    /\bмл\b/gi,
    /\bшт\b/gi,
    /\bграмм\w*\b/gi,
    /\bлитр\w*\b/gi,
    /\bмиллилитр\w*\b/gi,
    /\bштук\w*\b/gi,
    /\bдольк\w*\b/gi,
    /\bзубчик\w*\b/gi,
    /чайная\s+ложка/gi,
    /столовая\s+ложка/gi,
  ];
  
  for (const pattern of additionalUnitPatterns) {
    name = name.replace(pattern, ' ');
  }
  name = name.replace(/\s+/g, ' ').trim();

  // ШАГ 5: Нормализуем название продукта
  name = normalizeProductName(name);
  
  // ШАГ 5.5: Финальная проверка - удаляем единицы еще раз после нормализации
  name = cleanProductName(name);
  
  // ШАГ 5.6: Финальная проверка - если в названии все еще есть единицы, удаляем их
  // Проверяем наличие единиц в названии и удаляем их
  const unitCheckPatterns = [
    /\bч\.?\s*л\.?\b/gi,
    /\bст\.?\s*л\.?\b/gi,
    /\bч\s*л\b/gi,
    /\bст\s*л\b/gi,
    /\bгр?\b/gi,
    /\bкг\b/gi,
    /\bл\b(?!\w)/gi,
    /\bмл\b/gi,
    /\bшт\b/gi,
    /\bграмм\w*\b/gi,
    /\bлитр\w*\b/gi,
    /\bмиллилитр\w*\b/gi,
    /\bштук\w*\b/gi,
    /\bдольк\w*\b/gi,
    /\bзубчик\w*\b/gi,
  ];
  
  let hasUnits = false;
  for (const pattern of unitCheckPatterns) {
    if (pattern.test(name)) {
      hasUnits = true;
      break;
    }
  }
  
  if (hasUnits) {
    // Если единицы все еще есть, удаляем их еще раз
    for (const pattern of unitCheckPatterns) {
      name = name.replace(pattern, ' ');
    }
    name = name.replace(/\s+/g, ' ').trim();
  }

  // ШАГ 6: Определяем финальную единицу и преобразуем amount
  let finalUnit: NormalizedUnit = unitInfo?.unit.norm || null;
  let finalAmount: number | null = null;
  let finalDisplay = unitInfo?.unit.display || '';

  // Дополнительная проверка: если unitInfo определен, но finalDisplay пустой, используем unitInfo.unit.display
  if (unitInfo && !finalDisplay) {
    finalDisplay = unitInfo.unit.display;
  }

  if (unitInfo && amountValue !== null) {
    // Преобразуем amount по правилам
    finalAmount = amountValue * unitInfo.unit.factor;
  } else if (amountValue !== null) {
    // Если единица не найдена, но есть число, используем граммы по умолчанию
    finalUnit = 'g';
    finalAmount = amountValue;
    finalDisplay = 'г';
  }

  // ШАГ 7: Формируем строку для отображения
  let amountText = '';
  if (amountValue !== null && finalDisplay) {
    // Проверяем по finalDisplay, чтобы гарантировать правильное отображение
    if (finalDisplay.includes('ч.л.') || finalDisplay.includes('ст.л.')) {
      // Для ложек показываем исходное количество и единицу ложки
      amountText = `${amountDisplay} ${finalDisplay}`;
    } else if (finalUnit === 'ml' && unitInfo?.unit.factor === 1000 && unitInfo?.unit.display === 'л') {
      // Для литров показываем в мл
      amountText = `${finalAmount} мл`;
    } else {
      // Для остальных показываем исходное количество и единицу
      amountText = `${amountDisplay} ${finalDisplay}`;
    }
  } else if (amountValue !== null) {
    amountText = amountDisplay;
  }

  // ШАГ 8: Конвертируем в граммы для расчётов
  const amountGrams =
    finalAmount !== null && finalUnit ? convertToGrams(finalAmount, finalUnit, name) : 0;

  // ФИНАЛЬНАЯ ПРОВЕРКА: убеждаемся, что название не содержит единиц измерения и чисел
  // Если единицы все еще есть, удаляем их еще раз
  const finalCleanPatterns = [
    /\bч\.?\s*л\.?\b/gi,
    /\bст\.?\s*л\.?\b/gi,
    /\bч\s*л\b/gi,
    /\bст\s*л\b/gi,
    /\bгр?\b/gi,
    /\bкг\b/gi,
    /\bл\b(?!\w)/gi,
    /\bмл\b/gi,
    /\bшт\b/gi,
    /\bграмм\w*\b/gi,
    /\bлитр\w*\b/gi,
    /\bмиллилитр\w*\b/gi,
    /\bштук\w*\b/gi,
    /\bдольк\w*\b/gi,
    /\bзубчик\w*\b/gi,
    // Удаляем все числа (включая диапазоны и десятичные)
    /\d+[.,]?\d*\s*[–-]\s*\d+[.,]?\d*/g, // диапазоны
    /\d+[.,]?\d*/g, // обычные числа
  ];
  
  let cleanedName = name;
  for (const pattern of finalCleanPatterns) {
    cleanedName = cleanedName.replace(pattern, ' ');
  }
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();
  
  // Дополнительная очистка: удаляем любые оставшиеся числа и единицы
  cleanedName = cleanedName.replace(/\d+/g, ''); // удаляем все числа
  
  // Агрессивное удаление единиц измерения (включая с точками и запятыми)
  const unitPatternsAggressive = [
    /\bгр?\.?\b/gi,  // г, гр, гр.
    /\bкг\.?\b/gi,   // кг, кг.
    /\bл\.?\b(?!\w)/gi,  // л, л. (но не часть слова)
    /\bмл\.?\b/gi,   // мл, мл.
    /\bшт\.?\b/gi,   // шт, шт.
    /\bграмм\w*\.?\b/gi,
    /\bлитр\w*\.?\b/gi,
    /\bмиллилитр\w*\.?\b/gi,
    /\bштук\w*\.?\b/gi,
    /\bдольк\w*\.?\b/gi,
    /\bзубчик\w*\.?\b/gi,
    /\bч\.?\s*л\.?\b/gi,
    /\bст\.?\s*л\.?\b/gi,
  ];
  
  // Применяем несколько раз для гарантии
  for (let i = 0; i < 3; i++) {
    for (const pattern of unitPatternsAggressive) {
      cleanedName = cleanedName.replace(pattern, ' ');
    }
  }
  
  // Удаляем возможные ведущие/висячие токены единиц (включая с точками)
  cleanedName = cleanedName.replace(
    /(^|\s)(г|гр|кг|мл|л|шт|грамм\w*|литр\w*|миллилитр\w*|штук\w*|дольк\w*|зубчик\w*|ч\.?\s*л\.?|ст\.?\s*л\.?)(\.|,|\s|$)/gi,
    ' '
  );
  
  // Удаляем точки и запятые, которые могли остаться
  cleanedName = cleanedName.replace(/[.,;]/g, ' ');
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

  const displayAmount = amountValue !== null ? amountDisplay : null;
  const displayUnit = finalDisplay || null;

  return {
    original,
    name: cleanedName || original,
    amount: finalAmount,
    unit: finalUnit,
    amountText: amountText.trim(),
    amountGrams: Math.round(amountGrams * 100) / 100,
    displayAmount,
    displayUnit,
  };
}

/**
 * Парсит текст рецепта и возвращает массив ингредиентов
 */
export function parseRecipeText(text: string): ParsedRecipeIngredient[] {
  if (!text || !text.trim()) return [];

  // Разбиваем по запятым и переносам строк
  const lines = text
    .split(/[,\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map(parseLine).filter((v): v is ParsedRecipeIngredient => v !== null);
}

// ============================================
// АВТОТЕСТЫ
// ============================================

/**
 * Запуск автотестов (для проверки корректности парсера)
 * Вызывать в консоли браузера для отладки
 */
export function runParserTests(): void {
  const tests: Array<{ input: string; expected: Partial<ParsedRecipeIngredient> }> = [
    {
      input: '250 г говядина постная',
      expected: { name: 'говядина постная', amount: 250, unit: 'g' },
    },
    {
      input: 'говядина постная 250 г',
      expected: { name: 'говядина постная', amount: 250, unit: 'g' },
    },
    {
      input: '1–2 шт. морковки',
      expected: { name: 'морковь', amount: 1.5, unit: 'pcs' },
    },
    {
      input: 'чеснока 3 дольки',
      expected: { name: 'чеснок', amount: 3, unit: 'pcs' },
    },
    {
      input: '1 ч.л. масла',
      expected: { name: 'масло', amount: 5, unit: 'ml' },
    },
    {
      input: 'масла оливкового 1 ч.л.',
      expected: { name: 'масло оливковое', amount: 5, unit: 'ml' },
    },
    {
      input: '2 ст.л. муки',
      expected: { name: 'мука', amount: 30, unit: 'ml' },
    },
    {
      input: '1 л молока',
      expected: { name: 'молоко', amount: 1000, unit: 'ml' },
    },
    {
      input: 'молока 1 л',
      expected: { name: 'молоко', amount: 1000, unit: 'ml' },
    },
    {
      input: '10 гр сыра',
      expected: { name: 'сыр', amount: 10, unit: 'g' },
    },
    {
      input: '0.5 ч.л. куркумы',
      expected: { name: 'куркума', amount: 2.5, unit: 'ml' },
    },
    {
      input: '250-грамм говядина',
      expected: { name: 'говядина', amount: 250, unit: 'g' },
    },
  ];

  console.log('🧪 Запуск автотестов парсера ингредиентов...\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = parseRecipeText(test.input);
    const parsed = result[0];

    if (!parsed) {
      console.error(`❌ FAIL: "${test.input}" → не распарсилось`);
      failed++;
      continue;
    }

    const checks = [
      parsed.name === test.expected.name,
      parsed.amount === test.expected.amount,
      parsed.unit === test.expected.unit,
    ];

    if (checks.every((c) => c)) {
      console.log(`✅ PASS: "${test.input}"`);
      console.log(`   → name: "${parsed.name}", amount: ${parsed.amount}, unit: ${parsed.unit}`);
      passed++;
    } else {
      console.error(`❌ FAIL: "${test.input}"`);
      console.error(`   Ожидалось: name="${test.expected.name}", amount=${test.expected.amount}, unit=${test.expected.unit}`);
      console.error(`   Получено:  name="${parsed.name}", amount=${parsed.amount}, unit=${parsed.unit}`);
      failed++;
    }
  }

  console.log(`\n📊 Результаты: ${passed} прошло, ${failed} провалено из ${tests.length}`);
}
