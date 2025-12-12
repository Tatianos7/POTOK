import { unitConversions, pieceWeights } from '../data/unitConversions';

export interface ParsedIngredient {
  raw: string;
  name: string;
  amountGrams: number;
  amountText: string;
}

const RANGE_REGEX = /(\d+[.,]?\d*)\s*[–-]\s*(\d+[.,]?\d*)/;
const FRACTION_REGEX = /(\d+)\s*\/\s*(\d+)/;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[,.;]/g, ' ')
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

const resolveUnit = (tokens: string[]): { unit?: string; rest: string[] } => {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (unitConversions[t] !== undefined) {
      return { unit: t, rest: [...tokens.slice(0, i), ...tokens.slice(i + 1)] };
    }
  }
  return { rest: tokens };
};

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim();
  if (!raw) return null;

  // Найдём диапазоны вида 1–2
  let working = raw;
  let amount: number | null = null;
  const rangeMatch = raw.match(RANGE_REGEX);
  if (rangeMatch) {
    const a = parseNumber(rangeMatch[1]);
    const b = parseNumber(rangeMatch[2]);
    if (a !== null && b !== null) {
      amount = (a + b) / 2;
      working = raw.replace(RANGE_REGEX, `${amount}`);
    }
  }

  const tokens = normalize(working).split(' ');
  // ищем число
  let numIdx = tokens.findIndex((t) => parseNumber(t) !== null);
  let value = 1;
  if (numIdx >= 0) {
    value = parseNumber(tokens[numIdx]) ?? 1;
    tokens.splice(numIdx, 1);
  }

  const { unit, rest } = resolveUnit(tokens);
  const name = rest.join(' ').trim();

  // конвертация
  let grams = value;
  if (unit && unitConversions[unit] !== undefined) {
    grams = value * unitConversions[unit];
  } else {
    // если нет единицы — попробуем по штучному весу
    const key = Object.keys(pieceWeights).find((k) => name.includes(k));
    if (key) {
      grams = value * pieceWeights[key];
    } else {
      grams = value * unitConversions['шт'];
    }
  }

  return {
    raw,
    name: name || raw,
    amountGrams: grams,
    amountText: `${value} ${unit || 'шт'}`.trim(),
  };
}

export function parseIngredients(text: string): ParsedIngredient[] {
  return text
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseIngredientLine(line))
    .filter((v): v is ParsedIngredient => !!v);
}

