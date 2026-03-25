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
  const [recipe, diary] = await Promise.allSettled([params.saveRecipe(), params.saveDiary()]);

  return {
    recipe:
      recipe.status === 'fulfilled'
        ? { status: 'fulfilled', value: recipe.value }
        : { status: 'rejected', reason: recipe.reason },
    diary:
      diary.status === 'fulfilled'
        ? { status: 'fulfilled', value: diary.value }
        : { status: 'rejected', reason: diary.reason },
  };
}

