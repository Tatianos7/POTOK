import { pieceWeights, productSpecificUnitConversions } from '../data/unitConversions';

export type NormalizedUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'pcs'
  | 'tsp'
  | 'tbsp'
  | 'spoon'
  | 'pinch'
  | 'clove'
  | 'slice'
  | 'cup'
  | null;

export interface ParsedRecipeIngredient {
  original: string;
  name: string;
  amount: number | null;
  unit: NormalizedUnit;
  amountText: string;
  amountGrams: number;
  gramsEquivalent: number;
  originalAmount: number | null;
  originalUnit: string | null;
  quantity: number | null;
  quantity_g: number;
  displayAmount: string | null;
  displayUnit: string | null;
  unitConversionWarning?: string | null;
}

const RANGE_REGEX = /(\d+[.,]?\d*)\s*[–-]\s*(\d+[.,]?\d*)/;
const NUMBER_REGEX = /\d+[.,]?\d*/;
const WORD_BOUNDARY_LEFT = String.raw`(?:^|[^\p{L}\p{N}_])`;
const WORD_BOUNDARY_RIGHT = String.raw`(?![\p{L}\p{N}_])`;

interface UnitDefinition {
  norm: Exclude<NormalizedUnit, null>;
  display: string;
  variants: string[];
  calculation: 'mass' | 'volume' | 'product-rule';
  baseFactor: number;
}

interface UnitMatch {
  unit: UnitDefinition;
  raw: string;
  start: number;
  end: number;
}

interface UnknownUnitMatch {
  raw: string;
  start: number;
  end: number;
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    norm: 'tbsp',
    display: 'столовая ложка',
    variants: ['ст.л.', 'ст л', 'столовая ложка', 'столовые ложки', 'столовых ложек', 'ст ложка'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'tsp',
    display: 'чайная ложка',
    variants: ['ч.л.', 'ч л', 'чайная ложка', 'чайные ложки', 'чайных ложек', 'чайн. ложка'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'kg',
    display: 'кг',
    variants: ['кг', 'килограмм', 'килограмма', 'килограммов'],
    calculation: 'mass',
    baseFactor: 1000,
  },
  {
    norm: 'g',
    display: 'г',
    variants: ['г', 'гр', 'гр.', 'грамм', 'грамма', 'граммов'],
    calculation: 'mass',
    baseFactor: 1,
  },
  {
    norm: 'ml',
    display: 'мл',
    variants: ['мл', 'мл.', 'миллилитр', 'миллилитра', 'миллилитров'],
    calculation: 'volume',
    baseFactor: 1,
  },
  {
    norm: 'l',
    display: 'л',
    variants: ['л', 'л.', 'литр', 'литра', 'литров'],
    calculation: 'volume',
    baseFactor: 1000,
  },
  {
    norm: 'pcs',
    display: 'шт',
    variants: ['шт', 'шт.', 'штука', 'штуки', 'штук'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'spoon',
    display: 'ложка',
    variants: ['ложка', 'ложки', 'ложек'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'pinch',
    display: 'щепотка',
    variants: ['щепотка', 'щепотки', 'щепоток'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'clove',
    display: 'зубчик',
    variants: ['зубчик', 'зубчика', 'зубчиков', 'долька', 'дольки', 'долек', 'долей'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'slice',
    display: 'ломтик',
    variants: ['ломтик', 'ломтика', 'ломтиков', 'кусок', 'куска', 'кусков', 'кусочек', 'кусочка'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
  {
    norm: 'cup',
    display: 'стакан',
    variants: ['стакан', 'стакана', 'стаканов'],
    calculation: 'product-rule',
    baseFactor: 1,
  },
];

const UNIT_VARIANTS = UNIT_DEFINITIONS.flatMap((unit) =>
  unit.variants.map((variant) => ({ unit, variant }))
).sort((a, b) => b.variant.length - a.variant.length);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const makeUnitRegex = (variant: string, atStart: boolean, atEnd: boolean) => {
  const escaped = escapeRegExp(variant).replace(/\\ /g, String.raw`\s+`);
  const left = atStart ? String.raw`^\s*(?:-\s*)?` : WORD_BOUNDARY_LEFT;
  const right = atEnd ? String.raw`\s*$` : WORD_BOUNDARY_RIGHT;
  return new RegExp(`${left}(${escaped})${right}`, 'iu');
};

const compact = (value: string) => value.replace(/\s+/g, ' ').trim();

function parseNumber(text: string): { value: number; originalText: string; index: number } | null {
  const rangeMatch = text.match(RANGE_REGEX);
  if (rangeMatch && rangeMatch.index !== undefined) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      return { value: (a + b) / 2, originalText: rangeMatch[0], index: rangeMatch.index };
    }
  }

  const numberMatch = text.match(NUMBER_REGEX);
  if (numberMatch && numberMatch.index !== undefined) {
    const value = parseFloat(numberMatch[0].replace(',', '.'));
    if (!Number.isNaN(value)) {
      return { value, originalText: numberMatch[0], index: numberMatch.index };
    }
  }

  return null;
}

function findUnitNearNumber(text: string, numberStart: number, numberEnd: number): UnitMatch | null {
  const after = text.slice(numberEnd);
  for (const { unit, variant } of UNIT_VARIANTS) {
    const match = after.match(makeUnitRegex(variant, true, false));
    if (match && match.index !== undefined) {
      const raw = match[1];
      const start = numberEnd + match[0].indexOf(raw);
      return { unit, raw, start, end: start + raw.length };
    }
  }

  const before = text.slice(0, numberStart);
  for (const { unit, variant } of UNIT_VARIANTS) {
    const match = before.match(makeUnitRegex(variant, false, true));
    if (match && match.index !== undefined) {
      const raw = match[1];
      const start = before.lastIndexOf(raw);
      return { unit, raw, start, end: start + raw.length };
    }
  }

  return null;
}

function findUnknownUnitAfterNumber(text: string, numberEnd: number): UnknownUnitMatch | null {
  const after = text.slice(numberEnd);
  const match = after.match(/^\s*([\p{L}]+(?:\s+[\p{L}]+)?)/u);
  if (!match || match.index === undefined) return null;

  const raw = compact(match[1]);
  if (!raw) return null;

  const start = numberEnd + match[0].indexOf(match[1]);
  return { raw, start, end: start + match[1].length };
}

function normalizeProductName(name: string): string {
  let normalized = compact(name.replace(/[.,;]/g, ' '));

  const replacements: Array<[RegExp, string]> = [
    [/чеснока$/iu, 'чеснок'],
    [/морковки$/iu, 'морковь'],
    [/чечевицы$/iu, 'чечевица'],
    [/^луковиц[аы]$/iu, 'лук'],
    [/масла\s+оливкового/giu, 'масло оливковое'],
    [/масла\s+растительного/giu, 'масло растительное'],
    [/масла$/iu, 'масло'],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return compact(normalized);
}

function stripKnownUnits(text: string): string {
  let cleaned = text;
  for (const { variant } of UNIT_VARIANTS) {
    cleaned = cleaned.replace(makeUnitRegex(variant, false, false), ' ');
  }
  return compact(cleaned);
}

function getPieceWeight(productName: string, unit: NormalizedUnit): number | null {
  const lowerName = productName.toLowerCase();

  if (unit === 'clove' && lowerName.includes('чеснок')) {
    return pieceWeights.чеснок ?? null;
  }

  const key = Object.keys(pieceWeights).find((candidate) => lowerName.includes(candidate));
  return key ? pieceWeights[key] : null;
}

function getProductSpecificWeight(productName: string, unit: NormalizedUnit): number | null {
  if (!unit) return null;
  const lowerName = productName.toLowerCase();

  const directRule = productSpecificUnitConversions.find(
    (rule) => rule.unit === unit && rule.productKeys.some((key) => lowerName.includes(key))
  );

  if (directRule) return directRule.grams;

  if (unit === 'pcs' || unit === 'clove') {
    return getPieceWeight(productName, unit);
  }

  return null;
}

function convertToGrams(
  amount: number,
  unit: UnitDefinition | null,
  productName: string
): { amountGrams: number; warning: string | null } {
  if (!unit) {
    return {
      amountGrams: 0,
      warning: 'Не распознана единица измерения. Укажите г, мл, шт или известную меру.',
    };
  }

  if (unit.calculation === 'mass') {
    return { amountGrams: amount * unit.baseFactor, warning: null };
  }

  if (unit.calculation === 'volume') {
    const lowerName = productName.toLowerCase();
    if (lowerName.includes('вода')) {
      return { amountGrams: amount * unit.baseFactor, warning: null };
    }
    return {
      amountGrams: 0,
      warning: `Для единицы "${unit.display}" нет правила перевода в граммы для продукта "${productName}".`,
    };
  }

  const gramsPerUnit = getProductSpecificWeight(productName, unit.norm);
  if (gramsPerUnit !== null) {
    return { amountGrams: amount * gramsPerUnit, warning: null };
  }

  return {
    amountGrams: 0,
    warning: `Для единицы "${unit.display}" нет правила перевода в граммы для продукта "${productName}".`,
  };
}

function buildName(
  original: string,
  numberInfo: { originalText: string; index: number },
  unitInfo: UnitMatch | null,
  unknownUnitInfo: UnknownUnitMatch | null
): string {
  const chars = Array.from(original);
  const clearSpan = (start: number, end: number) => {
    for (let i = Math.max(0, start); i < Math.min(chars.length, end); i += 1) {
      chars[i] = ' ';
    }
  };

  clearSpan(numberInfo.index, numberInfo.index + numberInfo.originalText.length);
  if (unitInfo) {
    clearSpan(unitInfo.start, unitInfo.end);
  } else if (unknownUnitInfo) {
    clearSpan(unknownUnitInfo.start, unknownUnitInfo.end);
  }

  let name = chars.join('');
  name = stripKnownUnits(name);
  name = name.replace(/\d+[.,]?\d*\s*[–-]\s*\d+[.,]?\d*/g, ' ');
  name = name.replace(/\d+[.,]?\d*/g, ' ');
  return normalizeProductName(name);
}

function parseLine(rawLine: string): ParsedRecipeIngredient | null {
  const original = rawLine.trim();
  if (!original) return null;

  const numberInfo = parseNumber(original);
  if (!numberInfo) {
    const name = normalizeProductName(stripKnownUnits(original));
    return {
      original,
      name: name || original,
      amount: null,
      unit: null,
      amountText: name || original,
      amountGrams: 0,
      gramsEquivalent: 0,
      originalAmount: null,
      originalUnit: null,
      quantity: null,
      quantity_g: 0,
      displayAmount: null,
      displayUnit: null,
      unitConversionWarning: 'Не указано количество ингредиента.',
    };
  }

  const numberStart = numberInfo.index;
  const numberEnd = numberStart + numberInfo.originalText.length;
  const unitInfo = findUnitNearNumber(original, numberStart, numberEnd);
  const unknownUnitInfo = unitInfo ? null : findUnknownUnitAfterNumber(original, numberEnd);
  const name = buildName(original, numberInfo, unitInfo, unknownUnitInfo);
  const productName = name || normalizeProductName(original.replace(NUMBER_REGEX, ' ')) || original;
  const amount = numberInfo.value;
  const displayUnit = unitInfo?.unit.display ?? unknownUnitInfo?.raw ?? null;
  const displayAmount = numberInfo.originalText;
  const conversion = convertToGrams(amount, unitInfo?.unit ?? null, productName);
  const gramsEquivalent = Math.round(conversion.amountGrams * 100) / 100;
  const amountText = displayUnit ? `${displayAmount} ${displayUnit}` : displayAmount;

  return {
    original,
    name: productName,
    amount: unitInfo ? amount * unitInfo.unit.baseFactor : null,
    unit: unitInfo?.unit.norm ?? null,
    amountText,
    amountGrams: gramsEquivalent,
    gramsEquivalent,
    originalAmount: amount,
    originalUnit: displayUnit,
    quantity: amount,
    quantity_g: gramsEquivalent,
    displayAmount,
    displayUnit,
    unitConversionWarning: conversion.warning,
  };
}

export function parseRecipeText(text: string): ParsedRecipeIngredient[] {
  if (!text || !text.trim()) return [];

  return text
    .split(/[,\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((value): value is ParsedRecipeIngredient => value !== null);
}

export function runParserTests(): void {
  const tests: Array<{ input: string; expected: Partial<ParsedRecipeIngredient> }> = [
    { input: '250 г говядина постная', expected: { name: 'говядина постная', amount: 250, unit: 'g' } },
    { input: 'говядина постная 250 г', expected: { name: 'говядина постная', amount: 250, unit: 'g' } },
    { input: '1–2 шт. морковки', expected: { name: 'морковь', amount: 1.5, unit: 'pcs' } },
    { input: 'чеснока 3 дольки', expected: { name: 'чеснок', amount: 3, unit: 'clove' } },
    { input: 'масло оливковое 1 столовая ложка', expected: { name: 'масло оливковое', amount: 1, unit: 'tbsp' } },
    { input: 'вода 500 мл.', expected: { name: 'вода', amount: 500, unit: 'ml' } },
  ];

  console.log('Запуск автотестов парсера ингредиентов...\n');

  let passed = 0;
  let failed = 0;

  for (const sample of tests) {
    const parsed = parseRecipeText(sample.input)[0];
    const ok =
      Boolean(parsed) &&
      parsed.name === sample.expected.name &&
      parsed.amount === sample.expected.amount &&
      parsed.unit === sample.expected.unit;

    if (ok) {
      console.log(`PASS: "${sample.input}"`);
      passed++;
    } else {
      console.error(`FAIL: "${sample.input}"`);
      console.error('Expected:', sample.expected);
      console.error('Received:', parsed);
      failed++;
    }
  }

  console.log(`Результаты: ${passed} прошло, ${failed} провалено из ${tests.length}`);
}
