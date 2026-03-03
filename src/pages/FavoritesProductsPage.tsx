import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, Check, Circle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Food, MealEntry } from '../types';
import { mealService } from '../services/mealService';
import { foodService } from '../services/foodService';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { getLocalDayKey } from '../utils/dayKey';

interface LocationState {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  selectedDate?: string;
  preselectName?: string;
}

interface RecentFood {
  foodId: string;
  foodName: string;
  weight: number; // в граммах
  lastUsedAt: string; // ISO дата последнего использования
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
    () => state?.selectedDate || getLocalDayKey(),
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
          let converted: RecentFood[];
          
          if (typeof parsed[0] === 'string') {
            // Старый формат - конвертируем в новый
            converted = parsed.map((name: string) => ({
              foodId: '', // Будет заполнено при следующем использовании
              foodName: name,
              weight: 100, // Дефолтное значение
              lastUsedAt: new Date().toISOString(), // Устанавливаем текущую дату
            }));
          } else {
            // Новый формат - добавляем lastUsedAt если его нет (для совместимости)
            converted = parsed.map((item: any) => ({
              ...item,
              lastUsedAt: item.lastUsedAt || new Date().toISOString(),
            }));
          }
          
          // Дедуплицируем: оставляем только последнюю запись для каждого foodId
          // Если foodId пустой, дедуплицируем по имени
          const deduplicated: RecentFood[] = [];
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          
          // Проходим в обратном порядке, чтобы оставить последние записи
          for (let i = converted.length - 1; i >= 0; i--) {
            const item = converted[i];
            if (item.foodId && item.foodId.trim()) {
              // Если есть foodId - проверяем по ID
              if (!seenIds.has(item.foodId)) {
                seenIds.add(item.foodId);
                deduplicated.unshift(item);
              }
            } else {
              // Если нет foodId - проверяем по имени
              const normalizedName = item.foodName.toLowerCase().trim();
              if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                deduplicated.unshift(item);
              }
            }
          }
          
          setRecentFoods(deduplicated);
          
          // Сохраняем дедуплицированные данные обратно в localStorage
          if (deduplicated.length !== converted.length) {
            localStorage.setItem(`recent_food_searches_${user.id}`, JSON.stringify(deduplicated));
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
    if (!recentFood || !recentFood.foodName) {
      console.warn('Invalid recent food');
      return;
    }

    try {
      let food: Food | null = null;
      
      // Если есть foodId - ищем по ID
      if (recentFood.foodId && recentFood.foodId.trim()) {
        food = foodService.getFoodById(recentFood.foodId, user?.id);
      }
      
      // Если не нашли по ID или foodId пустой - ищем по имени
      if (!food) {
        const searchResults = await foodService.search(recentFood.foodName.trim(), { limit: 5 });
        if (searchResults.length > 0) {
          // Используем первый результат (наиболее релевантный)
          food = searchResults[0];
        }
      }
      
      if (food) {
        // Нашли продукт - открываем модальное окно добавления
        // Передаем сохраненные граммы для предзаполнения
        setSelectedId(food.id);
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
    
    // Используем функциональное обновление состояния для корректной дедупликации
    setRecentFoods((currentRecentFoods) => {
      const normalizedNewName = entry.food.name.toLowerCase().trim();
      
      // Удаляем все старые записи с тем же продуктом:
      // 1. По foodId (если у нового продукта есть foodId)
      // 2. По имени (нормализованному) - всегда проверяем, чтобы удалить дубликаты даже если foodId разный
      const filtered = currentRecentFoods.filter((rf) => {
        const normalizedOldName = rf.foodName.toLowerCase().trim();
        
        // Если у нового продукта есть foodId - удаляем по foodId ИЛИ по имени
        if (entry.foodId && entry.foodId.trim()) {
          // Удаляем если совпадает foodId ИЛИ имя
          if (rf.foodId && rf.foodId.trim()) {
            // У обоих есть foodId - сравниваем по foodId
            return rf.foodId !== entry.foodId;
          } else {
            // У старого нет foodId - сравниваем по имени
            return normalizedOldName !== normalizedNewName;
          }
        } else {
          // У нового продукта нет foodId - удаляем только по имени
          return normalizedOldName !== normalizedNewName;
        }
      });
      
      // Добавляем новую запись в начало с актуальными граммами и текущей датой использования (без ограничения количества)
      // Используем getFoodDisplayName для отображения названия с маркой, если есть
      const updated = [
        {
          foodId: entry.foodId,
          foodName: getFoodDisplayName(entry.food),
          weight: entry.weight,
          lastUsedAt: new Date().toISOString(),
        },
        ...filtered,
      ];
      
      // Сохраняем в localStorage
      localStorage.setItem(`recent_food_searches_${user.id}`, JSON.stringify(updated));
      
      return updated;
    });
    
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    setDefaultWeight(undefined);
    navigate('/nutrition');
  };

  /**
   * Удаление продукта из списка часто используемых
   * Поддерживает удаление как по foodId, так и по foodName (для старых записей без foodId)
   */
  const removeRecent = (foodId: string, foodName?: string) => {
    if (!user?.id) return;
    
    setRecentFoods((currentRecentFoods) => {
      const filtered = currentRecentFoods.filter((rf) => {
        // Если передан foodId и он не пустой - удаляем по foodId
        if (foodId && foodId.trim()) {
          return rf.foodId !== foodId;
        }
        // Если foodId пустой, но передан foodName - удаляем по имени
        if (foodName) {
          return rf.foodName.toLowerCase().trim() !== foodName.toLowerCase().trim();
        }
        // Если ничего не передано - не удаляем
        return true;
      });
      localStorage.setItem(`recent_food_searches_${user.id}`, JSON.stringify(filtered));
      return filtered;
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        <header className="pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
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

      <main className="px-2 sm:px-4 md:px-6 lg:px-8 pb-24">
        <div className="divide-y divide-gray-200 dark:divide-gray-800 mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {filtered.map((recentFood) => {
            const food = foodService.getFoodById(recentFood.foodId, user?.id);
            if (!food) return null; // Пропускаем продукты, которые не найдены в базе
            
            const isActive = selectedId === recentFood.foodId;
            return (
              <div
                key={recentFood.foodId || recentFood.foodName}
                className="w-full max-w-full flex items-start px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group overflow-hidden"
              >
                <div className="mr-3 mt-0.5 flex-shrink-0">
                  {isActive ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <button
                  onClick={() => handleProductClick(recentFood)}
                  className="flex-1 min-w-0 max-w-full text-left overflow-hidden"
                >
                  <div 
                    className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words overflow-wrap-anywhere"
                    style={{ 
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {recentFood.foodName}
                  </div>
                  <div className="text-[11px] flex gap-2 flex-wrap">
                    <span className="text-green-600 dark:text-green-400 shrink-0">
                      {Math.round(recentFood.weight)} г
                    </span>
                    {food && (
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">
                        {Math.round((food.calories * recentFood.weight) / 100)} ккал
                </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(recentFood.foodId || '', recentFood.foodName);
                  }}
                  className="p-1.5 ml-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Удалить из списка"
                >
                  <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                </button>
                </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Нет часто используемых продуктов
            </div>
          )}
        </div>
      </main>
      </div>

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
