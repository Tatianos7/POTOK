import { useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { recipeAnalyzerService } from '../services/recipeAnalyzerService';
import { CalculatedIngredient, calcTotals } from '../utils/nutritionCalculator';
import RecipeAnalyzerResult from '../components/RecipeAnalyzerResult';
import SaveRecipeToDiarySheet from '../components/SaveRecipeToDiarySheet';
import SaveRecipeModal from '../components/SaveRecipeModal';
import { useAuth } from '../context/AuthContext';
import { RecipeSaveValidationError, recipesService } from '../services/recipesService';
import { recipeDiaryService } from '../services/recipeDiaryService';
import { getLocalDayKey } from '../utils/dayKey';
import { runCombinedRecipeSave } from '../utils/recipeCombinedSave';

const placeholderIngredients =
  'Пример: 250 г говядина постная, 1–2 морковки, 1 луковица, 2 дольки чеснока, полтора литра молока, 400 г картофеля';

const RecipeAnalyzer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [items, setItems] = useState<CalculatedIngredient[]>([]);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isSaveRecipeModalOpen, setIsSaveRecipeModalOpen] = useState(false);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'recipe' | 'combined' | null>(null);
  const [pendingCombinedRecipeName, setPendingCombinedRecipeName] = useState<string | null>(null);

  const totals = calcTotals(items);
  const per100 = useMemo(
    () => ({
      calories: totals.per100.calories || 0,
      proteins: totals.per100.proteins || 0,
      fats: totals.per100.fats || 0,
      carbs: totals.per100.carbs || 0,
    }),
    [totals.per100]
  );
  const unresolvedIngredientNames = useMemo(
    () =>
      items
        .filter((item) => item.resolution_status !== 'resolved' || !item.canonical_food_id)
        .map((item) => item.name)
        .filter(Boolean),
    [items]
  );

  const today = useMemo(() => getLocalDayKey(), []);
  const selectedDate = (location.state as any)?.selectedDate || today;
  const defaultMealType = (location.state as any)?.mealType as
    | 'breakfast'
    | 'lunch'
    | 'dinner'
    | 'snack'
    | undefined;

  const handleAnalyze = async () => {
    if (!ingredientsText.trim()) return;
    const result = await recipeAnalyzerService.analyze(ingredientsText);
    setItems(result);
  };

  const handlePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRecipeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const buildAnalyzerIngredients = () =>
    items.map((item) => ({
      name: item.name,
      quantity: item.amount || 0,
      unit: item.unit || 'g',
      grams: item.amountGrams,
      calories: item.calories,
      proteins: item.proteins,
      fats: item.fats,
      carbs: item.carbs,
      display_amount: item.displayAmount ?? item.amountText ?? null,
      display_unit: item.displayUnit ?? null,
    }));

  const handleSaveToRecipes = () => {
    if (!user?.id) {
      alert('Необходимо войти в систему');
      return;
    }
    if (items.length === 0) {
      alert('Сначала проанализируйте рецепт');
      return;
    }
    if (unresolvedIngredientNames.length > 0) {
      alert(
        `Нельзя сохранить рецепт: не все ингредиенты подтверждены каталогом.\nПроблемные ингредиенты: ${unresolvedIngredientNames.join(', ')}`
      );
      return;
    }
    setSaveMode('recipe');
    setIsSaveRecipeModalOpen(true);
  };

  const handleSaveBoth = () => {
    if (!user?.id) {
      alert('Необходимо войти в систему');
      return;
    }
    if (items.length === 0) {
      alert('Сначала проанализируйте рецепт');
      return;
    }
    if (unresolvedIngredientNames.length > 0) {
      alert(
        `Нельзя сохранить рецепт в "Мои рецепты": не все ингредиенты подтверждены каталогом.\nПроблемные ингредиенты: ${unresolvedIngredientNames.join(', ')}`
      );
      return;
    }
    setSaveMode('combined');
    setIsSaveRecipeModalOpen(true);
  };

  const handleSaveRecipe = async (recipeName: string) => {
    if (!user?.id || items.length === 0) return;

    if (saveMode === 'combined') {
      setPendingCombinedRecipeName(recipeName);
      setIsSaveRecipeModalOpen(false);
      setIsSaveOpen(true);
      return;
    }

    try {
      await recipesService.createRecipeFromAnalyzer({
        name: recipeName,
        image: recipeImage,
        totalCalories: totals.total.calories,
        totalProteins: totals.total.proteins,
        totalFats: totals.total.fats,
        totalCarbs: totals.total.carbs,
        ingredients: buildAnalyzerIngredients(),
        userId: user.id,
      });

      setIsSaveRecipeModalOpen(false);
      setSaveMode(null);
      alert('Рецепт сохранен в "Мои рецепты"');
    } catch (error) {
      console.error('[RecipeAnalyzer] Error saving recipe:', error);
      if (error instanceof RecipeSaveValidationError && error.unresolvedIngredients.length > 0) {
        alert(
          `Не удалось сохранить рецепт: не все ингредиенты подтверждены каталогом.\nПроблемные ингредиенты: ${error.unresolvedIngredients.join(', ')}`
        );
      } else {
        alert('Не удалось сохранить рецепт в "Мои рецепты"');
      }
      throw error;
    }
  };

  const handleCombinedSave = async (params: {
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    weight: number;
    per100: { calories: number; proteins: number; fats: number; carbs: number };
    totals: { calories: number; proteins: number; fats: number; carbs: number };
  }) => {
    if (!user?.id || items.length === 0) {
      throw new Error('missing_combined_save_context');
    }

    const recipeName = pendingCombinedRecipeName?.trim() || name.trim() || 'Рецепт';
    const result = await runCombinedRecipeSave({
      saveRecipe: () =>
        recipesService.createRecipeFromAnalyzer({
          name: recipeName,
          image: recipeImage,
          totalCalories: totals.total.calories,
          totalProteins: totals.total.proteins,
          totalFats: totals.total.fats,
          totalCarbs: totals.total.carbs,
          ingredients: buildAnalyzerIngredients(),
          userId: user.id,
        }),
      saveDiary: () =>
        recipeDiaryService.saveRecipeEntry({
          userId: user.id,
          date: selectedDate,
          mealType: params.mealType,
          recipeName,
          weight: params.weight,
          per100: params.per100,
          totals: params.totals,
        }),
    });

    setPendingCombinedRecipeName(null);
    setSaveMode(null);

    if (result.recipe.status === 'fulfilled' && result.diary.status === 'fulfilled') {
      alert('Рецепт сохранён в "Мои рецепты" и добавлен в меню');
      return;
    }

    if (result.recipe.status === 'fulfilled' && result.diary.status === 'rejected') {
      console.error('[RecipeAnalyzer] Combined save partial success: diary failed', result.diary.reason);
      alert('Рецепт сохранён в "Мои рецепты", но не удалось добавить его в меню');
      return { closeSheet: true, triggerOnSaved: false };
    }

    if (result.recipe.status === 'rejected' && result.diary.status === 'fulfilled') {
      console.error('[RecipeAnalyzer] Combined save partial success: recipe failed', result.recipe.reason);
      alert('Рецепт добавлен в меню, но не удалось сохранить его в "Мои рецепты"');
      return { closeSheet: true, triggerOnSaved: true };
    }

    console.error('[RecipeAnalyzer] Combined save failed', {
      recipeError: result.recipe.reason,
      diaryError: result.diary.reason,
    });
    alert('Не удалось сохранить рецепт ни в меню, ни в "Мои рецепты"');
    return { closeSheet: false, triggerOnSaved: false };
  };

  const handleSaved = () => {
    // После сохранения уходим в дневник на выбранную дату
    navigate('/nutrition', { state: { selectedDate } });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="px-2 sm:px-4 md:px-6 lg:px-8 pt-4 pb-3 flex items-center justify-between">
        <div className="w-6" />
        <h1 className="text-xs font-semibold text-gray-900 uppercase">Анализатор рецепта</h1>
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-700" />
        </button>
      </header>

      <main className="px-2 sm:px-4 md:px-6 lg:px-8 pb-10 space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-gray-700">Название рецепта</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название рецепта"
            className="w-full h-12 rounded-[12px] border border-gray-400 px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-700">Ингредиенты рецепта</label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder={placeholderIngredients}
            className="w-full min-h-[110px] rounded-[12px] border border-gray-400 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-[15px]">
          <button
            onClick={handlePhoto}
            className={`h-12 flex-1 rounded-[12px] border text-sm font-semibold transition-colors ${
              recipeImage
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-800 text-gray-900'
            }`}
          >
            {recipeImage ? 'Фото загружено' : 'Загрузить фото'}
          </button>
          <button
            onClick={handleAnalyze}
            className="h-12 flex-1 rounded-[12px] bg-black text-white text-sm font-semibold"
          >
            Анализировать
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />

        <RecipeAnalyzerResult
          items={items}
          totals={totals}
          onSaveMenu={() => setIsSaveOpen(true)}
          onSaveRecipes={handleSaveToRecipes}
          onSaveBoth={handleSaveBoth}
          unresolvedIngredientNames={unresolvedIngredientNames}
        />
      </main>

      <SaveRecipeToDiarySheet
        isOpen={isSaveOpen && !!user}
        onClose={() => {
          setIsSaveOpen(false);
          if (saveMode === 'combined') {
            setPendingCombinedRecipeName(null);
            setSaveMode(null);
          }
        }}
        recipeName={name || 'Рецепт'}
        per100={per100}
        defaultMealType={defaultMealType}
        date={selectedDate}
        onSaved={handleSaved}
        onSaveOverride={saveMode === 'combined' ? handleCombinedSave : undefined}
      />

      <SaveRecipeModal
        isOpen={isSaveRecipeModalOpen}
        onClose={() => {
          setIsSaveRecipeModalOpen(false);
          if (saveMode === 'combined') {
            setPendingCombinedRecipeName(null);
            setSaveMode(null);
          }
        }}
        recipeName={name || 'Рецепт'}
        recipeImage={recipeImage}
        totalCalories={totals.total.calories}
        totalProteins={totals.total.proteins}
        totalFats={totals.total.fats}
        totalCarbs={totals.total.carbs}
        onSave={handleSaveRecipe}
      />
    </div>
  );
};

export default RecipeAnalyzer;
