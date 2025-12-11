import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, Check, ChevronRight, Circle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { favoritesService } from '../services/favoritesService';
import { Food, MealEntry } from '../types';
import { mealService } from '../services/mealService';
import AddFoodToMealModal from '../components/AddFoodToMealModal';

interface LocationState {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  selectedDate?: string;
  preselectName?: string;
}

const FavoritesProductsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as LocationState | undefined;

  const [query, setQuery] = useState(state?.preselectName || '');
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);

  const selectedDate = useMemo(
    () => state?.selectedDate || new Date().toISOString().split('T')[0],
    [state?.selectedDate]
  );
  const mealType = state?.mealType || 'breakfast';

  useEffect(() => {
    if (!user?.id) return;
    const items = favoritesService.getFavoriteFoods(user.id);
    setFavorites(items);

    if (state?.preselectName) {
      const found = items.find((f) => f.name.toLowerCase().includes(state.preselectName!.toLowerCase()));
      if (found) {
        setSelectedId(found.id);
        setSelectedFood(found);
      }
    }
  }, [user?.id, state?.preselectName]);

  const filtered = favorites.filter((f) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.name_original || '').toLowerCase().includes(q) ||
      (f.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  });

  const handleSave = () => {
    if (!selectedFood || !user?.id) return;
    setIsAddFoodModalOpen(true);
  };

  const handleAdd = (entry: MealEntry) => {
    if (!user?.id || !mealType) return;
    mealService.addMealEntry(user.id, selectedDate, mealType, entry);
    favoritesService.incrementFavoriteUsage(user.id, entry.foodId);
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    navigate('/nutrition');
  };

  const gramsLabel = () => '100 г';

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

        <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-700 rounded-full px-3 py-2 bg-white dark:bg-gray-900">
          <span className="text-gray-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white"
          />
          <button
            onClick={() => setQuery(query.trim())}
            className="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </header>

      <main className="px-2 pb-24">
        <div className="divide-y divide-gray-200 dark:divide-gray-800 mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {filtered.map((food) => {
            const isActive = selectedId === food.id;
            return (
              <button
                key={food.id}
                className="w-full flex items-center px-3 py-3 text-left"
                onClick={() => {
                  setSelectedId(food.id);
                  setSelectedFood(food);
                }}
              >
                <div className="mr-3">
                  {isActive ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{food.name}</div>
                  <div className="text-[11px] flex gap-2">
                    <span className="text-green-600 dark:text-green-400">{gramsLabel()}</span>
                    <span className="text-gray-500 dark:text-gray-400">{`${Math.round(food.calories)} ккал`}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">Нет избранных продуктов</div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6">
        <button
          onClick={handleSave}
          disabled={!selectedFood}
          className="w-full h-12 rounded-[12px] bg-black text-white font-semibold text-sm disabled:opacity-50"
        >
          СОХРАНИТЬ
        </button>
      </div>

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

export default FavoritesProductsPage;
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { favoritesService } from '../services/favoritesService';
import { Food } from '../types';

const FavoritesProductsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || '';
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<(Food & { usage: number })[]>([]);

  useEffect(() => {
    if (userId) {
      setFavorites(favoritesService.resolveFavorites(userId));
    }
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return favorites;
    return favorites.filter((f) => f.name.toLowerCase().includes(q) || f.name_original?.toLowerCase().includes(q));
  }, [favorites, query]);

  const handleSave = () => {
    if (selectedId && userId) {
      favoritesService.incrementFavoriteUsage(userId, selectedId);
    }
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900 text-center flex-1">Избранное</h1>
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="flex items-center gap-2 border border-gray-300 rounded-full px-3 py-2 bg-white">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900"
          />
          <button
            onClick={() => setQuery(query.trim())}
            className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </header>

      <main className="px-0">
        <div className="divide-y divide-gray-200">
          {filtered.map((item) => {
            const grams = item.serving_size || 100;
            const kcal = Math.round((item.calories || 0) * (grams / 100));
            const isActive = selectedId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="w-full flex items-center px-4 py-4 bg-white"
              >
                <span
                  className={`mr-4 w-5 h-5 rounded-full border ${
                    isActive ? 'border-green-600 bg-green-600' : 'border-gray-400'
                  } flex items-center justify-center`}
                >
                  {isActive && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                  <div className="text-[11px] flex gap-2">
                    <span className="text-green-600">{grams} г</span>
                    <span className="text-gray-500">{kcal} ккал</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-sm">Избранных продуктов нет</div>
          )}
        </div>
      </main>

      <div className="px-4 py-4">
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold uppercase"
          disabled={!selectedId}
        >
          СОХРАНИТЬ
        </button>
      </div>
    </div>
  );
};

export default FavoritesProductsPage;

