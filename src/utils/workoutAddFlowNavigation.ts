export type CreateExerciseModalCloseReason = 'cancel' | 'saved';
export type CreateExerciseModalMode = 'create' | 'edit';
export type WorkoutAddFlowLayer = 'root' | 'category' | 'list' | 'editor' | 'create';

export function shouldReturnToCategorySheetAfterExerciseListClose(): boolean {
  return true;
}

export function shouldReturnToCategorySheetAfterCreateExerciseClose(
  _reason: CreateExerciseModalCloseReason,
  mode: CreateExerciseModalMode,
): boolean {
  return mode === 'create';
}

export function buildExclusiveWorkoutFlowState(target: WorkoutAddFlowLayer) {
  return {
    isExerciseCategorySheetOpen: target === 'category',
    isExerciseListSheetOpen: target === 'list',
    isCreateExerciseModalOpen: target === 'create',
    isSelectedExercisesEditorOpen: target === 'editor',
  };
}

export function getFlowLayerAfterCategoryExercisesLoad(success: boolean): WorkoutAddFlowLayer {
  return success ? 'list' : 'category';
}

export function getFlowLayerAfterExerciseSelection(): WorkoutAddFlowLayer {
  return 'editor';
}
