import { pieceWeights } from '../data/unitConversions';

export type NormalizedUnit = 'g' | 'ml' | 'pcs' | null;

export interface ParsedRecipeIngredient {
  original: string;
  name: string;
  amount: number | null; // в базовых единицах (g/ml/pcs) ПОСЛЕ преобразования по правилам
  unit: NormalizedUnit;
  amountText: string; // для отображения (с исходной единицей)
  amountGrams: number; // для расчётов (всегда в граммах)
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

// Слова, которые нужно удалить из названия продукта
const UNITS_TO_REMOVE_FROM_NAME = [
  'г', 'гр', 'грамм', 'грамма', 'граммов',
  'кг', 'килограмм', 'килограммов',
  'мл', 'миллилитр', 'миллилитров',
  'л', 'литр', 'литра', 'литров',
  'шт', 'штук', 'штуки', 'штука', 'куск', 'кусок', 'кусочка',
  'долька', 'дольки', 'долей',
  'зубчик', 'зубчика', 'зубчиков',
  'ч.л.', 'ч. л.', 'ч л', 'чайная ложка', 'чайные ложки',
  'ст.л.', 'ст. л.', 'ст л', 'столовая ложка', 'столовые ложки',
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
 */
function cleanProductName(text: string): string {
  let cleaned = text;

  // Удаляем все единицы измерения (регистронезависимо)
  for (const unit of UNITS_TO_REMOVE_FROM_NAME) {
    const regex = new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // Удаляем числа
  cleaned = cleaned.replace(/\d+[.,]?\d*/g, ' ');

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
  let name = original;

  if (unitInfo) {
    // Удаляем единицу
    const beforeUnit = name.substring(0, unitInfo.matchStart);
    const afterUnit = name.substring(unitInfo.matchEnd);
    name = (beforeUnit + ' ' + afterUnit).replace(/\s+/g, ' ').trim();

    // Удаляем число
    name = name.replace(amountDisplay, ' ').replace(/\s+/g, ' ').trim();
  } else {
    // Если единица не найдена, удаляем только число
    name = name.replace(amountDisplay, ' ').replace(/\s+/g, ' ').trim();
  }

  // ШАГ 4: Очищаем название от всех единиц измерения
  name = cleanProductName(name);

  // ШАГ 5: Нормализуем название продукта
  name = normalizeProductName(name);

  // ШАГ 6: Определяем финальную единицу и преобразуем amount
  let finalUnit: NormalizedUnit = unitInfo?.unit.norm || null;
  let finalAmount: number | null = null;
  let finalDisplay = unitInfo?.unit.display || '';

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
    if (unitInfo?.unit.display.includes('ч.л.') || unitInfo?.unit.display.includes('ст.л.')) {
      // Для ложек показываем исходное количество и единицу ложки
      amountText = `${amountDisplay} ${unitInfo.unit.display}`;
    } else if (finalUnit === 'ml' && unitInfo?.unit.factor === 1000) {
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

  return {
    original,
    name: name || original,
    amount: finalAmount,
    unit: finalUnit,
    amountText: amountText.trim(),
    amountGrams: Math.round(amountGrams * 100) / 100,
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
