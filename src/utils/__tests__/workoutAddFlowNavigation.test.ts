import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExclusiveWorkoutFlowState,
  getFlowLayerAfterCategoryExercisesLoad,
  getFlowLayerAfterExerciseSelection,
  shouldReturnToCategorySheetAfterCreateExerciseClose,
  shouldReturnToCategorySheetAfterExerciseListClose,
} from '../workoutAddFlowNavigation';

test('closing category exercise list returns to category sheet', () => {
  assert.equal(shouldReturnToCategorySheetAfterExerciseListClose(), true);
});

test('closing custom exercises sheet returns to category sheet', () => {
  assert.equal(shouldReturnToCategorySheetAfterExerciseListClose(), true);
});

test('closing create exercise modal returns to category sheet on cancel', () => {
  assert.equal(shouldReturnToCategorySheetAfterCreateExerciseClose('cancel', 'create'), true);
});

test('successful custom exercise create returns user to add-flow category step', () => {
  assert.equal(shouldReturnToCategorySheetAfterCreateExerciseClose('saved', 'create'), true);
});

test('closing custom exercise edit modal does not force category sheet reopen', () => {
  assert.equal(shouldReturnToCategorySheetAfterCreateExerciseClose('cancel', 'edit'), false);
});

test('category sheet and selected exercises editor cannot stay open simultaneously', () => {
  const editorState = buildExclusiveWorkoutFlowState('editor');
  const categoryState = buildExclusiveWorkoutFlowState('category');

  assert.equal(editorState.isSelectedExercisesEditorOpen, true);
  assert.equal(editorState.isExerciseCategorySheetOpen, false);
  assert.equal(categoryState.isExerciseCategorySheetOpen, true);
  assert.equal(categoryState.isSelectedExercisesEditorOpen, false);
});

test('add workout flow keeps exactly one sheet layer open through category list editor cycle', () => {
  const sequence = ['category', 'list', 'editor', 'root'] as const;

  sequence.forEach((target) => {
    const state = buildExclusiveWorkoutFlowState(target);
    const openLayerCount = [
      state.isExerciseCategorySheetOpen,
      state.isExerciseListSheetOpen,
      state.isCreateExerciseModalOpen,
      state.isSelectedExercisesEditorOpen,
    ].filter(Boolean).length;

    assert.equal(openLayerCount, target === 'root' ? 0 : 1, `${target} should have exclusive sheet state`);
  });
});

test('create exercise layer is exclusive and returns to category flow after save', () => {
  const createState = buildExclusiveWorkoutFlowState('create');

  assert.deepEqual(createState, {
    isExerciseCategorySheetOpen: false,
    isExerciseListSheetOpen: false,
    isCreateExerciseModalOpen: true,
    isSelectedExercisesEditorOpen: false,
  });
  assert.equal(shouldReturnToCategorySheetAfterCreateExerciseClose('saved', 'create'), true);
});

test('category exercises load keeps add-flow active and opens list only after success', () => {
  assert.equal(getFlowLayerAfterCategoryExercisesLoad(true), 'list');
  assert.equal(getFlowLayerAfterCategoryExercisesLoad(false), 'category');
});

test('selected exercises editor opens after valid selection', () => {
  assert.equal(getFlowLayerAfterExerciseSelection(), 'editor');
});
