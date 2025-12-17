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

const FoodSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as LocationState | undefined;

  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [selectedMealType] = useState<LocationState['mealType']>(state?.mealType || 'breakfast');
  const selectedDate = useMemo(
    () => state?.selectedDate || new Date().toISOString().split('T')[0],
    [state?.selectedDate]
  );

  // Единый обработчик для открытия модального окна добавления продукта
  const openAddProductSheet = (food: Food | UserCustomFood) => {
    // НЕ проверяем избранное - просто открываем модальное окно
    setSelectedFood(food as Food);
    setIsAddFoodModalOpen(true);
  };

  const handleSelect = (food: Food | UserCustomFood) => {
    // Используем единый обработчик для всех продуктов
    openAddProductSheet(food);
    addRecent(food.name);
  };

  // Обработчик для часто используемых продуктов
  const handleRecentProductClick = async (productName: string) => {
    if (!productName || !productName.trim()) {
      console.warn('Empty product name');
      return;
    }

    try {
      // Ищем продукт по имени (точное совпадение или начало строки)
      const results = await foodService.search(productName.trim(), { limit: 5 });
      
      if (results.length > 0) {
        // Нашли продукт - используем первый результат
        // НЕ проверяем избранное, НЕ перенаправляем на другие страницы
        openAddProductSheet(results[0]);
        addRecent(productName);
      } else {
        // Продукт не найден - показываем сообщение пользователю
        alert(`Продукт "${productName}" не найден в базе. Попробуйте найти его через поиск.`);
      }
    } catch (error) {
      console.error('Error searching for product:', error);
      alert('Ошибка при поиске продукта. Попробуйте еще раз.');
    }
  };

  const handleAdd = (entry: MealEntry) => {
    if (!user?.id || !selectedMealType) return;
    mealService.addMealEntry(user.id, selectedDate, selectedMealType, entry);
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
        if (stored) setRecent(JSON.parse(stored));
      } catch {
        setRecent([]);
      }
    }
  }, [user?.id]);

  const addRecent = (q: string) => {
    if (!user?.id) return;
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, 10);
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

        {recent.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Часто используемые продукты</div>
            {recent.map((item) => (
              <button
                key={item}
                onClick={() => handleRecentProductClick(item)}
                className="w-full flex items-center gap-2 text-left text-sm text-gray-800 dark:text-gray-200 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-gray-500" />
                <span>{item}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <ProductSearch
            onSelect={handleSelect}
            userId={user?.id || ''}
            value={query}
            onChangeQuery={(q) => setQuery(q)}
            hideInput
          />
        </div>
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
        }}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default FoodSearch;

