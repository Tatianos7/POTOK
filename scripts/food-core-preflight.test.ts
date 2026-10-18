import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import xlsx from 'xlsx';
import { runFoodCorePreflightCli } from './food-core-preflight-cli.ts';
import { analyzeFoodCore, type CatalogSnapshotV1 } from './food-core-preflight.ts';

const FOOD_HEADERS = [
  'id', 'canonical_name', 'normalized_name', 'display_name', 'category',
  'product_scope', 'source', 'canonical_food_id', 'calories_100g',
  'protein_100g', 'fat_100g', 'carbs_100g', 'fiber_100g', 'unit',
];
const ALIAS_HEADERS = ['alias', 'canonical_id', 'canonical_name', 'normalized_alias', 'type', 'comment'];
const FOOD = ['apple', 'Яблоко', 'яблоко', 'Яблоко', 'фрукты', 'core', 'core', 'apple', 52, 0.3, 0.2, 14, '', 'g'];
const ALIAS = ['Яблоки', 'apple', 'Яблоко', 'яблоки', 'plural', ''];

function workbook(options: {
  foods?: unknown[][];
  aliases?: unknown[][];
  metadata?: unknown[][];
  foodHeaders?: string[];
  readme?: unknown[][];
} = {}): Uint8Array {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
    options.foodHeaders ?? FOOD_HEADERS, ...(options.foods ?? [FOOD]),
  ]), 'foods_import');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
    ['ALIASES — безопасная таблица для Resolver'],
    ['Правило: один normalized_alias ведёт только к одному canonical_id.'],
    ALIAS_HEADERS, ...(options.aliases ?? [ALIAS]),
  ]), 'ALIASES');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(options.metadata ?? [
    ['Поле ', 'значение'], ['Food Core Version', 'v02'], ['Build Date', 46202],
    ['Products', (options.foods ?? [FOOD]).length], ['Aliases', (options.aliases ?? [ALIAS]).length],
    ['Validator', 'PASS_WITH_WARNINGS'],
  ]), 'metadata');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(options.readme ?? [
    ['Лист foods_import: нутриенты указываются НА 100 грамм. Это основной источник для расчёта рецептов.'],
  ]), 'README');
  return xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
}

function snapshot(
  coverage: 'complete' | 'partial' = 'complete',
  changes: Partial<Omit<CatalogSnapshotV1, 'expectedSha256'>> = {},
): CatalogSnapshotV1 {
  const payload = {
    version: 1 as const,
    capturedAt: '2026-01-01T00:00:00.000Z',
    coverage: { foods: coverage, aliases: coverage },
    foods: [{
      id: '00000000-0000-4000-8000-000000000001', stableFoodId: 'apple',
      normalizedName: 'яблоко', normalizedBrand: null, source: 'core', ownerId: null,
    }],
    aliases: [{ normalizedAlias: 'яблоки', canonicalFoodId: '00000000-0000-4000-8000-000000000001' }],
    ...changes,
  };
  return {
    ...payload,
    expectedSha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
}

test('actual Food Core sheet and Metadata layout stays UNKNOWN without a snapshot and is repeatable', () => {
  const input = workbook();
  const first = analyzeFoodCore(input);
  const second = analyzeFoodCore(input);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
  assert.equal(first.catalogStatus, 'UNKNOWN');
  assert.equal(first.importAuthorized, false);
  assert.ok(first.catalogFindings.some((finding) => finding.code === 'CATALOG_SNAPSHOT_MISSING'));
  assert.equal(first.counts.foods, 1);
});

test('full master XLSX foods_import header order and ALIASES preamble parse', () => {
  const headers = [
    'name', 'id', 'name_original', 'brand', 'brand_original', 'canonical_name',
    'normalized_name', 'display_name', 'cooking_state', 'product_scope',
    'is_safe_canonical', 'needs_review', 'data_source', 'source_confidence',
    'normalized_brand', 'barcode', 'category', 'unit', 'calories_100g',
    'protein_100g', 'fat_100g', 'carbs_100g', 'fiber_100g', 'source',
    'created_by_user_id', 'canonical_food_id', 'nutrition_version', 'verified',
    'is_vegan', 'allergens', 'tags', 'confidence_score', 'grams_per_piece',
    'grams_per_tbsp', 'grams_per_tsp', 'density_g_ml', 'notes',
  ];
  const fields = Object.fromEntries(FOOD_HEADERS.map((header, index) => [header, FOOD[index]]));
  const report = analyzeFoodCore(workbook({
    foodHeaders: headers,
    foods: [headers.map((header) => fields[header] ?? '')],
  }));
  assert.deepEqual(report.counts, { foods: 1, aliases: 1 });
  assert.ok(!report.fileFindings.some((finding) => finding.severity === 'ERROR'));
  assert.equal(report.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
});

test('missing unit header and inconsistent real Metadata counts are file errors', () => {
  const noUnit = analyzeFoodCore(workbook({ foodHeaders: FOOD_HEADERS.filter((header) => header !== 'unit') }));
  assert.ok(noUnit.fileFindings.some((finding) => finding.code === 'HEADER_REQUIRED' && finding.field === 'unit'));
  const badCount = analyzeFoodCore(workbook({ metadata: [
    ['Поле ', 'значение'], ['Food Core Version', 'v02'], ['Products', 2], ['Aliases', 1],
  ] }));
  assert.ok(badCount.fileFindings.some((finding) => finding.code === 'METADATA_COUNT_MISMATCH'));
});

test('future, timezone-free and impossible snapshot timestamps are rejected', () => {
  for (const capturedAt of ['2999-01-01T00:00:00Z', '2026-01-01T00:00:00', '2026-02-30T00:00:00Z']) {
    const result = analyzeFoodCore(workbook(), snapshot('complete', { capturedAt }));
    assert.equal(result.catalogStatus, 'UNKNOWN');
    assert.ok(result.catalogFindings.some((finding) => finding.code === 'CATALOG_SNAPSHOT_INVALID'));
  }
});

test('duplicate catalog rows and dangling or duplicate aliases invalidate observations', () => {
  const base = snapshot();
  const invalid = [
    snapshot('complete', { foods: [...base.foods, { ...base.foods[0] }] }),
    snapshot('complete', { aliases: [{ normalizedAlias: 'яблоки', canonicalFoodId: '00000000-0000-4000-8000-000000000002' }] }),
    snapshot('complete', { aliases: [...base.aliases, { ...base.aliases[0] }] }),
  ];
  for (const candidate of invalid) {
    const result = analyzeFoodCore(workbook(), candidate);
    assert.equal(result.catalogStatus, 'UNKNOWN');
    assert.ok(result.catalogFindings.some((finding) => finding.code === 'CATALOG_SNAPSHOT_INVALID'));
    assert.ok(!result.catalogFindings.some((finding) => finding.code === 'CATALOG_STABLE_ID_MATCH_REVIEW'));
  }
});

test('malformed UUID, stable ID and normalized name invalidate snapshot', () => {
  const base = snapshot();
  for (const food of [
    { ...base.foods[0], id: 'bad-uuid' },
    { ...base.foods[0], stableFoodId: 'Bad ID' },
    { ...base.foods[0], normalizedName: 'Яблоко' },
  ]) {
    assert.equal(analyzeFoodCore(workbook(), snapshot('complete', { foods: [food] })).catalogStatus, 'UNKNOWN');
  }
});

test('snapshot rejects unexpected fields instead of silently changing the schema', () => {
  const base = snapshot();
  const food = { ...base.foods[0], unknownFlag: true };
  assert.equal(analyzeFoodCore(workbook(), snapshot('complete', { foods: [food] })).catalogStatus, 'UNKNOWN');
  const extraTopLevel = { ...base, unexpected: true } as CatalogSnapshotV1;
  assert.equal(analyzeFoodCore(workbook(), extraTopLevel).catalogStatus, 'UNKNOWN');
});

test('header-only Food Core workbook is invalid', () => {
  const result = analyzeFoodCore(workbook({ foods: [] }));
  assert.equal(result.fileStatus, 'INVALID');
  assert.ok(result.fileFindings.some((finding) => finding.code === 'FOOD_ROWS_EMPTY'));
});

test('README basis and carbohydrate semantics are not conflated', () => {
  const result = analyzeFoodCore(workbook({ readme: [['No declared nutrient basis']] }));
  assert.equal(result.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
  assert.ok(result.fileFindings.some((finding) => finding.code === 'UNIT_BASIS_UNKNOWN'));
  assert.ok(result.fileFindings.some((finding) => finding.code === 'CARBOHYDRATE_SEMANTICS_UNKNOWN'));
});

test('nullable fiber is distinct from invalid nonblank fiber and excess precision', () => {
  const nullFiber = analyzeFoodCore(workbook());
  assert.equal(nullFiber.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
  const badFiber = [...FOOD]; badFiber[12] = 'unknown';
  const bad = analyzeFoodCore(workbook({ foods: [badFiber] }));
  assert.ok(bad.fileFindings.some((finding) => finding.code === 'NUTRIENT_INVALID' && finding.field === 'fiber_100g'));
  const precise = [...FOOD]; precise[8] = '52.123';
  const precision = analyzeFoodCore(workbook({ foods: [precise] }));
  assert.ok(precision.fileFindings.some((finding) => finding.code === 'NUTRIENT_PRECISION'));
  const exponent = [...FOOD]; exponent[8] = '1e2';
  assert.ok(analyzeFoodCore(workbook({ foods: [exponent] })).fileFindings.some((finding) => finding.code === 'NUTRIENT_INVALID'));
});

test('g, ml, ml,g, blank and unsupported row units are classified without conversion', () => {
  for (const unit of ['g', 'ml', 'ml,g', '', 'kg']) {
    const food = [...FOOD]; food[13] = unit;
    const result = analyzeFoodCore(workbook({ foods: [food] }));
    if (unit === 'g') {
      assert.ok(!result.fileFindings.some((finding) => finding.code === 'NUTRIENT_BASIS_UNKNOWN'));
    } else if (unit === 'ml' || unit === 'ml,g') {
      assert.equal(result.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
      assert.ok(result.fileFindings.some((finding) => finding.code === 'NUTRIENT_BASIS_UNKNOWN' && finding.row === 2 && finding.field === 'unit'));
    } else {
      assert.equal(result.fileStatus, 'INVALID');
      assert.ok(result.fileFindings.some((finding) => finding.code === 'UNIT_INVALID' && finding.row === 2));
    }
  }
});

test('formula nutrient cells are rejected even when a cached numeric value exists', () => {
  const book = xlsx.utils.book_new();
  const foods = xlsx.utils.aoa_to_sheet([FOOD_HEADERS, FOOD]);
  foods.I2 = { t: 'n', f: '50+2', v: 52 };
  xlsx.utils.book_append_sheet(book, foods, 'foods_import');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([ALIAS_HEADERS, ALIAS]), 'ALIASES');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
    ['Поле ', 'значение'], ['Products', 1], ['Aliases', 1],
  ]), 'metadata');
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
    ['Лист foods_import: нутриенты указываются НА 100 грамм.'],
  ]), 'README');
  const result = analyzeFoodCore(xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
  assert.ok(result.fileFindings.some((finding) => finding.code === 'FORMULA_UNSUPPORTED' && finding.field === 'calories_100g'));
});

test('required headers, duplicate IDs, ambiguous aliases and missing targets are file findings', () => {
  const second = [...FOOD]; second[1] = 'Другое яблоко';
  const conflictingAlias = [...ALIAS]; conflictingAlias[1] = 'other';
  const result = analyzeFoodCore(workbook({
    foodHeaders: FOOD_HEADERS.filter((header) => header !== 'category'),
    foods: [FOOD, second], aliases: [ALIAS, conflictingAlias],
  }));
  assert.equal(result.fileStatus, 'INVALID');
  for (const code of ['HEADER_REQUIRED', 'FOOD_ID_DUPLICATE', 'ALIAS_TARGET_MISSING', 'ALIAS_AMBIGUOUS']) {
    assert.ok(result.fileFindings.some((finding) => finding.code === code), code);
  }
});

test('alias matching a different food name is an identity ambiguity', () => {
  const banana = ['banana', 'Банан', 'банан', 'Банан', 'фрукты', 'core', 'core', 'banana', 89, 1, 0.3, 23, '', 'g'];
  const crossAlias = ['Банан', 'apple', 'Яблоко', 'банан', 'common', ''];
  const result = analyzeFoodCore(workbook({ foods: [FOOD, banana], aliases: [crossAlias] }));
  assert.ok(result.fileFindings.some((finding) => finding.code === 'ALIAS_FOOD_NAME_AMBIGUOUS'));
  assert.equal(result.importAuthorized, false);
});

test('verified partial snapshot reports known conflicts without claiming complete catalog coverage', () => {
  const result = analyzeFoodCore(workbook(), snapshot('partial'));
  assert.equal(result.catalogStatus, 'PARTIAL');
  for (const code of ['CATALOG_COVERAGE_PARTIAL', 'CATALOG_STABLE_ID_MATCH_REVIEW', 'CATALOG_NORMALIZED_KEY_COLLISION', 'CATALOG_ALIAS_COLLISION']) {
    assert.ok(result.catalogFindings.some((finding) => finding.code === code), code);
  }
  assert.equal(result.importAuthorized, false);
});

test('self-declared complete snapshot remains PARTIAL', () => {
  const result = analyzeFoodCore(workbook(), snapshot());
  assert.equal(result.catalogStatus, 'PARTIAL');
  assert.equal(result.importAuthorized, false);
  assert.ok(result.catalogFindings.some((finding) => finding.code === 'CATALOG_STABLE_ID_MATCH_REVIEW'));
});

test('legacy no_brand sentinel still reveals a normalized catalog collision', () => {
  const base = snapshot();
  const report = analyzeFoodCore(workbook(), snapshot('complete', {
    foods: [{ ...base.foods[0], normalizedBrand: 'no_brand' }],
  }));
  assert.equal(report.catalogStatus, 'PARTIAL');
  assert.ok(report.catalogFindings.some((finding) => finding.code === 'CATALOG_NORMALIZED_KEY_COLLISION'));
});

test('unverified snapshot is UNKNOWN and cannot suppress missing-catalog uncertainty', () => {
  const bad = { ...snapshot(), expectedSha256: '0'.repeat(64) };
  const result = analyzeFoodCore(workbook(), bad);
  assert.equal(result.catalogStatus, 'UNKNOWN');
  assert.ok(result.catalogFindings.some((finding) => finding.code === 'CATALOG_SNAPSHOT_UNVERIFIED'));
  assert.ok(!result.catalogFindings.some((finding) => finding.code === 'CATALOG_STABLE_ID_MATCH_REVIEW'));
});

test('analysis makes no network or filesystem write calls', () => {
  const previousFetch = globalThis.fetch;
  const previousWriteFile = fs.writeFileSync;
  const previousAppendFile = fs.appendFileSync;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('network forbidden');
  }) as typeof fetch;
  fs.writeFileSync = (() => { calls += 1; throw new Error('write forbidden'); }) as typeof fs.writeFileSync;
  fs.appendFileSync = (() => { calls += 1; throw new Error('write forbidden'); }) as typeof fs.appendFileSync;
  try {
    const result = analyzeFoodCore(workbook(), snapshot());
    assert.equal(result.fileStatus, 'VALID_WITH_UNKNOWN_SEMANTICS');
    assert.equal(calls, 0);
    assert.equal(result.importAuthorized, false);
  } finally {
    globalThis.fetch = previousFetch;
    fs.writeFileSync = previousWriteFile;
    fs.appendFileSync = previousAppendFile;
  }
});

test('CLI reads synthetic bytes, verifies external hash and writes only repeatable JSON to supplied stdout', () => {
  const input = workbook();
  const { expectedSha256: _digest, ...payload } = snapshot();
  void _digest;
  const rawSnapshot = Buffer.from(JSON.stringify(payload));
  const hash = createHash('sha256').update(rawSnapshot).digest('hex');
  const files = new Map([[resolve('synthetic.xlsx'), Buffer.from(input)], [resolve('offline.json'), rawSnapshot]]);
  const previousFetch = globalThis.fetch;
  const previousWrite = fs.writeFileSync;
  const previousAppend = fs.appendFileSync;
  let sideEffects = 0;
  globalThis.fetch = (async () => { sideEffects += 1; throw new Error('network forbidden'); }) as typeof fetch;
  fs.writeFileSync = (() => { sideEffects += 1; throw new Error('write forbidden'); }) as typeof fs.writeFileSync;
  fs.appendFileSync = (() => { sideEffects += 1; throw new Error('write forbidden'); }) as typeof fs.appendFileSync;
  try {
    const outputs: string[] = [];
    const args = ['--file', 'synthetic.xlsx', '--catalog-snapshot', 'offline.json', '--snapshot-sha256', hash];
    const read = (path: string): Uint8Array => {
      const bytes = files.get(path);
      if (!bytes) throw new Error('Unexpected read');
      return bytes;
    };
    runFoodCorePreflightCli(args, read, (json) => { outputs.push(json); });
    runFoodCorePreflightCli(args, read, (json) => { outputs.push(json); });
    assert.equal(outputs[0], outputs[1]);
    assert.equal(JSON.parse(outputs[0]).catalogStatus, 'PARTIAL');
    assert.equal(sideEffects, 0);
    assert.throws(() => runFoodCorePreflightCli([...args.slice(0, -1), '0'.repeat(64)], read, () => {}), /SHA-256/);
  } finally {
    globalThis.fetch = previousFetch;
    fs.writeFileSync = previousWrite;
    fs.appendFileSync = previousAppend;
  }
});
