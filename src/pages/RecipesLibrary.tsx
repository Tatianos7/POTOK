import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface RecipeCard {
  id: string;
  name: string;
  caloriesPer100: number;
  image: string;
}

const SAMPLE_RECIPES: RecipeCard[] = [
  { id: 'r1', name: 'Название', caloriesPer100: 112, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r2', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r3', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r4', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r5', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r6', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r7', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r8', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r9', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r10', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r11', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
  { id: 'r12', name: 'Название', caloriesPer100: 0, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80' },
];

const RecipesLibrary = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="w-6" />
        <div className="text-center flex-1">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">Рецепты</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">МОИ РЕЦЕПТЫ   ИЗБРАННЫЕ   СБОРНИК</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      </header>

      <main className="px-4 pb-8">
        {/* Controls row mimic */}
        <div className="flex items-center justify-end gap-3 text-gray-600 dark:text-gray-300 text-sm mb-3">
          <span className="material-icons text-base">view_module</span>
          <span className="material-icons text-base">tune</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {SAMPLE_RECIPES.map((r) => (
            <div key={r.id} className="flex flex-col items-center gap-1">
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-gray-300">
                <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-center text-[11px] text-gray-800 dark:text-gray-200 leading-tight">
                <div className="font-medium">{r.name}</div>
                {r.caloriesPer100 ? <div className="text-[10px] text-gray-600">{r.caloriesPer100} ккал. 100г</div> : <div>&nbsp;</div>}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default RecipesLibrary;

