import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyImport,
  dedupeAliasCandidatesByDbNormalizedAlias,
  exactFoodMatch,
  evaluateAliasPhaseGate,
  evaluateSchemaDataContracts,
  evaluateSchemaDataContractWarnings,
  mapFoodToDb,
  normalizeFoodTextForDb,
} from './import-food-core.ts';

const makeFood = (id: string) => ({
  id,
  display_name: `Food ${id}`,
  canonical_name: `Food ${id}`,
  normalized_name: `food_${id}`,
  source: 'core',
  canonical_food_id: id,
  calories_100g: 1,
  protein_100g: 1,
  fat_100g: 1,
  carbs_100g: 1,
  fiber_100g: null,
  category: 'test',
  product_scope: 'core',
  cooking_state: '',
  brand: '',
  normalized_brand: 'no_brand',
});

const makeAlias = (id: string) => ({
  alias: `Alias ${id}`,
  normalized_alias: `alias_${id}`,
  canonical_id: id,
  canonical_name: `Food ${id}`,
  type: 'common',
  comment: '',
});

const makePreflight = ({
  foodCount = 1,
  skippedFoodCount = 0,
  aliasCount = 1,
  aliasResolutionErrors = 0,
} = {}) => {
  const foodInsertCandidates = Array.from({ length: foodCount }, (_, index) => makeFood(String(index + 1)));
  const foodSkippedExisting = Array.from({ length: skippedFoodCount }, (_, index) => makeFood(`existing_${index + 1}`));
  const aliasInsertCandidates = Array.from({ length: aliasCount }, (_, index) => ({
    alias: makeAlias(String(index + 1)),
    canonicalUuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    dbNormalizedAlias: `alias ${index + 1}`,
  }));
  const generatedFoodIdsByStableId = new Map<string, string>();
  for (const food of foodInsertCandidates) {
    generatedFoodIdsByStableId.set(food.id, `00000000-0000-4000-8000-${food.id.padStart(12, '0')}`);
  }
  return {
    dbFoods: [],
    dbAliases: [],
    foodAliasTableExists: true,
    foodSchema: new Set(['id', 'stable_food_id', 'name', 'normalized_name', 'calories', 'protein', 'fat', 'carbs', 'source', 'canonical_food_id']),
    aliasSchema: new Set(['alias', 'normalized_alias', 'canonical_food_id']),
    foodInsertCandidates,
    foodSkippedExisting,
    foodIdConflicts: [],
    normalizedNameLegacyConflicts: [],
    normalizedNameUserBrandWarnings: [],
    aliasInsertCandidates,
    aliasSkippedExisting: [],
    aliasDedupedEquivalents: [],
    aliasConflicts: [],
    aliasResolutionErrors: Array.from({ length: aliasResolutionErrors }, (_, index) => ({
      alias: makeAlias(String(index + 1)),
      reason: 'missing canonical',
    })),
    schemaWarnings: [],
    schemaErrors: [],
    schemaDataContractIssues: [],
    generatedFoodIdsByStableId,
    foodUuidByStableId: new Map(generatedFoodIdsByStableId),
  };
};

const makeArgs = (mode = 'apply') => ({
  file: 'test.xlsx',
  mode,
  target: 'staging',
  confirmProductionImport: '',
  allowAliasRemap: false,
  allowUpsert: false,
});

const makeSupabase = ({
  foodFailures = new Set<number>(),
  aliasFailures = new Set<number>(),
} = {}) => {
  const calls = {
    foods: 0,
    aliases: 0,
  };
  return {
    calls,
    client: {
      from(table: string) {
        return {
          async insert() {
            if (table === 'foods') {
              calls.foods += 1;
              if (foodFailures.has(calls.foods)) {
                return { error: { code: 'TEST_FOOD', message: 'food batch failed', details: 'detail', hint: 'hint' } };
              }
              return { error: null };
            }
            if (table === 'food_aliases') {
              calls.aliases += 1;
              if (aliasFailures.has(calls.aliases)) {
                return { error: { code: 'TEST_ALIAS', message: 'alias batch failed', details: 'detail', hint: 'hint' } };
              }
              return { error: null };
            }
            return { error: { code: 'TEST_TABLE', message: `unexpected table ${table}` } };
          },
          async upsert() {
            return this.insert();
          },
        };
      },
    },
  };
};

const baseFoodContracts = (overrides: Array<[string, { column: string; required: boolean; defaultValue: unknown; type: string }]> = []) => {
  const contracts = new Map([
    ['name', { column: 'name', required: true, defaultValue: null, type: 'text' }],
    ['stable_food_id', { column: 'stable_food_id', required: false, defaultValue: null, type: 'text' }],
    ['normalized_name', { column: 'normalized_name', required: false, defaultValue: null, type: 'text' }],
    ['calories', { column: 'calories', required: true, defaultValue: 0, type: 'numeric' }],
    ['protein', { column: 'protein', required: true, defaultValue: 0, type: 'numeric' }],
    ['fat', { column: 'fat', required: true, defaultValue: 0, type: 'numeric' }],
    ['carbs', { column: 'carbs', required: true, defaultValue: 0, type: 'numeric' }],
    ['fiber', { column: 'fiber', required: false, defaultValue: null, type: 'numeric' }],
    ['source', { column: 'source', required: true, defaultValue: null, type: 'text' }],
    ['canonical_food_id', { column: 'canonical_food_id', required: false, defaultValue: null, type: 'uuid' }],
    ['brand', { column: 'brand', required: false, defaultValue: null, type: 'text' }],
    ['normalized_brand', { column: 'normalized_brand', required: false, defaultValue: null, type: 'text' }],
    ['category', { column: 'category', required: false, defaultValue: null, type: 'text' }],
    ['product_scope', { column: 'product_scope', required: false, defaultValue: null, type: 'text' }],
    ['data_source', { column: 'data_source', required: false, defaultValue: null, type: 'text' }],
    ['cooking_state', { column: 'cooking_state', required: false, defaultValue: null, type: 'text' }],
  ]);
  for (const [key, value] of overrides) {
    contracts.set(key, value);
  }
  return contracts;
};

test('food batch success allows alias phase after all foods', async () => {
  const preflight = makePreflight({ foodCount: 101, aliasCount: 1 });
  const { client, calls } = makeSupabase();
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodBatchesAttempted, 2);
  assert.equal(summary.foodsInserted, 101);
  assert.equal(summary.foodInsertFailures.length, 0);
  assert.equal(summary.aliasPhaseStarted, true);
  assert.equal(summary.aliasesInserted, 1);
  assert.equal(calls.foods, 2);
  assert.equal(calls.aliases, 1);
});

test('first food batch failure stops foods and skips alias phase', async () => {
  const preflight = makePreflight({ foodCount: 101, aliasCount: 1 });
  const { client, calls } = makeSupabase({ foodFailures: new Set([1]) });
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodBatchesAttempted, 1);
  assert.equal(summary.foodsInserted, 0);
  assert.equal(summary.foodRowsFailed, 100);
  assert.match(summary.foodInsertFailures[0], /batch=1/);
  assert.equal(summary.aliasPhaseStarted, false);
  assert.equal(summary.aliasPhaseSkippedReason, 'food_insert_failure');
  assert.equal(calls.foods, 1);
  assert.equal(calls.aliases, 0);
});

test('later food batch failure preserves partial count and skips alias phase', async () => {
  const preflight = makePreflight({ foodCount: 201, aliasCount: 1 });
  const { client, calls } = makeSupabase({ foodFailures: new Set([2]) });
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodBatchesAttempted, 2);
  assert.equal(summary.foodsInserted, 100);
  assert.equal(summary.foodRowsFailed, 100);
  assert.equal(summary.aliasPhaseStarted, false);
  assert.equal(summary.aliasPhaseSkippedReason, 'food_insert_failure');
  assert.equal(calls.foods, 2);
  assert.equal(calls.aliases, 0);
});

test('alias resolution errors block alias phase', async () => {
  const preflight = makePreflight({ foodCount: 1, aliasCount: 1, aliasResolutionErrors: 1 });
  const { client, calls } = makeSupabase();
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodsInserted, 1);
  assert.equal(summary.aliasPhaseStarted, false);
  assert.equal(summary.aliasPhaseSkippedReason, 'alias_resolution_error');
  assert.equal(calls.aliases, 0);
});

test('missing canonical stable ids are represented by alias resolution errors', () => {
  const gate = evaluateAliasPhaseGate({
    mode: 'apply',
    foodsInserted: 1,
    foodsSkipped: 0,
    foodInsertFailures: [],
    expectedFoodRows: 1,
    aliasResolutionErrors: 1,
    aliasInsertCandidates: 1,
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'alias_resolution_error');
});

test('alias batch failure stops remaining alias batches and keeps partial counts', async () => {
  const preflight = makePreflight({ foodCount: 1, aliasCount: 101 });
  const { client, calls } = makeSupabase({ aliasFailures: new Set([1]) });
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodsInserted, 1);
  assert.equal(summary.aliasPhaseStarted, true);
  assert.equal(summary.aliasBatchesAttempted, 1);
  assert.equal(summary.aliasesInserted, 0);
  assert.equal(summary.aliasRowsFailed, 100);
  assert.match(summary.aliasInsertFailures[0], /batch=1/);
  assert.equal(calls.aliases, 1);
});

test('dry-run gate never allows alias writes', () => {
  const gate = evaluateAliasPhaseGate({
    mode: 'dry-run',
    foodsInserted: 0,
    foodsSkipped: 0,
    foodInsertFailures: [],
    expectedFoodRows: 0,
    aliasResolutionErrors: 0,
    aliasInsertCandidates: 1,
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'mode_not_apply');
});

test('full successful apply simulation starts alias phase once', async () => {
  const preflight = makePreflight({ foodCount: 1, aliasCount: 1 });
  const { client, calls } = makeSupabase();
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.foodInsertFailures.length, 0);
  assert.equal(summary.aliasInsertFailures.length, 0);
  assert.equal(summary.aliasPhaseStarted, true);
  assert.equal(calls.aliases, 1);
});

test('schema contract allows nullable fiber with Excel null', () => {
  const contracts = baseFoodContracts();
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);

  assert.equal(issues.length, 0);
});

test('schema contract warns when nullable fiber has default zero and Excel null', () => {
  const contracts = baseFoodContracts([
    ['fiber', { column: 'fiber', required: false, defaultValue: 0, type: 'numeric' }],
  ]);
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);
  const warnings = evaluateSchemaDataContractWarnings([makeFood('1')] as never, contracts);

  assert.equal(issues.length, 0);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].column, 'fiber');
  assert.match(warnings[0].message, /unexpected_default_for_nullable_optional_nutrient/);
});

test('schema contract fails when fiber is NOT NULL and Excel has null without substitution', () => {
  const contracts = baseFoodContracts([
    ['fiber', { column: 'fiber', required: true, defaultValue: null, type: 'numeric' }],
  ]);
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].column, 'fiber');
  assert.equal(issues[0].excelNullCount, 1);
});

test('schema contract fails when required calories are null', () => {
  const food = { ...makeFood('1'), calories_100g: null };
  const contracts = baseFoodContracts([
    ['calories', { column: 'calories', required: true, defaultValue: 0, type: 'numeric' }],
  ]);
  const issues = evaluateSchemaDataContracts([food] as never, contracts);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].column, 'calories');
});

test('schema contract allows NOT NULL column when all Excel values are non-null', () => {
  const contracts = baseFoodContracts([
    ['calories', { column: 'calories', required: true, defaultValue: 0, type: 'numeric' }],
  ]);
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);

  assert.equal(issues.length, 0);
});

test('schema contract allows nullable optional metadata', () => {
  const contracts = baseFoodContracts([
    ['brand', { column: 'brand', required: false, defaultValue: null, type: 'text' }],
  ]);
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);

  assert.equal(issues.length, 0);
});

test('schema contract fails for missing required DB column', () => {
  const contracts = new Map();
  const issues = evaluateSchemaDataContracts([makeFood('1')] as never, contracts);

  assert.ok(issues.some((issue) => issue.column === 'name'));
});

test('food mapping keeps null fiber as null and does not substitute zero', () => {
  const row = mapFoodToDb(
    makeFood('1') as never,
    new Set(['id', 'stable_food_id', 'name', 'normalized_name', 'calories', 'protein', 'fat', 'carbs', 'source', 'canonical_food_id', 'fiber']),
    '00000000-0000-4000-8000-000000000001'
  );

  assert.equal(row.fiber, null);
});

test('dry-run mode never performs writes through apply helper', () => {
  const gate = evaluateAliasPhaseGate({
    mode: 'dry-run',
    foodsInserted: 1,
    foodsSkipped: 0,
    foodInsertFailures: [],
    expectedFoodRows: 1,
    aliasResolutionErrors: 0,
    aliasInsertCandidates: 1,
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'mode_not_apply');
});

test('DB alias normalization collapses decimal punctuation variants', () => {
  assert.equal(normalizeFoodTextForDb('ацидофилин 0,1%'), 'ацидофилин 0 1');
  assert.equal(normalizeFoodTextForDb('ацидофилин 0.1%'), 'ацидофилин 0 1');
});

test('duplicate DB-normalized aliases to same canonical are deduped without error', () => {
  const first = makeAlias('acidophilus_0_1');
  first.alias = 'ацидофилин 0,1%';
  const second = makeAlias('acidophilus_0_1');
  second.alias = 'ацидофилин 0.1%';

  const result = dedupeAliasCandidatesByDbNormalizedAlias([
    {
      alias: first,
      canonicalUuid: '00000000-0000-4000-8000-000000000001',
      dbNormalizedAlias: normalizeFoodTextForDb(first.alias),
    },
    {
      alias: second,
      canonicalUuid: '00000000-0000-4000-8000-000000000001',
      dbNormalizedAlias: normalizeFoodTextForDb(second.alias),
    },
  ] as never);

  assert.equal(result.insertCandidates.length, 1);
  assert.equal(result.dedupedEquivalents.length, 1);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.dedupedEquivalents[0].dbNormalizedAlias, 'ацидофилин 0 1');
});

test('duplicate DB-normalized aliases to different canonical foods are conflicts', () => {
  const first = makeAlias('acidophilus_0_1');
  first.alias = 'ацидофилин 0,1%';
  const second = makeAlias('other_food');
  second.alias = 'ацидофилин 0.1%';

  const result = dedupeAliasCandidatesByDbNormalizedAlias([
    {
      alias: first,
      canonicalUuid: '00000000-0000-4000-8000-000000000001',
      dbNormalizedAlias: normalizeFoodTextForDb(first.alias),
    },
    {
      alias: second,
      canonicalUuid: '00000000-0000-4000-8000-000000000002',
      dbNormalizedAlias: normalizeFoodTextForDb(second.alias),
    },
  ] as never);

  assert.equal(result.insertCandidates.length, 0);
  assert.equal(result.dedupedEquivalents.length, 0);
  assert.equal(result.conflicts.length, 2);
  assert.match(result.conflicts[0].reason, /multiple canonical ids/);
});

test('apply aliases uses deduped candidate set', async () => {
  const preflight = makePreflight({ foodCount: 1, aliasCount: 1 });
  const representative = makeAlias('1');
  representative.alias = 'ацидофилин 0,1%';
  preflight.aliasInsertCandidates = [{
    alias: representative,
    canonicalUuid: '00000000-0000-4000-8000-000000000001',
    dbNormalizedAlias: 'ацидофилин 0 1',
  }];
  preflight.aliasDedupedEquivalents = [{
    alias: { ...makeAlias('1'), alias: 'ацидофилин 0.1%' },
    representative,
    dbNormalizedAlias: 'ацидофилин 0 1',
  }];

  const { client, calls } = makeSupabase();
  const summary = await applyImport(client as never, preflight as never, makeArgs() as never);

  assert.equal(summary.aliasPhaseStarted, true);
  assert.equal(summary.aliasesInserted, 1);
  assert.equal(calls.aliases, 1);
});

test('exact food match compares normalized_name to DB trigger output from display name', () => {
  const food = {
    ...makeFood('cooked_couscous'),
    display_name: 'Кус-кус приготовленный',
    canonical_name: 'Кус-кус приготовленный',
    normalized_name: 'кус-кус приготовленный',
  };
  const db = {
    id: '00000000-0000-4000-8000-000000000001',
    stable_food_id: 'cooked_couscous',
    canonical_food_id: 'different-but-ignored-for-exact-match',
    name: 'Кус-кус приготовленный',
    normalized_name: 'кус кус приготовленный',
    source: 'core',
    calories: 1,
    protein: 1,
    fat: 1,
    carbs: 1,
    normalized_brand: '',
  };

  assert.equal(exactFoodMatch(food as never, db), true);
});
