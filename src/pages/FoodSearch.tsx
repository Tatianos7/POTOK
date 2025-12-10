import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, Search as SearchIcon, ArrowRight, ScanLine } from 'lucide-react';
import ProductSearch from '../components/ProductSearch';
import BarcodeScanner from '../components/BarcodeScanner';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import { Food, MealEntry, UserCustomFood } from '../types';
import { useAuth } from '../context/AuthContext';
import { mealService } from '../services/mealService';

interface LocationState {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  selectedDate?: string;
}

const RECENTS_KEY = (userId: string) => `recent_food_searches_${userId}`;

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

  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(RECENTS_KEY(user.id));
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
    localStorage.setItem(RECENTS_KEY(user.id), JSON.stringify(updated));
  };

  const handleSelect = (food: Food | UserCustomFood) => {
    setSelectedFood(food);
    setIsAddFoodModalOpen(true);
    addRecent(food.name);
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
        <div className="flex text-[11px] uppercase text-gray-600 dark:text-gray-300 gap-4">
          <button className="pb-2 border-b-2 border-transparent">Анализатор рецептов</button>
          <button className="pb-2 border-b-2 border-transparent">Рецепты</button>
          <button className="pb-2 border-b-2 border-black dark:border-white font-semibold">
            Избранное
          </button>
        </div>
      </header>

      {/* Search */}
      <main className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2 border border-gray-300 rounded-full px-3 py-2 bg-white dark:bg-gray-900">
          <SearchIcon className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск еды"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white"
          />
          <button
            onClick={() => setQuery(query.trim())}
            className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Recent searches */}
        {recent.length > 0 && (
          <div className="space-y-2">
            {recent.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setQuery(item);
                  addRecent(item);
                }}
                className="w-full flex items-center gap-2 text-left text-sm text-gray-800 dark:text-gray-200 py-2"
              >
                <ArrowRight className="w-4 h-4 text-gray-500" />
                <span>{item}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        <div className="space-y-2">
          <ProductSearch onSelect={handleSelect} userId={user?.id || ''} />
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

