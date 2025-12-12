import { pieceWeights } from '../data/unitConversions';

export type NormalizedUnit = 'g' | 'ml' | 'pcs' | null;

export interface ParsedRecipeIngredient {
  original: string;
  name: string;
  amount: number | null; // в базовых единицах (g/ml/pcs)
  unit: NormalizedUnit;
  amountText: string; // для отображения (с исходной единицей)
  amountGrams: number; // для расчётов (всегда в граммах)
}

// Регулярные выражения для поиска
const RANGE_REGEX = /(\d+[.,]?\d*)\s*[–-]\s*(\d+[.,]?\d*)/;
const FRACTION_REGEX = /(\d+)\s*\/\s*(\d+)/;
const NUMBER_REGEX = /\d+[.,]?\d*/;

// Карта единиц измерения с приоритетом (длинные единицы проверяются первыми)
// Используем границы слов (\b) где возможно, чтобы не путать с частями других слов
const UNIT_PATTERNS: Array<{
  pattern: RegExp;
  norm: NormalizedUnit;
  factor: number; // множитель для конвертации в базовую единицу
  display: string; // для отображения
}> = [
  // Ложки (ВАЖНО: проверяем ДО "л", чтобы не путать "ч.л." с "л")
  { pattern: /\bч\.?\s*л\.?\b/i, norm: 'ml', factor: 5, display: 'ч.л.' },
  { pattern: /\bчайная\s+ложка\b/i, norm: 'ml', factor: 5, display: 'ч.л.' },
  { pattern: /\bчайные\s+ложки\b/i, norm: 'ml', factor: 5, display: 'ч.л.' },
  { pattern: /\bчайн\.?\s*ложка\b/i, norm: 'ml', factor: 5, display: 'ч.л.' },
  { pattern: /\bст\.?\s*л\.?\b/i, norm: 'ml', factor: 15, display: 'ст.л.' },
  { pattern: /\bстоловая\s+ложка\b/i, norm: 'ml', factor: 15, display: 'ст.л.' },
  { pattern: /\bстоловые\s+ложки\b/i, norm: 'ml', factor: 15, display: 'ст.л.' },
  { pattern: /\bст\.?\s*ложка\b/i, norm: 'ml', factor: 15, display: 'ст.л.' },
  // Вес
  { pattern: /\bкг\b|\bкилограмм\b/i, norm: 'g', factor: 1000, display: 'кг' },
  { pattern: /\bгр?\b/i, norm: 'g', factor: 1, display: 'г' },
  { pattern: /\bграмм\b/i, norm: 'g', factor: 1, display: 'г' },
  { pattern: /\bграмма\b/i, norm: 'g', factor: 1, display: 'г' },
  { pattern: /\bграммов\b/i, norm: 'g', factor: 1, display: 'г' },
  // Объём (проверяем ПОСЛЕ ложок)
  // "л" проверяем только если он не является частью слова (используем проверку в findUnit)
  { pattern: /\bл\b/i, norm: 'ml', factor: 1000, display: 'л' },
  { pattern: /\bлитр\b/i, norm: 'ml', factor: 1000, display: 'л' },
  { pattern: /\bлитра\b/i, norm: 'ml', factor: 1000, display: 'л' },
  { pattern: /\bлитров\b/i, norm: 'ml', factor: 1000, display: 'л' },
  { pattern: /\bмл\b/i, norm: 'ml', factor: 1, display: 'мл' },
  { pattern: /\bмиллилитр\b/i, norm: 'ml', factor: 1, display: 'мл' },
  { pattern: /\bмиллилитров\b/i, norm: 'ml', factor: 1, display: 'мл' },
  // Штучные
  { pattern: /\bшт\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bштук\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bштуки\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bштука\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bкуск\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bкусок\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bкусочка\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  // Дольки/зубчики
  { pattern: /\bдольк\w*\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bдолей\b/i, norm: 'pcs', factor: 1, display: 'шт' },
  { pattern: /\bзубчик\w*\b/i, norm: 'pcs', factor: 1, display: 'шт' },
];

// Определение единицы по ключевым словам в названии продукта
const defaultUnitByKeyword: Array<{ keys: string[]; unit: NormalizedUnit }> = [
  { keys: ['морков'], unit: 'pcs' },
  { keys: ['лук', 'луковиц'], unit: 'pcs' },
  { keys: ['чеснок', 'зубчик', 'дольк'], unit: 'pcs' },
  { keys: ['молоко', 'сливк'], unit: 'ml' },
  { keys: ['вода'], unit: 'ml' },
  { keys: ['масло'], unit: 'ml' },
  { keys: ['соль'], unit: 'g' },
  { keys: ['сахар'], unit: 'g' },
  { keys: ['сыр'], unit: 'g' },
];

/**
 * Парсит число из строки (поддерживает запятые, точки, дроби, диапазоны)
 */
function parseNumber(text: string): number | null {
  // Сначала проверяем диапазон
  const rangeMatch = text.match(RANGE_REGEX);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    if (!isNaN(a) && !isNaN(b)) {
      return (a + b) / 2; // среднее значение
    }
  }

  // Проверяем дробь
  const fractionMatch = text.match(FRACTION_REGEX);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
    if (!isNaN(num)) return num;
  }

  // Обычное число
  const num = parseFloat(text.replace(',', '.'));
  return isNaN(num) ? null : num;
}

/**
 * Находит единицу измерения в тексте
 * Ищет единицу рядом с числом (до или после), чтобы избежать ложных срабатываний
 */
function findUnit(text: string): { unit: NormalizedUnit; factor: number; display: string; match: string } | null {
  // Находим первое число в тексте
  const numberMatch = text.match(NUMBER_REGEX);
  
  if (!numberMatch || numberMatch.index === undefined) {
    // Если нет чисел, не ищем единицу (чтобы не путать "л" в "молока" с единицей)
    return null;
  }

  const numStart = numberMatch.index;
  const numEnd = numStart + numberMatch[0].length;
  
  // Ищем единицу после числа (в пределах 15 символов, включая пробелы)
  const textAfter = text.substring(numEnd, Math.min(text.length, numEnd + 15));
  for (const pattern of UNIT_PATTERNS) {
    const match = textAfter.match(new RegExp(`^\\s*${pattern.pattern.source}`, 'i'));
    if (match) {
      return {
        unit: pattern.norm,
        factor: pattern.factor,
        display: pattern.display,
        match: match[0].trim(),
      };
    }
  }
  
  // Ищем единицу перед числом (в пределах 15 символов)
  const textBefore = text.substring(Math.max(0, numStart - 15), numStart);
  for (const pattern of UNIT_PATTERNS) {
    const match = textBefore.match(new RegExp(`${pattern.pattern.source}\\s*$`, 'i'));
    if (match) {
      return {
        unit: pattern.norm,
        factor: pattern.factor,
        display: pattern.display,
        match: match[0].trim(),
      };
    }
  }
  
  return null;
}

/**
 * Определяет единицу по ключевым словам в названии продукта
 */
function pickDefaultUnit(name: string): NormalizedUnit {
  const lower = name.toLowerCase();
  for (const rule of defaultUnitByKeyword) {
    if (rule.keys.some((k) => lower.includes(k))) {
      return rule.unit;
    }
  }
  return 'g'; // по умолчанию граммы
}

/**
 * Парсит одну строку ингредиента
 * Поддерживает любой порядок: "250 г говядина" или "говядина 250 г"
 */
function parseLine(rawLine: string): ParsedRecipeIngredient | null {
  const original = rawLine.trim();
  if (!original) return null;

  // Шаг 1: Ищем число в исходном тексте (может быть диапазон)
  let amount: number | null = null;
  let amountDisplay = '';
  const numberMatch = original.match(NUMBER_REGEX);
  if (numberMatch) {
    amount = parseNumber(numberMatch[0]);
    if (amount !== null) {
      amountDisplay = numberMatch[0];
    }
  }

  // Шаг 2: Ищем единицу измерения рядом с числом
  const unitMatch = findUnit(original);
  const unitInfo = unitMatch
    ? { unit: unitMatch.unit, factor: unitMatch.factor, display: unitMatch.display, match: unitMatch.match }
    : null;

  // Шаг 3: Удаляем число и единицу из текста, чтобы получить название продукта
  let name = original;
  
  if (unitInfo && numberMatch) {
    // Создаём паттерн для поиска "число единица" или "единица число"
    const unitPattern = unitInfo.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // экранируем спецсимволы
    const numberPattern = numberMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Пробуем удалить "число единица" (с пробелами)
    const pattern1 = new RegExp(`\\b${numberPattern}\\s+${unitPattern}\\b`, 'i');
    if (pattern1.test(name)) {
      name = name.replace(pattern1, ' ').replace(/\s+/g, ' ').trim();
    } else {
      // Пробуем удалить "единица число" (с пробелами)
      const pattern2 = new RegExp(`\\b${unitPattern}\\s+${numberPattern}\\b`, 'i');
      if (pattern2.test(name)) {
        name = name.replace(pattern2, ' ').replace(/\s+/g, ' ').trim();
      } else {
        // Пробуем без пробелов: "числоединица" или "единицачисло"
        const pattern3 = new RegExp(`${numberPattern}${unitPattern}|${unitPattern}${numberPattern}`, 'i');
        if (pattern3.test(name)) {
          name = name.replace(pattern3, ' ').replace(/\s+/g, ' ').trim();
        } else {
          // Удаляем по отдельности
          name = name.replace(unitInfo.match, ' ').replace(numberMatch[0], ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
  } else {
    // Удаляем по отдельности, если нет обоих
    if (unitInfo) {
      name = name.replace(unitInfo.match, ' ').replace(/\s+/g, ' ').trim();
    }
    if (numberMatch) {
      name = name.replace(numberMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Очищаем название от лишних символов
  name = name.replace(/[,;]/g, '').replace(/\s+/g, ' ').trim();

  // Шаг 4: Определяем финальную единицу измерения
  let finalUnit: NormalizedUnit = unitInfo?.unit || null;
  let finalFactor = unitInfo?.factor || 1;
  let finalDisplay = unitInfo?.display || '';

  // Если единица не найдена, пытаемся определить по названию продукта
  if (!finalUnit && name) {
    finalUnit = pickDefaultUnit(name);
    finalDisplay = finalUnit === 'g' ? 'г' : finalUnit === 'ml' ? 'мл' : 'шт';
    finalFactor = 1;
  }

  // Если число не найдено, возвращаем только название
  if (amount === null) {
    return {
      original,
      name: name || original,
      amount: null,
      unit: null,
      amountText: name || original,
      amountGrams: 0,
    };
  }

  // Шаг 5: Конвертируем в базовую единицу
  const amountBase = amount * finalFactor;

  // Шаг 6: Конвертируем в граммы для расчётов
  let amountGrams = 0;
  if (finalUnit === 'g') {
    amountGrams = amountBase;
  } else if (finalUnit === 'ml') {
    amountGrams = amountBase; // плотность ~1 для воды/жидкостей
  } else if (finalUnit === 'pcs') {
    // Ищем средний вес для продукта
    const key = Object.keys(pieceWeights).find((k) => name.toLowerCase().includes(k));
    const pieceWeight = key ? pieceWeights[key] : 50; // по умолчанию 50г
    amountGrams = amount * pieceWeight;
  }

  // Шаг 7: Формируем строку для отображения
  let amountText = '';
  if (unitInfo && (unitInfo.display.includes('ч.л.') || unitInfo.display.includes('ст.л.'))) {
    // Для ложек показываем исходное количество и единицу ложки
    amountText = `${amountDisplay} ${unitInfo.display}`;
  } else if (finalUnit === 'ml' && finalFactor > 1 && unitInfo?.display === 'л') {
    // Для литров показываем в мл
    amountText = `${amountBase} мл`;
  } else {
    // Для остальных показываем исходное количество и единицу
    amountText = `${amountDisplay} ${finalDisplay}`;
  }

  return {
    original,
    name: name || original,
    amount: amountBase,
    unit: finalUnit,
    amountText: amountText.trim(),
    amountGrams: Math.round(amountGrams * 100) / 100, // округляем до 2 знаков
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

/**
 * Тестовые примеры (в комментариях):
 *
 * parseRecipeText("250 г говядина постная")
 * → { name: "говядина постная", amount: 250, unit: "g", amountText: "250 г" }
 *
 * parseRecipeText("говядина постная 250 г")
 * → { name: "говядина постная", amount: 250, unit: "g", amountText: "250 г" }
 *
 * parseRecipeText("1–2 шт. морковки")
 * → { name: "морковки", amount: 1.5, unit: "pcs", amountText: "1.5 шт" }
 *
 * parseRecipeText("масла оливкового 1 ч.л.")
 * → { name: "масла оливкового", amount: 5, unit: "ml", amountText: "1 ч.л." }
 *
 * parseRecipeText("1 ч.л. масла")
 * → { name: "масла", amount: 5, unit: "ml", amountText: "1 ч.л." }
 *
 * parseRecipeText("2 ст.л. муки")
 * → { name: "муки", amount: 30, unit: "ml", amountText: "2 ст.л." }
 *
 * parseRecipeText("чеснока 3 дольки")
 * → { name: "чеснока", amount: 3, unit: "pcs", amountText: "3 шт" }
 *
 * parseRecipeText("1 л молока")
 * → { name: "молока", amount: 1000, unit: "ml", amountText: "1000 мл" }
 *
 * parseRecipeText("молока 1 л")
 * → { name: "молока", amount: 1000, unit: "ml", amountText: "1000 мл" }
 */
