import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoalSaveStatus } from '../goalService';

test('goal save status returns remote success when Supabase save succeeds', () => {
  assert.equal(getGoalSaveStatus(true, true), 'success_remote');
  assert.equal(getGoalSaveStatus(true, false), 'success_remote');
});

test('goal save status returns local-only when Supabase fails and local fallback succeeds', () => {
  assert.equal(getGoalSaveStatus(false, true), 'success_local_only');
});

test('goal save status returns failed when neither Supabase nor local fallback saves', () => {
  assert.equal(getGoalSaveStatus(false, false), 'failed');
});
