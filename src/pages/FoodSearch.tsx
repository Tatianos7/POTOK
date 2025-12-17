import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, ScanLine, ArrowRight } from 'lucide-react';
import ProductSearch from '../components/ProductSearch';
import BarcodeScanner from '../components/BarcodeScanner';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import { Food, MealEntry, UserCustomFood } from '../types';
import { useAuth } from '../context/AuthContext';
import { mealService } from '../services/mealService';
import { foodService } from '../services/foodService';

interface LocationState {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  selectedDate?: string;
}

interface RecentFood {
  foodId: string;
  foodName: string;
  weight: number; // в граммах
}

const FoodSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as LocationState | undefined;

  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [defaultWeight, setDefaultWeight] = useState<number | undefined>(undefined);
  const [selectedMealType] = useState<LocationState['mealType']>(state?.mealType || 'breakfast');
  const selectedDate = useMemo(
    () => state?.selectedDate || new Date().toISOString().split('T')[0],
    [state?.selectedDate]
  );

  /**
   * Единый обработчик для открытия модального окна добавления продукта
   * Используется для:
   * - результатов поиска
   * - часто используемых продуктов
   * - продуктов из сканера штрих-кода
   * 
   * ВАЖНО: НЕ проверяет избранное, НЕ перенаправляет на другие страницы
   */
  const openAddProductSheet = (food: Food | UserCustomFood) => {
    setSelectedFood(food as Food);
    setIsAddFoodModalOpen(true);
  };

  /**
   * Обработчик выбора продукта из результатов поиска
   * Использует единый обработчик для всех продуктов
   */
  const handleSelect = (food: Food | UserCustomFood) => {
    openAddProductSheet(food);
    // Не добавляем в recent здесь, т.к. граммы еще не известны
    // Добавим в handleAdd после добавления продукта с граммами
  };

  /**
   * Обработчик клика по часто используемому продукту
   * 
   * ПРАВИЛЬНОЕ ПОВЕДЕНИЕ:
   * - Находит продукт по foodId в базе данных
   * - Открывает модальное окно добавления продукта с предзаполненными граммами
   * - НЕ проверяет избранное
   * - НЕ перенаправляет на страницу "Избранное"
   * - НЕ меняет вкладки
   */
  const handleRecentProductClick = async (recentFood: RecentFood) => {
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
    if (!user?.id || !selectedMealType) return;
    mealService.addMealEntry(user.id, selectedDate, selectedMealType, entry);
    
    // Сохраняем продукт в часто используемые с граммами
    addRecent({
      foodId: entry.foodId,
      foodName: entry.food.name,
      weight: entry.weight,
    });
    
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    navigate('/nutrition');
  };

  const handleVoice = () => {
    if (user?.hasPremium) {
      alert('Голосовой ввод: пока заглушка. Скоро добавим распознавание речи.');
    } else {
      alert('Голосовой поиск доступен в премиум. Оформите подписку, чтобы использовать.');
    }
  };

  const title = useMemo(() => {
    switch (selectedMealType) {
      case 'breakfast':
        return 'ЗАВТРАК';
      case 'lunch':
        return 'ОБЕД';
      case 'dinner':
        return 'УЖИН';
      case 'snack':
      default:
        return 'ПЕРЕКУС';
    }
  }, [selectedMealType]);

  useEffect(() => {
    if (user?.id) {
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
              setRecent(converted);
            } else {
              // Новый формат
              setRecent(parsed);
            }
          } else {
            setRecent([]);
          }
        } else {
          setRecent([]);
        }
      } catch {
        setRecent([]);
      }
    }
  }, [user?.id]);

  const addRecent = (recentFood: RecentFood) => {
    if (!user?.id || !recentFood.foodId || !recentFood.foodName) return;
    
    // Удаляем старую запись с тем же foodId, если есть
    const updated = [
      recentFood,
      ...recent.filter((r) => r.foodId !== recentFood.foodId)
    ].slice(0, 10); // Ограничиваем до 10 элементов
    
    setRecent(updated);
    localStorage.setItem(`recent_food_searches_${user.id}`, JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">{title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{selectedDate}</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Tabs mock */}
        <div className="flex justify-center text-[11px] uppercase text-gray-600 dark:text-gray-300 gap-4 mt-4">
          <button
            className="pb-2 border-b-2 border-transparent"
            onClick={() => navigate('/nutrition/recipe-analyzer', { state: { mealType: selectedMealType, selectedDate } })}
          >
            Анализатор рецептов
          </button>
          <button
            className="pb-2 border-b-2 border-transparent"
            onClick={() => navigate('/nutrition/recipes', { state: { mealType: selectedMealType, selectedDate } })}
          >
            Рецепты
          </button>
          <button
            className="pb-2 border-b-2 border-transparent text-gray-800 dark:text-gray-200 font-normal"
            onClick={() => navigate('/nutrition/favorites', { state: { mealType: selectedMealType, selectedDate } })}
          >
            Избранное
          </button>
        </div>
      </header>

      {/* Search results with custom bar + recent */}
      <main className="px-4 py-4 space-y-4">
        <div
          className="flex items-center bg-white dark:bg-gray-900 pl-3 pr-0 w-full"
          style={{ border: '1px solid #c9d0d9', borderRadius: '10px', height: '50px' }}
        >
          <span className="text-gray-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск еды"
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

        {/* Взаимоисключающий рендер: либо часто используемые, либо результаты поиска */}
        {(() => {
          const hasQuery = query.trim().length > 0;
          
          // Если поле поиска ПУСТОЕ - показываем ТОЛЬКО часто используемые продукты
          // ProductSearch НЕ рендерится вообще
          if (!hasQuery) {
            // Рендерим часто используемые продукты только если они есть
            if (recent.length > 0) {
              return (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Часто используемые продукты</div>
                  {recent.map((item, index) => (
                    <button
                      key={item.foodId || `${item.foodName}_${index}`}
                      onClick={() => handleRecentProductClick(item)}
                      className="w-full flex items-center justify-between text-left text-sm text-gray-800 dark:text-gray-200 py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="truncate">{item.foodName}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {Math.round(item.weight)} г
                      </span>
                    </button>
                  ))}
                </div>
              );
            }
            // Если нет часто используемых продуктов и запрос пустой - ничего не показываем
            return null;
          }
          
          // Если пользователь НАЧАЛ ВВОД (hasQuery === true):
          // - часто используемые продукты НЕ рендерятся
          // - показываем ТОЛЬКО результаты поиска
          return (
            <ProductSearch
              onSelect={handleSelect}
              userId={user?.id || ''}
              value={query}
              onChangeQuery={(q) => setQuery(q)}
              hideInput
            />
          );
        })()}
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsBarcodeModalOpen(true)}
          className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ScanLine className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={handleVoice}
          className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Mic className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
      <div className="h-16" />

      {/* Barcode modal */}
      {isBarcodeModalOpen && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setIsBarcodeModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <BarcodeScanner
              onSelect={(food) => {
                handleSelect(food);
                setIsBarcodeModalOpen(false);
              }}
              userId={user.id}
              onClose={() => setIsBarcodeModalOpen(false)}
              onOpenCamera={() => setIsBarcodeModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Add food modal */}
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

export default FoodSearch;

