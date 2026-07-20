import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDiaryPayloadContract,
  evaluateDiarySchemaContract,
  type DiarySchemaColumn,
} from './check-diary-schema-contract-staging.ts';
import { calculateDiarySnapshot, type DiaryFoodRecord } from '../src/services/diaryCreateService.ts';

function baseColumns(overrides: Partial<Record<string, Partial<DiarySchemaColumn>>> = {}): DiarySchemaColumn[] {
  const defaults: Record<string, DiarySchemaColumn> = {
    user_id: { name: 'user_id', dataType: 'uuid', nullable: false, defaultValue: null },
    date: { name: 'date', dataType: 'date', nullable: false, defaultValue: null },
    meal_type: { name: 'meal_type', dataType: 'text', nullable: false, defaultValue: null },
    canonical_food_id: { name: 'canonical_food_id', dataType: 'uuid', nullable: true, defaultValue: null },
    product_name: { name: 'product_name', dataType: 'text', nullable: false, defaultValue: null },
    weight: { name: 'weight', dataType: 'numeric', nullable: false, defaultValue: '0' },
    calories: { name: 'calories', dataType: 'numeric', nullable: false, defaultValue: '0' },
    protein: { name: 'protein', dataType: 'numeric', nullable: false, defaultValue: '0' },
    fat: { name: 'fat', dataType: 'numeric', nullable: false, defaultValue: '0' },
    carbs: { name: 'carbs', dataType: 'numeric', nullable: false, defaultValue: '0' },
    fiber: { name: 'fiber', dataType: 'numeric', nullable: true, defaultValue: null },
    idempotency_key: { name: 'idempotency_key', dataType: 'text', nullable: true, defaultValue: null },
    base_unit: { name: 'base_unit', dataType: 'text', nullable: true, defaultValue: "'г'::text" },
    display_unit: { name: 'display_unit', dataType: 'text', nullable: true, defaultValue: "'г'::text" },
    display_amount: { name: 'display_amount', dataType: 'numeric', nullable: true, defaultValue: null },
  };

  return Object.entries(defaults)
    .filter(([name]) => overrides[name] !== null)
    .map(([name, column]) => ({ ...column, ...(overrides[name] ?? {}) }));
}

function food(overrides: Partial<DiaryFoodRecord> = {}): DiaryFoodRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    canonical_food_id: '11111111-1111-4111-8111-111111111111',
    source: 'core',
    created_by_user_id: null,
    calories: 100,
    protein: 10,
    fat: 5,
    carbs: 12,
    fiber: null,
    ...overrides,
  };
}

test('diary schema with nullable fiber and no default is compatible', () => {
  const result = evaluateDiarySchemaContract(baseColumns());

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_PASS');
  assert.equal(result.blockers.length, 0);
});

test('diary schema missing fiber is a blocker', () => {
  const result = evaluateDiarySchemaContract(baseColumns({ fiber: null }));

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_FAIL');
  assert.equal(result.blockers[0].status, 'MISSING_COLUMN');
  assert.equal(result.blockers[0].column, 'fiber');
});

test('diary fiber NOT NULL is a nullable contract blocker', () => {
  const result = evaluateDiarySchemaContract(baseColumns({ fiber: { nullable: false } }));

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_FAIL');
  assert.equal(result.blockers.some((finding) => finding.status === 'NULLABILITY_MISMATCH' && finding.column === 'fiber'), true);
});

test('diary fiber DEFAULT 0 is a semantic blocker', () => {
  const result = evaluateDiarySchemaContract(baseColumns({ fiber: { defaultValue: '0' } }));

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_FAIL');
  assert.equal(result.blockers.some((finding) => finding.status === 'DEFAULT_SEMANTIC_MISMATCH' && finding.column === 'fiber'), true);
});

test('canonical_food_id must be uuid-compatible', () => {
  const result = evaluateDiarySchemaContract(baseColumns({ canonical_food_id: { dataType: 'text' } }));

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_FAIL');
  assert.equal(result.blockers.some((finding) => finding.status === 'TYPE_MISMATCH' && finding.column === 'canonical_food_id'), true);
});

test('required macro column missing is a blocker', () => {
  const result = evaluateDiarySchemaContract(baseColumns({ calories: null }));

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_FAIL');
  assert.equal(result.blockers.some((finding) => finding.status === 'MISSING_COLUMN' && finding.column === 'calories'), true);
});

test('runtime payload fiber null remains null under snapshot scaling', () => {
  assert.equal(calculateDiarySnapshot(food({ fiber: null }), 125).fiber, null);
});

test('runtime payload fiber 0 remains confirmed zero under snapshot scaling', () => {
  assert.equal(calculateDiarySnapshot(food({ fiber: 0 }), 125).fiber, 0);
});

test('schema contract evaluation does not require write methods', () => {
  const payloadFields = buildDiaryPayloadContract();
  const result = evaluateDiarySchemaContract(baseColumns(), payloadFields);

  assert.equal(result.verdict, 'DIARY_SCHEMA_CONTRACT_PASS');
  assert.equal(payloadFields.length, 15);
});
