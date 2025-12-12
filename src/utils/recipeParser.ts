import { pieceWeights } from '../data/unitConversions';

export type NormalizedUnit = 'g' | 'ml' | 'pcs' | null;

export interface ParsedRecipeIngredient {
  original: string;
  name: string;
  amount: number | null; // в исходных единицах (нормализованных)
  unit: NormalizedUnit;
  amountText: string; // для отображения (с исходной единицей)
  amountGrams: number; // для расчётов
}

const RANGE_REGEX = /(\d+[.,]?\d*)\s*[–-]\s*(\d+[.,]?\d*)/;
const FRACTION_REGEX = /(\d+)\s*\/\s*(\d+)/;

const unitMap: Record<string, { norm: NormalizedUnit; factor?: number; display?: string }> = {
  // граммы
  г: { norm: 'g', factor: 1, display: 'г' },
  гр: { norm: 'g', factor: 1, display: 'г' },
  грамм: { norm: 'g', factor: 1, display: 'г' },
  грамма: { norm: 'g', factor: 1, display: 'г' },
  граммов: { norm: 'g', factor: 1, display: 'г' },
  // миллилитры
  мл: { norm: 'ml', factor: 1, display: 'мл' },
  миллилитров: { norm: 'ml', factor: 1, display: 'мл' },
  // литры -> мл
  л: { norm: 'ml', factor: 1000, display: 'л' },
  литр: { norm: 'ml', factor: 1000, display: 'л' },
  литра: { norm: 'ml', factor: 1000, display: 'л' },
  литров: { norm: 'ml', factor: 1000, display: 'л' },
  // штуки
  шт: { norm: 'pcs', factor: 1, display: 'шт' },
  штук: { norm: 'pcs', factor: 1, display: 'шт' },
  штуки: { norm: 'pcs', factor: 1, display: 'шт' },
  куск: { norm: 'pcs', factor: 1, display: 'шт' },
  кусок: { norm: 'pcs', factor: 1, display: 'шт' },
  кусочка: { norm: 'pcs', factor: 1, display: 'шт' },
  // дольки/зубчики -> pcs
  долька: { norm: 'pcs', factor: 1, display: 'шт' },
  дольки: { norm: 'pcs', factor: 1, display: 'шт' },
  долей: { norm: 'pcs', factor: 1, display: 'шт' },
  зубчик: { norm: 'pcs', factor: 1, display: 'шт' },
  зубчика: { norm: 'pcs', factor: 1, display: 'шт' },
  зубчиков: { norm: 'pcs', factor: 1, display: 'шт' },
  // ложки
  'ч.л': { norm: 'ml', factor: 5, display: 'ч.л.' },
  'ч л': { norm: 'ml', factor: 5, display: 'ч.л.' },
  'ст.л': { norm: 'ml', factor: 15, display: 'ст.л.' },
  'ст л': { norm: 'ml', factor: 15, display: 'ст.л.' },
};

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

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumber = (token: string): number | null => {
  if (FRACTION_REGEX.test(token)) {
    const [, a, b] = token.match(FRACTION_REGEX)!;
    const num = Number(a) / Number(b);
    return isFinite(num) ? num : null;
  }
  const n = Number(token.replace(',', '.'));
  return isFinite(n) ? n : null;
};

const parseRange = (text: string): { value: number | null; cleaned: string } => {
  const m = text.match(RANGE_REGEX);
  if (!m) return { value: null, cleaned: text };
  const a = parseNumber(m[1]);
  const b = parseNumber(m[2]);
  if (a === null || b === null) return { value: null, cleaned: text };
  const avg = (a + b) / 2;
  return { value: avg, cleaned: text.replace(RANGE_REGEX, `${avg}`) };
};

const pickDefaultUnit = (name: string): NormalizedUnit => {
  const lower = name.toLowerCase();
  for (const rule of defaultUnitByKeyword) {
    if (rule.keys.some((k) => lower.includes(k))) return rule.unit;
  }
  return 'g';
};

export function parseRecipeText(text: string): ParsedRecipeIngredient[] {
  return text
    .split(/[\n]/)
    .flatMap((line) => line.split(','))
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseLine(line))
    .filter((v): v is ParsedRecipeIngredient => !!v);
}

function parseLine(rawLine: string): ParsedRecipeIngredient | null {
  const original = rawLine.trim();
  if (!original) return null;

  const rangeParsed = parseRange(original);
  let working = rangeParsed.cleaned;

  const tokens = normalizeText(working).split(' ');
  const rawTokens = normalizeText(original).split(' ');

  // number
  let numIdx = tokens.findIndex((t) => parseNumber(t) !== null);
  let amountVal: number | null = null;
  let amountDisplay = '';
  if (numIdx >= 0) {
    amountVal = parseNumber(tokens[numIdx]);
    amountDisplay = rawTokens[numIdx] || tokens[numIdx];
    tokens.splice(numIdx, 1);
    rawTokens.splice(numIdx, 1);
  }
  if (rangeParsed.value !== null) {
    amountVal = rangeParsed.value;
    amountDisplay = rangeParsed.value.toString();
  }

  // unit
  let unit: NormalizedUnit = null;
  let unitDisplay = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (next) {
      const bigram = `${t} ${next}`;
      if (unitMap[bigram]) {
        unit = unitMap[bigram].norm;
        unitDisplay = unitMap[bigram].display || bigram;
        tokens.splice(i, 2);
        break;
      }
    }
    if (unitMap[t]) {
      unit = unitMap[t].norm;
      unitDisplay = unitMap[t].display || t;
      tokens.splice(i, 1);
      break;
    }
  }

  const name = tokens.join(' ').trim() || original;

  if (amountVal === null) {
    // не смогли считать число — возвращаем без граммов
    return {
      original,
      name,
      amount: null,
      unit: null,
      amountText: name,
      amountGrams: 0,
    };
  }

  if (!unit) {
    unit = pickDefaultUnit(name);
    unitDisplay = unit === 'g' ? 'г' : unit === 'ml' ? 'мл' : 'шт';
  }

  // amount in base unit
  let amountBase = amountVal;
  const unitKey = unitDisplay?.toLowerCase() || '';
  const mapEntry =
    unitMap[unitKey] ||
    unitMap[unitKey.replace('.', '')] ||
    unitMap[unitKey.replace(/\s+/g, ' ')];
  if (mapEntry?.factor) {
    amountBase = amountVal * (mapEntry.factor ?? 1);
  }

  // grams for calculations
  let amountGrams = 0;
  if (unit === 'g') {
    amountGrams = amountBase;
  } else if (unit === 'ml') {
    amountGrams = amountBase; // плотность ~1
  } else if (unit === 'pcs') {
    const key = Object.keys(pieceWeights).find((k) => name.includes(k));
    amountGrams = amountBase * (key ? pieceWeights[key] : pieceWeights['шт'] || 50);
  }

  const amountText = `${amountDisplay || amountVal} ${unitDisplay || ''}`.trim();

  return {
    original,
    name,
    amount: amountBase,
    unit,
    amountText,
    amountGrams,
  };
}

