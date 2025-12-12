import { CalculatedIngredient } from '../utils/nutritionCalculator';
import { analyzeRecipeTextDemo } from './recipeAnalyzerDemo';
import { analyzeRecipeTextReal } from './recipeAnalyzerReal';

export interface RecipeAnalyzerService {
  analyze(text: string): Promise<CalculatedIngredient[]>;
}

const useDemo = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USE_DEMO_ANALYZER !== 'false';

export const recipeAnalyzerService: RecipeAnalyzerService = {
  async analyze(text: string) {
    if (useDemo) {
      return analyzeRecipeTextDemo(text);
    }
    return analyzeRecipeTextReal(text);
  },
};

