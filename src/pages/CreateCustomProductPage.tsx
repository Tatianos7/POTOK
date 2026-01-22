import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { foodService } from '../services/foodService';
import { mealService } from '../services/mealService';
import { favoritesService } from '../services/favoritesService';
import { MealEntry, Food } from '../types';
import { getFoodDisplayName } from '../utils/foodDisplayName';

const CreateCustomProductPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Получаем дату из location.state или используем сегодняшнюю
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const selectedDate = (location.state as any)?.selectedDate || getTodayDate();

  const [name, setName] = useState('');
  const [nutritionUnit, setNutritionUnit] = useState<'100g' | '100ml' | '1portion'>('100g');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [calories, setCalories] = useState('');
  const [weight, setWeight] = useState('100'); // Вес продукта по умолчанию 100г
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [addToFavorites, setAddToFavorites] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id) return;

    // Валидация обязательных полей
    if (!name.trim()) {
      alert('Введите название продукта');
      return;
    }

    const proteinValue = parseFloat(protein) || 0;
    const fatValue = parseFloat(fat) || 0;
    const carbsValue = parseFloat(carbs) || 0;
    const caloriesValue = parseFloat(calories) || 0;
    const weightValue = parseFloat(weight) || 100;

    if (proteinValue === 0 && fatValue === 0 && carbsValue === 0 && caloriesValue === 0) {
      alert('Заполните хотя бы одно поле КБЖУ');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Создаём продукт через foodService
      const customFood = await foodService.createCustomFood(user.id, {
        name: name.trim(),
        brand: null,
        calories: caloriesValue,
        protein: proteinValue,
        fat: fatValue,
        carbs: carbsValue,
        barcode: null,
        photo: null,
        category: undefined, // Категория продукта, не приёма пищи
      });

      // 2. Добавляем в избранное, если опция включена
      if (addToFavorites) {
        try {
          await favoritesService.addToFavorites(user.id, customFood.id);
          console.log('[CreateCustomProductPage] Product added to favorites:', customFood.id);
          
          // ВАЖНО: Также добавляем в recent_food_searches, так как страница "Избранное" 
          // на самом деле показывает недавно использованные продукты из этого списка
          const RECENT_STORAGE_KEY = `recent_food_searches_${user.id}`;
          const recentStored = localStorage.getItem(RECENT_STORAGE_KEY);
          const recentFoods: Array<{ foodId: string; foodName: string; weight: number; lastUsedAt: string }> = recentStored ? JSON.parse(recentStored) : [];
          
          // Формируем имя продукта с маркой для отображения (если есть)
          const displayName = getFoodDisplayName(customFood);
          
          // Проверяем, нет ли уже такого продукта
          const existingIndex = recentFoods.findIndex((rf) => rf.foodId === customFood.id);
          if (existingIndex >= 0) {
            // Обновляем существующий
            recentFoods[existingIndex] = {
              foodId: customFood.id,
              foodName: displayName,
              weight: weightValue,
              lastUsedAt: new Date().toISOString(),
            };
          } else {
            // Добавляем новый в начало списка
            recentFoods.unshift({
              foodId: customFood.id,
              foodName: displayName,
              weight: weightValue,
              lastUsedAt: new Date().toISOString(),
            });
          }
          
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentFoods));
          console.log('[CreateCustomProductPage] Product added to recent_food_searches:', customFood.id);
        } catch (error) {
          console.error('[CreateCustomProductPage] Error adding to favorites:', error);
          // Не прерываем процесс, если ошибка при добавлении в избранное
        }
      }

      // 3. Создаём MealEntry и добавляем в дневник питания
      // Рассчитываем КБЖУ на основе веса (КБЖУ указаны на 100г)
      const weightMultiplier = weightValue / 100;
      const entry: MealEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        foodId: customFood.id,
        food: customFood as Food,
        weight: weightValue,
        calories: caloriesValue * weightMultiplier,
        protein: proteinValue * weightMultiplier,
        fat: fatValue * weightMultiplier,
        carbs: carbsValue * weightMultiplier,
      };

      // Добавляем в дневник питания
      await mealService.addMealEntry(user.id, selectedDate, category, entry);

      // 4. Возвращаемся в дневник питания
      navigate('/nutrition', { replace: true });
    } catch (error) {
      console.error('Error creating custom food:', error);
      alert('Ошибка при сохранении продукта');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="px-2 sm:px-4 md:px-6 lg:px-8 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase flex-1 text-center">
            ДОБАВИТЬ СВОЙ ПРОДУКТ
          </h1>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </header>

      {/* Form */}
      <main className="px-2 sm:px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Название продукта */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Название продукта
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название продукта"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          />
        </div>

        {/* Пищевая ценность */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
            Пищевая ценность
          </label>

          {/* Единицы измерения */}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="nutritionUnit"
                value="100g"
                checked={nutritionUnit === '100g'}
                onChange={() => setNutritionUnit('100g')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">100 гр</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="nutritionUnit"
                value="100ml"
                checked={nutritionUnit === '100ml'}
                onChange={() => setNutritionUnit('100ml')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">100 мл</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="nutritionUnit"
                value="1portion"
                checked={nutritionUnit === '1portion'}
                onChange={() => setNutritionUnit('1portion')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">1 порция</span>
            </label>
          </div>

          {/* Поля БЖУ */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">белки</label>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="0"
                step="0.1"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">жиры</label>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="0"
                step="0.1"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">углеводы</label>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="0"
                step="0.1"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">калории</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="0"
                step="0.1"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            1 кал = 4,184 кДж
          </p>
        </div>

        {/* Вес продукта */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Вес продукта (г)
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="100"
            step="1"
            min="1"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Вес, на который указаны КБЖУ выше
          </p>
        </div>

        {/* Выбор приёма пищи */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
            Приём пищи
          </label>
          <div className="grid grid-cols-4 gap-3 mt-[25px]">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                value="breakfast"
                checked={category === 'breakfast'}
                onChange={() => setCategory('breakfast')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Завтрак</span>
            </label>
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                value="lunch"
                checked={category === 'lunch'}
                onChange={() => setCategory('lunch')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Обед</span>
            </label>
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                value="dinner"
                checked={category === 'dinner'}
                onChange={() => setCategory('dinner')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Ужин</span>
            </label>
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                value="snack"
                checked={category === 'snack'}
                onChange={() => setCategory('snack')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Перекус</span>
            </label>
          </div>
        </div>
      </main>

      {/* Footer Buttons */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-2 sm:px-4 md:px-6 lg:px-8 py-4 space-y-3">
        {/* Чекбокс "Добавить в избранное" */}
        <label className="flex items-center gap-3 cursor-pointer py-2">
          <input
            type="checkbox"
            checked={addToFavorites}
            onChange={(e) => setAddToFavorites(e.target.checked)}
            className="w-5 h-5 text-green-600 focus:ring-green-500 rounded border-gray-300 dark:border-gray-700 accent-green-600"
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Добавить в избранное
          </span>
        </label>
        
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="w-full py-3 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm uppercase hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
        </button>
      </footer>

      {/* Spacer для footer */}
      <div className="h-32" />
    </div>
  );
};

export default CreateCustomProductPage;

