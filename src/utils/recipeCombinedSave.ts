export interface CombinedRecipeSaveResult<TRecipe = unknown, TDiary = unknown> {
  recipe: {
    status: 'fulfilled' | 'rejected';
    value?: TRecipe;
    reason?: unknown;
  };
  diary: {
    status: 'fulfilled' | 'rejected';
    value?: TDiary;
    reason?: unknown;
  };
}

export async function runCombinedRecipeSave<TRecipe, TDiary>(params: {
  saveRecipe: () => Promise<TRecipe>;
  saveDiary: () => Promise<TDiary>;
}): Promise<CombinedRecipeSaveResult<TRecipe, TDiary>> {
  try {
    const recipe = await params.saveRecipe();
    try {
      const diary = await params.saveDiary();
      return {
        recipe: { status: 'fulfilled', value: recipe },
        diary: { status: 'fulfilled', value: diary },
      };
    } catch (error) {
      return {
        recipe: { status: 'fulfilled', value: recipe },
        diary: { status: 'rejected', reason: error },
      };
    }
  } catch (error) {
    return {
      recipe: { status: 'rejected', reason: error },
      diary: { status: 'rejected', reason: new Error('diary_save_skipped_because_recipe_save_failed') },
    };
  }
}
