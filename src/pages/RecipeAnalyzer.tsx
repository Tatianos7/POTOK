import { useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { recipeAnalyzerService } from '../services/recipeAnalyzerService';
import { CalculatedIngredient, calcTotals } from '../utils/nutritionCalculator';
import RecipeAnalyzerResult from '../components/RecipeAnalyzerResult';
import SaveRecipeToDiarySheet from '../components/SaveRecipeToDiarySheet';
import SaveRecipeModal from '../components/SaveRecipeModal';
import { useAuth } from '../context/AuthContext';
import { recipesService } from '../services/recipesService';

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

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
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

  const handleSaveToRecipes = () => {
    if (!user?.id) {
      alert('Необходимо войти в систему');
      return;
    }
    if (items.length === 0) {
      alert('Сначала проанализируйте рецепт');
      return;
    }
    setIsSaveRecipeModalOpen(true);
  };

  const handleSaveRecipe = (recipeName: string) => {
    if (!user?.id || items.length === 0) return;

    recipesService.createRecipeFromAnalyzer({
      name: recipeName,
      image: recipeImage,
      totalCalories: totals.total.calories,
      totalProteins: totals.total.proteins,
      totalFats: totals.total.fats,
      totalCarbs: totals.total.carbs,
      ingredients: items.map((item) => ({
        name: item.name,
        quantity: item.amount || 0,
        unit: item.unit || 'g',
        grams: item.amountGrams,
        calories: item.calories,
        proteins: item.proteins,
        fats: item.fats,
        carbs: item.carbs,
      })),
      userId: user.id,
    });

    setIsSaveRecipeModalOpen(false);
    alert('Рецепт сохранен в "Мои рецепты"');
    // Можно перейти на страницу рецептов или остаться здесь
    // navigate('/nutrition/recipes');
  };

  const handleSaved = () => {
    // После сохранения уходим в дневник на выбранную дату
    navigate('/nutrition', { state: { selectedDate } });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="w-6" />
        <h1 className="text-xs font-semibold text-gray-900 uppercase">Анализатор рецепта</h1>
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-700" />
        </button>
      </header>

      <main className="px-4 pb-10 space-y-4">
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
            className="h-12 flex-1 rounded-[12px] border border-gray-800 text-gray-900 text-sm font-semibold"
          >
            Загрузить фото
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
          onSaveBoth={() => {
            // При сохранении в оба места сначала сохраняем в рецепты, потом в меню
            handleSaveToRecipes();
            setIsSaveOpen(true);
          }}
        />
      </main>

      <SaveRecipeToDiarySheet
        isOpen={isSaveOpen && !!user}
        onClose={() => setIsSaveOpen(false)}
        recipeName={name || 'Рецепт'}
        per100={per100}
        defaultMealType={defaultMealType}
        date={selectedDate}
        onSaved={handleSaved}
      />

      <SaveRecipeModal
        isOpen={isSaveRecipeModalOpen}
        onClose={() => setIsSaveRecipeModalOpen(false)}
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

