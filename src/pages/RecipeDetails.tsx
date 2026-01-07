import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { X, Pencil, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recipesService } from '../services/recipesService';
import { Recipe } from '../types/recipe';
import MealTypeSelectorModal from '../components/MealTypeSelectorModal';
import { recipeDiaryService } from '../services/recipeDiaryService';
import { recipeNotesService } from '../services/recipeNotesService';
import RecipeNoteModal from '../components/RecipeNoteModal';

const RecipeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [weight, setWeight] = useState<number>(100);
  const [isMealTypeModalOpen, setIsMealTypeModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [recipeNote, setRecipeNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user?.id) return;

    const loadedRecipe = recipesService.getRecipeById(id, user.id);
    if (loadedRecipe) {
      setRecipe(loadedRecipe);
      // Загружаем заметку для рецепта
      recipeNotesService.getNoteByRecipeId(user.id, id).then((note) => {
        setRecipeNote(note);
      }).catch((error) => {
        console.error('[RecipeDetails] Error loading note:', error);
      });
    } else {
      // Если рецепт не найден, возвращаемся назад
      navigate(-1);
    }
  }, [id, user?.id, navigate]);

  // Вычисляем КБЖУ на 100г из сохраненных данных
  const macrosPer100 = useMemo(() => {
    if (!recipe) return { calories: 0, proteins: 0, fats: 0, carbs: 0 };

    // Если есть totalCalories, значит это рецепт из анализатора
    // Нужно вычислить на 100г из totalCalories и общего веса
    if (recipe.totalCalories && recipe.ingredients && recipe.ingredients.length > 0) {
      // Вычисляем общий вес из ингредиентов
      const totalWeight = recipe.ingredients.reduce((sum, ing) => sum + ing.grams, 0);
      if (totalWeight > 0) {
        return {
          calories: (recipe.totalCalories * 100) / totalWeight,
          proteins: (recipe.totalProteins! * 100) / totalWeight,
          fats: (recipe.totalFats! * 100) / totalWeight,
          carbs: (recipe.totalCarbs! * 100) / totalWeight,
        };
      }
    }

    // Если есть caloriesPer100, используем их
    if (recipe.caloriesPer100) {
      return {
        calories: recipe.caloriesPer100,
        proteins: recipe.proteinsPer100 || 0,
        fats: recipe.fatsPer100 || 0,
        carbs: recipe.carbsPer100 || 0,
      };
    }

    return { calories: 0, proteins: 0, fats: 0, carbs: 0 };
  }, [recipe]);

  // Пересчитываем КБЖУ при изменении веса
  const calculatedMacros = useMemo(() => {
    const multiplier = weight / 100;
    return {
      calories: Math.round(macrosPer100.calories * multiplier),
      proteins: Math.round(macrosPer100.proteins * multiplier * 10) / 10,
      fats: Math.round(macrosPer100.fats * multiplier * 10) / 10,
      carbs: Math.round(macrosPer100.carbs * multiplier * 10) / 10,
    };
  }, [weight, macrosPer100]);

  const handleAddToMenu = () => {
    setIsMealTypeModalOpen(true);
  };

  const handleMealTypeSelected = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', date: string) => {
    if (!user?.id || !recipe) return;

    recipeDiaryService.saveRecipeEntry({
      userId: user.id,
      date,
      mealType,
      recipeName: recipe.name,
      weight,
      per100: macrosPer100,
      totals: calculatedMacros,
    });

    setIsMealTypeModalOpen(false);
    navigate('/nutrition', { state: { selectedDate: date } });
  };

  if (!recipe) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="px-2 sm:px-4 md:px-6 lg:px-8 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="w-6" />
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase flex-1 text-center">
            МОИ РЕЦЕПТЫ
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

      <main className="px-2 sm:px-4 md:px-6 lg:px-8 py-4 space-y-4">
        {/* Recipe Name and Weight Input */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{recipe.name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Вес, г</span>
            <input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(Math.max(1, Number(e.target.value) || 100))}
              className="w-20 h-10 border border-gray-300 dark:border-gray-700 rounded-lg px-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Recipe Image */}
        {recipe.image && (
          <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={recipe.image}
              alt={recipe.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* КБЖУ Cards */}
        <div className="flex gap-3 overflow-x-auto justify-center">
          <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Калории</div>
            <div className="border-2 border-blue-400 rounded-xl py-3 px-3 text-center w-full">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{calculatedMacros.calories}</div>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Белки</div>
            <div className="border-2 border-orange-400 rounded-xl py-3 px-3 text-center w-full">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{calculatedMacros.proteins}</div>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Жиры</div>
            <div className="border-2 border-yellow-400 rounded-xl py-3 px-3 text-center w-full">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{calculatedMacros.fats}</div>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Углеводы</div>
            <div className="border-2 border-green-500 rounded-xl py-3 px-3 text-center w-full">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{calculatedMacros.carbs}</div>
            </div>
          </div>
        </div>

        {/* Ingredients List */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Состав:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-800 dark:text-gray-200">
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start">
                  <span className="flex-1">
                    {ingredient.name} - {ingredient.quantity} {ingredient.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Recipe Note - отображается после состава */}
        {recipeNote && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Заметка:</h3>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Редактировать заметку"
              >
                <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {recipeNote}
            </p>
          </div>
        )}

        {/* Recipe Note/Instructions - отображается после заметки пользователя */}
        {recipe.instructions && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Инструкции:</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {recipe.instructions}
            </p>
          </div>
        )}
        {(!recipe.ingredients || recipe.ingredients.length === 0) && recipe.source === 'default' && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Состав:</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Ингредиенты не указаны
            </div>
          </div>
        )}

        {/* Action Buttons (Add Note, Add Photo) */}
        <div className="flex gap-4 pt-2">
          {/* Кнопка "Добавить заметку" показывается только если заметки нет */}
          {!recipeNote && (
            <button 
              onClick={() => setIsNoteModalOpen(true)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              <span>ДОБАВИТЬ ЗАМЕТКУ</span>
            </button>
          )}
          {/* Кнопка "Добавить фото" показывается только если фото нет */}
          {!recipe.image && (
            <button className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Camera className="w-4 h-4" />
              <span>ДОБАВИТЬ ФОТО</span>
            </button>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="space-y-3 pt-4 pb-8">
          <button
            onClick={() => {
              if (confirm('Вы уверены, что хотите удалить этот рецепт?')) {
                if (user?.id && recipe.id) {
                  recipesService.deleteRecipe(recipe.id, user.id);
                  navigate(-1);
                }
              }
            }}
            className="w-full h-12 rounded border-2 border-gray-800 dark:border-gray-300 text-gray-900 dark:text-white text-sm font-semibold bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            style={{ borderRadius: '12px' }}
          >
            УДАЛИТЬ
          </button>
          <button
            onClick={handleAddToMenu}
            className="w-full h-12 rounded border-2 border-gray-800 dark:border-gray-300 text-gray-900 dark:text-white text-sm font-semibold bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            style={{ borderRadius: '12px' }}
          >
            СОХРАНИТЬ В МЕНЮ
          </button>
          <button
            onClick={() => {
              // TODO: Редактирование рецепта
              alert('Редактирование рецепта будет доступно позже');
            }}
            className="w-full h-12 rounded bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
            style={{ borderRadius: '12px' }}
          >
            СОХРАНИТЬ
          </button>
        </div>
      </main>

      {/* Meal Type Selector Modal */}
      <MealTypeSelectorModal
        isOpen={isMealTypeModalOpen}
        onClose={() => setIsMealTypeModalOpen(false)}
        onSelect={handleMealTypeSelected}
        defaultDate={location.state?.selectedDate || new Date().toISOString().split('T')[0]}
      />

      {/* Recipe Note Modal */}
      {recipe && user?.id && (
        <RecipeNoteModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          initialNote={recipeNote}
          onSave={async (note) => {
            try {
              // Если заметка пустая, удаляем её
              if (!note || !note.trim()) {
                if (recipeNote) {
                  await recipeNotesService.deleteNote(user.id, recipe.id);
                  setRecipeNote(null);
                }
                return;
              }

              await recipeNotesService.saveNote(user.id, recipe.id, note);
              setRecipeNote(note);
            } catch (error: any) {
              console.error('[RecipeDetails] Error saving note:', error);
              
              // Более информативное сообщение об ошибке
              let errorMessage = 'Не удалось сохранить заметку. Попробуйте еще раз.';
              
              if (error?.code === 'PGRST205') {
                errorMessage = 'Таблица recipe_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/recipe_notes_schema.sql в Supabase SQL Editor.';
              } else if (error?.message) {
                errorMessage = `Ошибка: ${error.message}`;
              }
              
              alert(errorMessage);
            }
          }}
          onDelete={async () => {
            try {
              await recipeNotesService.deleteNote(user.id, recipe.id);
              setRecipeNote(null);
            } catch (error: any) {
              console.error('[RecipeDetails] Error deleting note:', error);
              
              let errorMessage = 'Не удалось удалить заметку. Попробуйте еще раз.';
              
              if (error?.code === 'PGRST205') {
                errorMessage = 'Таблица recipe_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/recipe_notes_schema.sql в Supabase SQL Editor.';
              } else if (error?.message) {
                errorMessage = `Ошибка: ${error.message}`;
              }
              
              alert(errorMessage);
            }
          }}
        />
      )}
    </div>
  );
};

export default RecipeDetails;

