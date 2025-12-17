import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, Check, ChevronRight, Circle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Food, MealEntry } from '../types';
import { mealService } from '../services/mealService';
import { foodService } from '../services/foodService';
import AddFoodToMealModal from '../components/AddFoodToMealModal';

interface LocationState {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  selectedDate?: string;
  preselectName?: string;
}

interface RecentFood {
  foodId: string;
  foodName: string;
  weight: number; // в граммах
}

const FavoritesProductsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as LocationState | undefined;

  const [query, setQuery] = useState(state?.preselectName || '');
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [defaultWeight, setDefaultWeight] = useState<number | undefined>(undefined);

  const selectedDate = useMemo(
    () => state?.selectedDate || new Date().toISOString().split('T')[0],
    [state?.selectedDate]
  );
  const mealType = state?.mealType || 'breakfast';

  // Загружаем часто используемые продукты с граммами
  useEffect(() => {
    if (!user?.id) return;
    
    try {
      const stored = localStorage.getItem(`recent_food_searches_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Поддержка старого формата (массив строк) и нового формата (массив RecentFood)
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            // Старый формат - конвертируем в новый
            const converted: RecentFood[] = parsed.map((name: string) => ({
              foodId: '', // Будет заполнено при следующем использовании
              foodName: name,
              weight: 100, // Дефолтное значение
            }));
            setRecentFoods(converted);
          } else {
            // Новый формат
            setRecentFoods(parsed);
          }
        } else {
          setRecentFoods([]);
        }
      } else {
        setRecentFoods([]);
      }
    } catch {
      setRecentFoods([]);
    }
  }, [user?.id]);

  // Предвыбор продукта по имени, если передан preselectName
  useEffect(() => {
    if (!state?.preselectName || !user?.id || recentFoods.length === 0) return;
    
    const found = recentFoods.find((rf) => 
      rf.foodName.toLowerCase().includes(state.preselectName!.toLowerCase())
    );
    if (found && found.foodId) {
      const food = foodService.getFoodById(found.foodId, user.id);
      if (food) {
        setSelectedId(found.foodId);
        setSelectedFood(food);
        setDefaultWeight(found.weight);
      }
    }
  }, [state?.preselectName, user?.id, recentFoods]);

  // Фильтруем часто используемые продукты по запросу
  const filtered = recentFoods.filter((rf) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return rf.foodName.toLowerCase().includes(q);
  });

  /**
   * Обработчик клика по часто используемому продукту
   * Открывает модальное окно с предзаполненными граммами
   */
  const handleProductClick = async (recentFood: RecentFood) => {
    if (!recentFood || !recentFood.foodId) {
      console.warn('Invalid recent food');
      return;
    }

    try {
      // Ищем продукт по ID в базе данных
      const food = foodService.getFoodById(recentFood.foodId, user?.id);
      
      if (food) {
        // Нашли продукт - открываем модальное окно добавления
        // Передаем сохраненные граммы для предзаполнения
        setSelectedId(recentFood.foodId);
        setSelectedFood(food);
        setDefaultWeight(recentFood.weight);
        setIsAddFoodModalOpen(true);
      } else {
        // Продукт не найден - показываем сообщение пользователю
        alert(`Продукт "${recentFood.foodName}" не найден в базе. Попробуйте найти его через поиск.`);
      }
    } catch (error) {
      console.error('Error searching for product:', error);
      alert('Ошибка при поиске продукта. Попробуйте еще раз.');
    }
  };

  const handleAdd = (entry: MealEntry) => {
    if (!user?.id || !mealType) return;
    mealService.addMealEntry(user.id, selectedDate, mealType, entry);
    
    // Обновляем часто используемые продукты с новыми граммами
    const updatedRecentFoods = recentFoods.map((rf) => 
      rf.foodId === entry.foodId 
        ? { ...rf, weight: entry.weight }
        : rf
    );
    
    // Если продукта еще нет в списке, добавляем его
    if (!updatedRecentFoods.find((rf) => rf.foodId === entry.foodId)) {
      updatedRecentFoods.unshift({
        foodId: entry.foodId,
        foodName: entry.food.name,
        weight: entry.weight,
      });
    }
    
    // Ограничиваем до 10 элементов и сохраняем
    const limited = updatedRecentFoods.slice(0, 10);
    setRecentFoods(limited);
    localStorage.setItem(`recent_food_searches_${user.id}`, JSON.stringify(limited));
    
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    setDefaultWeight(undefined);
    navigate('/nutrition');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="w-6" />
          <h1 className="text-xs font-semibold text-center text-gray-800 dark:text-white uppercase">Избранное</h1>
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div
          className="flex items-center bg-white dark:bg-gray-900 pl-3 pr-0 w-full"
          style={{ border: '1px solid #c9d0d9', borderRadius: '10px', height: '50px' }}
        >
          <span className="text-gray-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск избранного"
            className="flex-1 bg-transparent outline-none text-base text-gray-900 dark:text-white ml-2"
            style={{ height: '100%' }}
          />
          <button
            onClick={() => setQuery(query.trim())}
            className="flex items-center justify-center"
            style={{
              height: '100%',
              width: '50px',
              borderRadius: '10px',
              border: '1px solid #c9d0d9',
              marginLeft: 'auto',
              marginRight: 0,
            }}
          >
            <ArrowRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </header>

      <main className="px-2 pb-24">
        <div className="divide-y divide-gray-200 dark:divide-gray-800 mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {filtered.map((recentFood) => {
            const food = foodService.getFoodById(recentFood.foodId, user?.id);
            if (!food) return null; // Пропускаем продукты, которые не найдены в базе
            
            const isActive = selectedId === recentFood.foodId;
            return (
              <button
                key={recentFood.foodId || recentFood.foodName}
                className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleProductClick(recentFood)}
              >
                <div className="mr-3">
                  {isActive ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {recentFood.foodName}
                  </div>
                  <div className="text-[11px] flex gap-2">
                    <span className="text-green-600 dark:text-green-400">
                      {Math.round(recentFood.weight)} г
                    </span>
                    {food && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {Math.round((food.calories * recentFood.weight) / 100)} ккал
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Нет часто используемых продуктов
            </div>
          )}
        </div>
      </main>

      <AddFoodToMealModal
        food={selectedFood}
        isOpen={isAddFoodModalOpen}
        onClose={() => {
          setIsAddFoodModalOpen(false);
          setSelectedFood(null);
          setDefaultWeight(undefined);
        }}
        onAdd={handleAdd}
        defaultWeight={defaultWeight}
      />
    </div>
  );
};

export default FavoritesProductsPage;

