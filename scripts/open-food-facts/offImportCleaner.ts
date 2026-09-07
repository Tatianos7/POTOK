import {
  buildNormalizedBrand,
  buildNormalizedName,
  getInvalidFoodMacroReason,
  validateNutrition,
} from '../../src/utils/foodNormalizer.ts';

export type OffClassification =
  | 'candidate_ok'
  | 'needs_language_review'
  | 'needs_quality_review'
  | 'needs_duplicate_review'
  | 'auto_reject';

export type OffReviewStatusSuggestion = 'pending' | 'needs_review' | 'rejected';

export type OffReasonCode =
  | 'missing_product_name_ru'
  | 'latin_primary_name'
  | 'mixed_language_name'
  | 'suspected_non_russian_cyrillic'
  | 'ocr_or_scan_noise'
  | 'brand_only_name'
  | 'category_only_name'
  | 'placeholder_or_test_name'
  | 'name_too_short'
  | 'name_too_long'
  | 'garbage_symbols'
  | 'missing_barcode'
  | 'missing_brand'
  | 'missing_calories'
  | 'missing_macros'
  | 'all_zero_kbju'
  | 'water_exception_needs_review'
  | 'suspicious_nutrition'
  | 'energy_macro_mismatch'
  | 'per_100ml_needs_handling'
  | 'serving_only_nutrition'
  | 'duplicate_barcode'
  | 'duplicate_name_brand'
  | 'non_food_category'
  | 'provider_payload_incomplete';

export interface OffRecord {
  _fixture_kind?: unknown;
  _fixture_note?: unknown;
  code?: unknown;
  url?: unknown;
  product_name?: unknown;
  product_name_ru?: unknown;
  brands?: unknown;
  countries?: unknown;
  countries_tags?: unknown;
  lang?: unknown;
  languages?: unknown;
  languages_tags?: unknown;
  categories?: unknown;
  categories_tags?: unknown;
  nutriments?: {
    'energy-kcal_100g'?: unknown;
    proteins_100g?: unknown;
    fat_100g?: unknown;
    carbohydrates_100g?: unknown;
    fiber_100g?: unknown;
  };
}

export interface OffCleanerContext {
  existingBarcodes?: Iterable<string>;
  existingNameBrands?: Iterable<string>;
  seenBarcodes?: Iterable<string>;
  seenNameBrands?: Iterable<string>;
}

export interface OffScores {
  language_score: number;
  ru_display_name_score: number;
  nutrition_score: number;
  market_score: number;
  duplicate_score: number;
  overall_quality_score: number;
}

export interface CleanedOffRecord extends OffScores {
  code: string;
  source_provider: 'open_food_facts';
  source_provider_product_id: string;
  provider_url: string;
  proposed_name: string;
  proposed_brand: string;
  ru_display_name: string;
  normalized_name: string;
  normalized_brand: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  classification: OffClassification;
  review_status_suggestion: OffReviewStatusSuggestion;
  reason_codes: OffReasonCode[];
  notes: string[];
}

const REVIEW_PRIORITY: Record<OffReasonCode, number> = {
  duplicate_barcode: 95,
  duplicate_name_brand: 90,
  suspected_non_russian_cyrillic: 85,
  mixed_language_name: 80,
  missing_product_name_ru: 78,
  water_exception_needs_review: 76,
  suspicious_nutrition: 74,
  energy_macro_mismatch: 72,
  per_100ml_needs_handling: 70,
  ocr_or_scan_noise: 68,
  missing_brand: 62,
  category_only_name: 58,
  brand_only_name: 56,
  missing_barcode: 54,
  latin_primary_name: 52,
  missing_calories: 50,
  missing_macros: 50,
  all_zero_kbju: 50,
  non_food_category: 45,
  provider_payload_incomplete: 42,
  placeholder_or_test_name: 40,
  serving_only_nutrition: 38,
  name_too_short: 35,
  name_too_long: 35,
  garbage_symbols: 30,
};

const HARD_REJECT_REASONS = new Set<OffReasonCode>([
  'latin_primary_name',
  'missing_calories',
  'missing_macros',
  'all_zero_kbju',
  'non_food_category',
  'provider_payload_incomplete',
  'placeholder_or_test_name',
]);

const LANGUAGE_REASONS = new Set<OffReasonCode>([
  'missing_product_name_ru',
  'mixed_language_name',
  'suspected_non_russian_cyrillic',
  'ocr_or_scan_noise',
  'brand_only_name',
  'category_only_name',
  'name_too_short',
  'name_too_long',
  'garbage_symbols',
]);

const QUALITY_REASONS = new Set<OffReasonCode>([
  'missing_barcode',
  'missing_brand',
  'water_exception_needs_review',
  'suspicious_nutrition',
  'energy_macro_mismatch',
  'per_100ml_needs_handling',
  'serving_only_nutrition',
]);

const DUPLICATE_REASONS = new Set<OffReasonCode>(['duplicate_barcode', 'duplicate_name_brand']);

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toTags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).map((tag) => tag.toLowerCase());
  const text = toText(value);
  return text ? [text.toLowerCase()] : [];
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const clampScore = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(2))));

const hasCyrillic = (value: string): boolean => /[а-яёіїєґўъыэ]/i.test(value);
const hasLatin = (value: string): boolean => /[a-z]/i.test(value);

const getScriptRatio = (value: string) => {
  const cyrillic = (value.match(/[а-яёіїєґў]/gi) ?? []).length;
  const latin = (value.match(/[a-z]/gi) ?? []).length;
  const total = cyrillic + latin;
  return {
    cyrillic,
    latin,
    cyrillicRatio: total === 0 ? 0 : cyrillic / total,
    latinRatio: total === 0 ? 0 : latin / total,
  };
};

const hasNonRussianCyrillicSignal = (value: string, record?: OffRecord): boolean => {
  const combined = [
    value,
    toText(record?.lang),
    toText(record?.languages),
    ...toTags(record?.languages_tags),
  ].join(' ').toLowerCase();

  return (
    /[іїєґў]/i.test(combined) ||
    /\b(uk|ukrainian|belarusian|bulgarian|serbian|kazakh)\b/i.test(combined) ||
    /\b(незбиране|молочний|харчовий|смак|вода питна)\b/i.test(combined)
  );
};

const hasPolishSignal = (value: string): boolean => /[ąćęłńóśźż]/i.test(value);

const hasNoiseSignal = (value: string): boolean => {
  const normalized = value.toLowerCase();
  const noiseTokens = ['смотка', 'витрина', 'витрине', 'витрины', 'полка', 'ценник', 'тестовый', 'неизвестно'];
  return (
    noiseTokens.some((token) => normalized.includes(token)) ||
    /\b(ocr|scan|unknown|test)\b/i.test(normalized) ||
    /[^\p{L}\p{N}\s.,:%"'+/-]/u.test(value)
  );
};

const isPlaceholderName = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return ['unknown', 'product', 'food', 'test', 'тест', 'продукт', 'неизвестно'].includes(normalized);
};

const isMostlyUppercaseNoise = (value: string): boolean => {
  const letters = value.replace(/[^\p{L}]/gu, '');
  return letters.length >= 8 && letters === letters.toUpperCase() && hasLatin(value);
};

const hasDisplayProductTypeSignal = (value: string): boolean => {
  const normalized = value.toLowerCase();
  const productTypeTokens = [
    'паста',
    'молоко',
    'сыр',
    'горчица',
    'вода',
    'шоколад',
    'драже',
    'хлопья',
    'йогурт',
    'кефир',
    'сок',
    'напиток',
    'чай',
    'кофе',
    'хлеб',
    'масло',
    'пробиотик',
    'злак',
  ];
  return productTypeTokens.some((token) => normalized.includes(token));
};

const hasCategoryProductTypeSignal = (categories: string[]): boolean => {
  return categories.some((category) =>
    /(tomato|milk|cheese|mustard|water|chocolate|candy|cereals|beverages|sodas|dairies)/i.test(category)
  );
};

const isDisplayNameBrandLike = (value: string, brand: string): boolean => {
  const normalizedValue = buildNormalizedName(value);
  const normalizedBrand = buildNormalizedBrand(brand);
  if (!normalizedValue) return false;
  if (normalizedBrand && normalizedValue === normalizedBrand) return true;
  const wordCount = normalizedValue.split(/\s+/).filter(Boolean).length;
  return !hasDisplayProductTypeSignal(value) && wordCount <= 2 && /^[\p{L}\p{N}\s-]+$/u.test(value);
};

const isWater = (record: OffRecord, name: string): boolean => {
  const categories = toTags(record.categories_tags);
  return /\b(вода|water)\b/i.test(name) || categories.some((category) => category.includes('water'));
};

const isPer100mlCandidate = (record: OffRecord, name: string): boolean => {
  const categories = toTags(record.categories_tags);
  return (
    /\b(вода|молоко|сок|напиток|cola|aqua|water|milk|beverage)\b/i.test(name) ||
    categories.some((category) => /(beverage|water|milk|soda|juice)/i.test(category))
  );
};

const hasRussiaMarket = (record: OffRecord): boolean => {
  const countries = toText(record.countries).toLowerCase();
  const tags = toTags(record.countries_tags);
  return countries.includes('russia') || countries.includes('росси') || tags.some((tag) => tag.includes('russia'));
};

const makeNameBrandKey = (normalizedName: string, normalizedBrand: string): string => {
  return `${normalizedName}::${normalizedBrand}`;
};

const contextSet = (values?: Iterable<string>): Set<string> => {
  return new Set(Array.from(values ?? [], (value) => value.toLowerCase()));
};

export const resolveRussianDisplayName = (record: OffRecord): string => {
  const ruName = toText(record.product_name_ru);
  if (ruName) return ruName;
  return '';
};

export const scoreLanguage = (record: OffRecord): number => {
  const displayName = resolveRussianDisplayName(record);
  const rawName = toText(record.product_name);
  const targetName = displayName || rawName;
  let score = displayName ? 0.9 : 0.2;
  const script = getScriptRatio(targetName);

  if (script.cyrillicRatio >= 0.8) score += 0.05;
  if (script.latinRatio >= 0.55) score -= 0.45;
  if (hasLatin(targetName) && hasCyrillic(targetName)) score -= 0.25;
  if (hasNonRussianCyrillicSignal(targetName, record)) score -= 0.55;
  if (hasPolishSignal(targetName)) score -= 0.45;
  if (toTags(record.languages_tags).some((tag) => tag.includes('russian'))) score += 0.05;

  return clampScore(score);
};

export const scoreRuDisplayName = (record: OffRecord): number => {
  const displayName = resolveRussianDisplayName(record);
  if (!displayName) return 0;

  const categories = toTags(record.categories_tags);
  const brand = toText(record.brands);
  let score = 0.9;
  if (displayName.length < 4) score -= 0.35;
  if (displayName.length > 80) score -= 0.3;
  if (hasLatin(displayName) && hasCyrillic(displayName)) score -= 0.25;
  if (hasNoiseSignal(displayName)) score -= 0.45;
  if (isPlaceholderName(displayName)) score -= 0.6;
  if (isMostlyUppercaseNoise(displayName)) score -= 0.35;
  if (!hasDisplayProductTypeSignal(displayName)) score -= 0.35;
  if (!hasDisplayProductTypeSignal(displayName) && hasCategoryProductTypeSignal(categories)) score -= 0.1;
  if (isDisplayNameBrandLike(displayName, brand)) score -= 0.25;

  return clampScore(score);
};

export const scoreNutrition = (record: OffRecord): number => {
  const calories = toNumberOrNull(record.nutriments?.['energy-kcal_100g']);
  const protein = toNumberOrNull(record.nutriments?.proteins_100g);
  const fat = toNumberOrNull(record.nutriments?.fat_100g);
  const carbs = toNumberOrNull(record.nutriments?.carbohydrates_100g);
  const fiber = toNumberOrNull(record.nutriments?.fiber_100g) ?? 0;
  const displayName = resolveRussianDisplayName(record) || toText(record.product_name);

  if (calories === null || protein === null || fat === null || carbs === null) return 0;
  if (calories === 0 && protein === 0 && fat === 0 && carbs === 0) {
    return isWater(record, displayName) ? 0.55 : 0;
  }

  try {
    const invalidReason = getInvalidFoodMacroReason(
      { calories, protein, fat, carbs, fiber },
      {
        calories: record.nutriments?.['energy-kcal_100g'],
        protein: record.nutriments?.proteins_100g,
        fat: record.nutriments?.fat_100g,
        carbs: record.nutriments?.carbohydrates_100g,
      }
    );
    if (invalidReason) return 0;
    const nutrition = validateNutrition({ calories, protein, fat, carbs, fiber });
    if (nutrition.suspicious) return 0.55;
  } catch {
    return 0;
  }

  const macroCalories = protein * 4 + carbs * 4 + fat * 9;
  if (calories === 0 && macroCalories > 10) return 0.35;
  if (calories > 0 && macroCalories > calories * 1.8 + 40) return 0.6;

  return 0.95;
};

export const scoreMarket = (record: OffRecord): number => {
  let score = hasRussiaMarket(record) ? 0.9 : 0.25;
  const languageTags = toTags(record.languages_tags);
  if (languageTags.some((tag) => tag.includes('russian'))) score += 0.05;
  if (languageTags.some((tag) => tag.includes('english')) && !languageTags.some((tag) => tag.includes('russian'))) {
    score -= 0.25;
  }
  return clampScore(score);
};

export const scoreDuplicate = (record: OffRecord, context: OffCleanerContext = {}): number => {
  const code = toText(record.code).toLowerCase();
  const normalizedName = buildNormalizedName(resolveRussianDisplayName(record) || toText(record.product_name));
  const normalizedBrand = buildNormalizedBrand(toText(record.brands));
  const key = makeNameBrandKey(normalizedName, normalizedBrand).toLowerCase();
  const barcodes = new Set([...contextSet(context.existingBarcodes), ...contextSet(context.seenBarcodes)]);
  const nameBrands = new Set([...contextSet(context.existingNameBrands), ...contextSet(context.seenNameBrands)]);

  if (code && barcodes.has(code)) return 1;
  if (normalizedName && normalizedBrand && nameBrands.has(key)) return 0.9;
  return 0;
};

export const buildReasonCodes = (record: OffRecord, scores: OffScores): OffReasonCode[] => {
  const reasons = new Set<OffReasonCode>();
  const code = toText(record.code);
  const rawName = toText(record.product_name);
  const ruName = resolveRussianDisplayName(record);
  const targetName = ruName || rawName;
  const brand = toText(record.brands);
  const categories = toTags(record.categories_tags);
  const calories = toNumberOrNull(record.nutriments?.['energy-kcal_100g']);
  const protein = toNumberOrNull(record.nutriments?.proteins_100g);
  const fat = toNumberOrNull(record.nutriments?.fat_100g);
  const carbs = toNumberOrNull(record.nutriments?.carbohydrates_100g);
  const fiber = toNumberOrNull(record.nutriments?.fiber_100g) ?? 0;

  if (!code) reasons.add('missing_barcode');
  if (!rawName && !ruName) reasons.add('provider_payload_incomplete');
  if (!ruName) reasons.add('missing_product_name_ru');
  if (!brand) reasons.add('missing_brand');
  if (categories.length === 0) reasons.add('category_only_name');
  if (categories.some((category) => /(pet-food|cosmetics|cleaning|non-food)/i.test(category))) {
    reasons.add('non_food_category');
  }
  if (targetName.length > 0 && targetName.length < 4) reasons.add('name_too_short');
  if (targetName.length > 80) reasons.add('name_too_long');
  if (hasNoiseSignal(targetName)) reasons.add('ocr_or_scan_noise');
  if (isPlaceholderName(targetName)) reasons.add('placeholder_or_test_name');
  if (hasNonRussianCyrillicSignal(targetName, record)) reasons.add('suspected_non_russian_cyrillic');
  if (hasLatin(targetName) && hasCyrillic(targetName)) reasons.add('mixed_language_name');
  if (!ruName && hasLatin(rawName) && !hasCyrillic(rawName)) reasons.add('latin_primary_name');
  if (isMostlyUppercaseNoise(targetName)) reasons.add('brand_only_name');
  if (targetName && isDisplayNameBrandLike(targetName, brand)) reasons.add('brand_only_name');

  if (calories === null) reasons.add('missing_calories');
  if (protein === null || fat === null || carbs === null) reasons.add('missing_macros');
  if (
    calories !== null &&
    protein !== null &&
    fat !== null &&
    carbs !== null &&
    [calories, protein, fat, carbs, fiber].some((value) => value < 0)
  ) {
    reasons.add('provider_payload_incomplete');
  }

  if (calories !== null && protein !== null && fat !== null && carbs !== null) {
    if (calories === 0 && protein === 0 && fat === 0 && carbs === 0) {
      reasons.add(isWater(record, targetName) ? 'water_exception_needs_review' : 'all_zero_kbju');
    }

    const invalidReason = getInvalidFoodMacroReason(
      { calories, protein, fat, carbs, fiber },
      {
        calories: record.nutriments?.['energy-kcal_100g'],
        protein: record.nutriments?.proteins_100g,
        fat: record.nutriments?.fat_100g,
        carbs: record.nutriments?.carbohydrates_100g,
      }
    );

    if (invalidReason && invalidReason !== 'all_zero_macros') {
      reasons.add(invalidReason.endsWith('_missing') ? 'missing_macros' : 'suspicious_nutrition');
    }

    try {
      const nutrition = validateNutrition({ calories, protein, fat, carbs, fiber });
      if (nutrition.suspicious) reasons.add('suspicious_nutrition');
    } catch {
      reasons.add('suspicious_nutrition');
    }

    const macroCalories = protein * 4 + carbs * 4 + fat * 9;
    if ((calories === 0 && macroCalories > 10) || (calories > 0 && macroCalories > calories * 1.8 + 40)) {
      reasons.add('energy_macro_mismatch');
    }
  }

  if (isPer100mlCandidate(record, targetName)) reasons.add('per_100ml_needs_handling');
  if (scores.duplicate_score >= 1) reasons.add('duplicate_barcode');
  if (scores.duplicate_score >= 0.9 && scores.duplicate_score < 1) reasons.add('duplicate_name_brand');

  return [...reasons].sort((left, right) => REVIEW_PRIORITY[right] - REVIEW_PRIORITY[left]);
};

export const classifyOffRecord = (record: OffRecord, context: OffCleanerContext = {}): OffClassification => {
  const language_score = scoreLanguage(record);
  const ru_display_name_score = scoreRuDisplayName(record);
  const nutrition_score = scoreNutrition(record);
  const market_score = scoreMarket(record);
  const duplicate_score = scoreDuplicate(record, context);
  const scores: OffScores = {
    language_score,
    ru_display_name_score,
    nutrition_score,
    market_score,
    duplicate_score,
    overall_quality_score: 0,
  };
  const reasons = buildReasonCodes(record, scores);

  if (reasons.some((reason) => DUPLICATE_REASONS.has(reason))) return 'needs_duplicate_review';
  if (reasons.some((reason) => reason === 'water_exception_needs_review')) return 'needs_quality_review';
  if (reasons.some((reason) => HARD_REJECT_REASONS.has(reason))) return 'auto_reject';
  if (reasons.some((reason) => LANGUAGE_REASONS.has(reason)) || language_score < 0.85 || ru_display_name_score < 0.85) {
    return 'needs_language_review';
  }
  if (reasons.some((reason) => QUALITY_REASONS.has(reason)) || nutrition_score < 0.85 || market_score < 0.75) {
    return 'needs_quality_review';
  }
  return 'candidate_ok';
};

export const cleanOffRecord = (record: OffRecord, context: OffCleanerContext = {}): CleanedOffRecord => {
  const ruDisplayName = resolveRussianDisplayName(record);
  const proposedName = ruDisplayName || toText(record.product_name);
  const proposedBrand = toText(record.brands);
  const normalizedName = buildNormalizedName(proposedName);
  const normalizedBrand = buildNormalizedBrand(proposedBrand);
  const calories = toNumberOrNull(record.nutriments?.['energy-kcal_100g']);
  const protein = toNumberOrNull(record.nutriments?.proteins_100g);
  const fat = toNumberOrNull(record.nutriments?.fat_100g);
  const carbs = toNumberOrNull(record.nutriments?.carbohydrates_100g);
  const fiber = toNumberOrNull(record.nutriments?.fiber_100g);
  const language_score = scoreLanguage(record);
  const ru_display_name_score = scoreRuDisplayName(record);
  const nutrition_score = scoreNutrition(record);
  const market_score = scoreMarket(record);
  const duplicate_score = scoreDuplicate(record, context);
  const overall_quality_score = clampScore(
    language_score * 0.25 +
      ru_display_name_score * 0.25 +
      nutrition_score * 0.25 +
      market_score * 0.15 +
      (1 - duplicate_score) * 0.1 -
      (isPer100mlCandidate(record, proposedName) ? 0.05 : 0)
  );
  const scores = {
    language_score,
    ru_display_name_score,
    nutrition_score,
    market_score,
    duplicate_score,
    overall_quality_score,
  };
  const reason_codes = buildReasonCodes(record, scores);
  const classification = classifyOffRecord(record, context);
  const review_status_suggestion =
    classification === 'candidate_ok' ? 'pending' : classification === 'auto_reject' ? 'rejected' : 'needs_review';

  return {
    code: toText(record.code),
    source_provider: 'open_food_facts',
    source_provider_product_id: toText(record.code),
    provider_url: toText(record.url),
    proposed_name: proposedName,
    proposed_brand: proposedBrand,
    ru_display_name: ruDisplayName,
    normalized_name: normalizedName,
    normalized_brand: normalizedBrand,
    calories,
    protein,
    fat,
    carbs,
    fiber,
    classification,
    review_status_suggestion,
    reason_codes,
    ...scores,
    notes: buildNotes(record, classification, reason_codes),
  };
};

export const cleanOffRecords = (records: OffRecord[], context: OffCleanerContext = {}): CleanedOffRecord[] => {
  const seenBarcodes = new Set<string>();
  const seenNameBrands = new Set<string>();
  const existingBarcodes = contextSet(context.existingBarcodes);
  const existingNameBrands = contextSet(context.existingNameBrands);

  return records.map((record) => {
    const cleaned = cleanOffRecord(record, {
      existingBarcodes,
      existingNameBrands,
      seenBarcodes,
      seenNameBrands,
    });

    if (cleaned.code) seenBarcodes.add(cleaned.code.toLowerCase());
    if (cleaned.normalized_name && cleaned.normalized_brand) {
      seenNameBrands.add(makeNameBrandKey(cleaned.normalized_name, cleaned.normalized_brand).toLowerCase());
    }

    return cleaned;
  });
};

export const summarizeCleanedRecords = (records: CleanedOffRecord[]) => {
  const countByClassification = Object.fromEntries(
    (['candidate_ok', 'needs_language_review', 'needs_quality_review', 'needs_duplicate_review', 'auto_reject'] as const).map(
      (classification) => [classification, records.filter((record) => record.classification === classification).length]
    )
  ) as Record<OffClassification, number>;

  const countByReasonCode = records.reduce<Record<string, number>>((acc, record) => {
    for (const reason of record.reason_codes) {
      acc[reason] = (acc[reason] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    totalRows: records.length,
    countByClassification,
    countByReasonCode,
  };
};

const buildNotes = (
  record: OffRecord,
  classification: OffClassification,
  reasons: OffReasonCode[]
): string[] => {
  const notes = [`classification=${classification}`];
  if (reasons.length > 0) notes.push(`reasons=${reasons.join(',')}`);
  if (isPer100mlCandidate(record, resolveRussianDisplayName(record) || toText(record.product_name))) {
    notes.push('beverage/liquid candidate needs explicit per-100ml handling');
  }
  if (classification === 'candidate_ok') {
    notes.push('candidate only; not verified catalog promotion');
  }
  return notes;
};
