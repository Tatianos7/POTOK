import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, Check, Circle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Food, MealEntry } from '../types';
import { mealService } from '../services/mealService';
import { foodService, isSuspiciousAllZeroCatalogFood } from '../services/foodService';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { saveDiaryEntryForReturnToDiary } from '../utils/diaryAddNavigation';
import { getLocalDayKey } from '../utils/dayKey';
import { resolveFavoriteFoodForAdd } from '../utils/favoritesFoodSelection';
import FoodSourceBadge from '../components/FoodSourceBadge';

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
      const result = await resolveFavoriteFoodForAdd(recentFood, user?.id, {
        getFoodById: (foodId, userId) => foodService.getFoodById(foodId, userId),
        search: (query, options) => foodService.search(query, options),
        hydrateFoodForDiarySelection: (food, userId) => foodService.hydrateFoodForDiarySelection(food, userId),
        isSuspiciousFood: (food) => isSuspiciousAllZeroCatalogFood(food),
      });

      if (result.kind === 'resolved') {
        setSelectedId(result.food.id);
        setSelectedFood(result.food);
        setDefaultWeight(recentFood.weight);
        setIsAddFoodModalOpen(true);
      } else if (result.kind === 'blocked_suspicious_zero') {
        alert(`Продукт "${recentFood.foodName}" временно скрыт: в каталоге повреждены КБЖУ.`);
      } else {
        alert(`Продукт "${recentFood.foodName}" не найден в базе. Попробуйте найти его через поиск.`);
      }
    } catch (error) {
      console.error('Error searching for product:', error);
      alert('Ошибка при поиске продукта. Попробуйте еще раз.');
    }
  };

  const handleAdd = async (entry: MealEntry) => {
    if (!user?.id || !mealType) return;
    const isValidUUID = (value?: string | null): boolean =>
      Boolean(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));

    const canonicalFoodId =
      (isValidUUID(entry.canonicalFoodId) ? entry.canonicalFoodId : null) ||
      (isValidUUID(entry.food?.canonical_food_id ?? null) ? entry.food?.canonical_food_id ?? null : null) ||
      (isValidUUID(entry.foodId) ? entry.foodId : null) ||
      (isValidUUID(entry.food?.id ?? null) ? entry.food.id : null);

    const normalizedEntry: MealEntry = {
      ...entry,
      canonicalFoodId,
    };

    if (!canonicalFoodId) {
      console.warn('[FavoritesProductsPage] Cannot save diary entry without resolved canonical food id');
      return;
    }

    let diaryNavigationState: { selectedDate: string };
    try {
      diaryNavigationState = await saveDiaryEntryForReturnToDiary({
        addMealEntry: (userId, date, targetMealType, mealEntry) =>
          mealService.addMealEntry(userId, date, targetMealType, mealEntry),
        userId: user.id,
        selectedDate,
        mealType,
        entry: normalizedEntry,
      });
    } catch (error) {
      console.error('[FavoritesProductsPage] Failed to save diary entry:', error);
      alert('Не удалось сохранить продукт. Проверьте соединение и попробуйте снова.');
      return;
    }

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
          foodId: normalizedEntry.foodId,
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
    navigate('/nutrition', { state: diaryNavigationState });
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
                    className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words overflow-wrap-anywhere flex items-start gap-1.5"
                    style={{ 
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    <span className="min-w-0">{recentFood.foodName}</span>
                    {food && <FoodSourceBadge food={food} className="mt-0.5 flex-shrink-0" />}
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
