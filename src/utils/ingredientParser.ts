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

const resolveUnit = (
  tokens: string[],
  rawTokens: string[]
): { unit?: string; unitDisplay?: string; rest: string[] } => {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // биграмы после нормализации (ч л, ст л)
    if (i + 1 < tokens.length) {
      const bigram = `${t} ${tokens[i + 1]}`;
      if (unitConversions[bigram] !== undefined) {
        const rest = [...tokens.slice(0, i), ...tokens.slice(i + 2)];
        const unitDisplay = `${rawTokens[i]} ${rawTokens[i + 1]}`;
        return { unit: bigram, unitDisplay, rest };
      }
    }
    if (unitConversions[t] !== undefined) {
      const rest = [...tokens.slice(0, i), ...tokens.slice(i + 1)];
      const unitDisplay = rawTokens[i];
      return { unit: t, unitDisplay, rest };
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
  const rawTokens = normalize(raw).split(' ');
  // ищем число
  let numIdx = tokens.findIndex((t) => parseNumber(t) !== null);
  let value = 1;
  let valueDisplay = '';
  if (numIdx >= 0) {
    value = parseNumber(tokens[numIdx]) ?? 1;
    valueDisplay = rawTokens[numIdx] || tokens[numIdx];
    tokens.splice(numIdx, 1);
  }

  const { unit, unitDisplay, rest } = resolveUnit(tokens, rawTokens);
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

  const displayValue = rangeMatch
    ? `${rangeMatch[1]}–${rangeMatch[2]}`
    : valueDisplay || value.toString();
  const amountText = `${displayValue} ${unitDisplay || unit || 'шт'}`.trim();

  return {
    raw,
    name: name || raw,
    amountGrams: grams,
    amountText,
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

