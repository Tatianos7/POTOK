import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { recipeAnalyzerService } from '../services/recipeAnalyzerService';
import { CalculatedIngredient, calcTotals } from '../utils/nutritionCalculator';
import RecipeAnalyzerResult from '../components/RecipeAnalyzerResult';

const placeholderIngredients =
  'Пример: 250 г говядина постная, 1–2 морковки, 1 луковица, 2 дольки чеснока, полтора литра молока, 400 г картофеля';

const RecipeAnalyzer = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [items, setItems] = useState<CalculatedIngredient[]>([]);

  const totals = calcTotals(items);

  const handleAnalyze = async () => {
    if (!ingredientsText.trim()) return;
    const result = await recipeAnalyzerService.analyze(ingredientsText);
    setItems(result);
  };

  const handlePhoto = () => {
    alert('Фото-анализ будет доступен после подключения локального AI.');
  };

  const saveStub = () => {
    alert('Будет доступно после подключения основной базы.');
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

        <RecipeAnalyzerResult
          items={items}
          totals={totals}
          onSaveMenu={saveStub}
          onSaveRecipes={saveStub}
          onSaveBoth={saveStub}
        />
      </main>
    </div>
  );
};

export default RecipeAnalyzer;

