import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OffRecord,
  cleanOffRecord,
  cleanOffRecords,
  resolveRussianDisplayName,
} from '../offImportCleaner.ts';

const makeRecord = (overrides: Partial<OffRecord> = {}): OffRecord => ({
  code: '4607035892370',
  url: 'https://world.openfoodfacts.org/product/4607035892370',
  product_name: 'Томатная паста',
  product_name_ru: 'Томатная паста',
  brands: 'помидорка',
  countries: 'Russia',
  countries_tags: ['en:russia'],
  lang: 'ru',
  languages: 'Russian',
  languages_tags: ['en:russian'],
  categories: 'Tomato pastes',
  categories_tags: ['en:tomato-pastes'],
  nutriments: {
    'energy-kcal_100g': 100,
    proteins_100g: 4.8,
    fat_100g: 0.5,
    carbohydrates_100g: 19,
    fiber_100g: 2.8,
  },
  ...overrides,
});

test('clean product_name_ru with complete nutrition becomes candidate_ok', () => {
  const cleaned = cleanOffRecord(makeRecord());

  assert.equal(cleaned.classification, 'candidate_ok');
  assert.equal(cleaned.review_status_suggestion, 'pending');
  assert.equal(cleaned.source_provider, 'open_food_facts');
});

test('missing product_name_ru becomes review or reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name_ru: '',
    product_name: 'Хрутка хлопья',
    brands: 'Хрутка',
  }));

  assert.match(cleaned.classification, /needs_language_review|auto_reject/);
  assert.ok(cleaned.reason_codes.includes('missing_product_name_ru'));
});

test('Latin primary without Russian name becomes auto_reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name: 'Green milk almond',
    product_name_ru: '',
    brands: 'Green milk',
    lang: 'en',
    languages_tags: ['en:english'],
  }));

  assert.equal(cleaned.classification, 'auto_reject');
  assert.ok(cleaned.reason_codes.includes('latin_primary_name'));
});

test('mixed Russian and Latin name becomes needs_language_review', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name: 'молоко безлактозное parmalat comfort',
    product_name_ru: 'молоко безлактозное parmalat comfort',
    brands: 'parmalat',
    categories_tags: ['en:milks', 'en:beverages'],
  }));

  assert.equal(cleaned.classification, 'needs_language_review');
  assert.ok(cleaned.reason_codes.includes('mixed_language_name'));
});

test('Ukrainian Cyrillic markers become review or reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    code: '4820000000001',
    product_name: 'Молоко незбиране',
    product_name_ru: 'Молоко незбиране',
    lang: 'uk',
    languages: 'Ukrainian',
    languages_tags: ['en:ukrainian'],
    categories_tags: ['en:milks', 'en:beverages'],
  }));

  assert.match(cleaned.classification, /needs_language_review|auto_reject/);
  assert.ok(cleaned.reason_codes.includes('suspected_non_russian_cyrillic'));
});

test('OCR or scan noise becomes review or reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name: 'актив цитрус смотка',
    product_name_ru: 'актив цитрус смотка',
    brands: 'Aqua Minerale',
    categories_tags: ['en:beverages'],
    nutriments: {
      'energy-kcal_100g': 35,
      proteins_100g: 0,
      fat_100g: 0,
      carbohydrates_100g: 8.5,
      fiber_100g: 0,
    },
  }));

  assert.match(cleaned.classification, /needs_language_review|auto_reject/);
  assert.ok(cleaned.reason_codes.includes('ocr_or_scan_noise'));
});

test('missing calories becomes auto_reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    nutriments: {
      proteins_100g: 1,
      fat_100g: 1,
      carbohydrates_100g: 1,
      fiber_100g: 0,
    },
  }));

  assert.equal(cleaned.classification, 'auto_reject');
  assert.ok(cleaned.reason_codes.includes('missing_calories'));
});

test('missing protein/fat/carbs becomes auto_reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    nutriments: {
      'energy-kcal_100g': 100,
      proteins_100g: 1,
      fat_100g: 1,
      fiber_100g: 0,
    },
  }));

  assert.equal(cleaned.classification, 'auto_reject');
  assert.ok(cleaned.reason_codes.includes('missing_macros'));
});

test('all-zero water becomes needs_quality_review', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name: 'Вода питьевая',
    product_name_ru: 'Вода питьевая',
    brands: 'Святой Источник',
    categories_tags: ['en:waters', 'en:beverages'],
    nutriments: {
      'energy-kcal_100g': 0,
      proteins_100g: 0,
      fat_100g: 0,
      carbohydrates_100g: 0,
      fiber_100g: 0,
    },
  }));

  assert.equal(cleaned.classification, 'needs_quality_review');
  assert.ok(cleaned.reason_codes.includes('water_exception_needs_review'));
});

test('all-zero non-water becomes auto_reject', () => {
  const cleaned = cleanOffRecord(makeRecord({
    nutriments: {
      'energy-kcal_100g': 0,
      proteins_100g: 0,
      fat_100g: 0,
      carbohydrates_100g: 0,
      fiber_100g: 0,
    },
  }));

  assert.equal(cleaned.classification, 'auto_reject');
  assert.ok(cleaned.reason_codes.includes('all_zero_kbju'));
});

test('duplicate barcode becomes needs_duplicate_review', () => {
  const cleaned = cleanOffRecord(makeRecord(), {
    existingBarcodes: ['4607035892370'],
  });

  assert.equal(cleaned.classification, 'needs_duplicate_review');
  assert.ok(cleaned.reason_codes.includes('duplicate_barcode'));
});

test('duplicate normalized name plus brand becomes needs_duplicate_review', () => {
  const cleaned = cleanOffRecord(makeRecord({ code: '9999999999999' }), {
    existingNameBrands: ['томатная паста::помидорка'],
  });

  assert.equal(cleaned.classification, 'needs_duplicate_review');
  assert.ok(cleaned.reason_codes.includes('duplicate_name_brand'));
});

test('duplicate detection works across fixture context order', () => {
  const [first, second] = cleanOffRecords([
    makeRecord(),
    makeRecord({ code: '4607035892370', url: 'https://world.openfoodfacts.org/product/dupe' }),
  ]);

  assert.equal(first.classification, 'candidate_ok');
  assert.equal(second.classification, 'needs_duplicate_review');
});

test('per-100ml beverage gets explicit reason', () => {
  const cleaned = cleanOffRecord(makeRecord({
    product_name: 'Молоко ультрапастеризованное 3,5 %',
    product_name_ru: 'Молоко ультрапастеризованное 3,5 %',
    brands: 'Parmalat',
    categories_tags: ['en:milks', 'en:beverages'],
    nutriments: {
      'energy-kcal_100g': 62,
      proteins_100g: 3,
      fat_100g: 3.5,
      carbohydrates_100g: 4.7,
      fiber_100g: 0,
    },
  }));

  assert.ok(cleaned.reason_codes.includes('per_100ml_needs_handling'));
});

test('candidate_ok is never verified catalog promotion', () => {
  const cleaned = cleanOffRecord(makeRecord());

  assert.equal(cleaned.classification, 'candidate_ok');
  assert.equal(cleaned.review_status_suggestion, 'pending');
  assert.notEqual(cleaned.review_status_suggestion, 'approved');
});

test('Russian display resolver does not invent names from raw provider text', () => {
  const resolved = resolveRussianDisplayName(makeRecord({
    product_name: 'Coca-Cola Original Taste',
    product_name_ru: '',
  }));

  assert.equal(resolved, '');
});
