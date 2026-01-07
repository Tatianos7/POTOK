import { useState, useEffect } from 'react';
import { MealEntry } from '../types';
import { X, Pencil, Camera } from 'lucide-react';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { mealEntryNotesService } from '../services/mealEntryNotesService';
import { useAuth } from '../context/AuthContext';
import MealNoteModal from './MealNoteModal';

interface EditMealEntryModalProps {
  entry: MealEntry | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', updatedEntry: MealEntry) => void;
  onDelete: () => void;
  source?: 'meal' | 'search' | 'favorites' | 'analyzer'; // Источник открытия карточки
}

const mealTypeNames: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'ЗАВТРАК',
  lunch: 'ОБЕД',
  dinner: 'УЖИН',
  snack: 'ПЕРЕКУС',
};

const EditMealEntryModal = ({
  entry,
  mealType,
  date,
  isOpen,
  onClose,
  onSave,
  onDelete,
  source = 'search', // По умолчанию 'search' для обратной совместимости
}: EditMealEntryModalProps) => {
  const { user } = useAuth();
  const [weight, setWeight] = useState<string>('');
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  const [note, setNote] = useState<string>('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  useEffect(() => {
    if (entry) {
      setWeight(entry.weight.toString());
      calculateNutrients(entry.weight);
      // Загружаем заметку, если она есть
      setNote(entry.note || '');
    }
  }, [entry]);

  // Загружаем заметку из Supabase при открытии модального окна
  useEffect(() => {
    if (isOpen && entry && user?.id && source === 'meal') {
      mealEntryNotesService.getNoteByEntryId(user.id, entry.id)
        .then((loadedNote) => {
          if (loadedNote) {
            setNote(loadedNote);
          }
        })
        .catch((error) => {
          console.error('[EditMealEntryModal] Error loading note:', error);
        });
    }
  }, [isOpen, entry, user?.id, source]);

  const calculateNutrients = (weightInGrams: number) => {
    if (!entry) return;

    const k = weightInGrams / 100;
    setCalculated({
      calories: entry.food.calories * k,
      protein: entry.food.protein * k,
      fat: entry.food.fat * k,
      carbs: entry.food.carbs * k,
    });
  };

  const handleWeightChange = (value: string) => {
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
      setWeight(value);
      const weightNum = parseFloat(value) || 0;
      calculateNutrients(weightNum);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    
    const weekday = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    return `${weekday} ${day} ${month}`;
  };

  const handleSave = () => {
    if (!entry || !weight || parseFloat(weight) <= 0) {
      return;
    }

    const weightNum = parseFloat(weight);
    const updatedEntry: MealEntry = {
      ...entry,
      weight: weightNum,
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
    };

    if (mealType) {
      onSave(mealType, updatedEntry);
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleNoteClick = () => {
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (noteText: string) => {
    if (!user?.id || !entry) return;

    try {
      const trimmedNote = noteText.trim();
      
      if (trimmedNote) {
        // Сохраняем заметку в Supabase
        await mealEntryNotesService.saveNote(user.id, entry.id, trimmedNote);
        setNote(trimmedNote);
      } else {
        // Удаляем заметку, если текст пустой
        await mealEntryNotesService.deleteNote(user.id, entry.id);
        setNote('');
      }

      // Обновляем entry в родительском компоненте СРАЗУ, чтобы заметка отобразилась сразу
      const updatedEntry: MealEntry = {
        ...entry,
        note: trimmedNote || null,
      };
      
      // Вызываем onSave СИНХРОННО, чтобы обновить состояние в родительском компоненте
      if (mealType) {
        onSave(mealType, updatedEntry);
      }

      setIsNoteModalOpen(false);
    } catch (error) {
      console.error('[EditMealEntryModal] Error saving note:', error);
      alert('Ошибка при сохранении заметки');
    }
  };

  if (!isOpen || !entry || !mealType) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-[calc(100vw-24px)] mobile-lg:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 mobile-lg:px-6 py-3 mobile-lg:py-4 flex items-center justify-between w-full max-w-full overflow-hidden">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">
              {mealTypeNames[mealType]}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Food Name and Weight Input */}
          <div className="flex items-center justify-between gap-3 mobile-lg:gap-4 w-full max-w-full overflow-hidden">
            <p 
              className="text-base font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0"
            >
              {getFoodDisplayName(entry.food)}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Вес, г</span>
              <input
                type="number"
                value={weight}
                onChange={(e) => handleWeightChange(e.target.value)}
                min="0"
                step="1"
                className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-center flex-shrink-0"
                placeholder="150"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Nutritional Information Cards */}
          <div className="grid grid-cols-2 gap-2 mobile-lg:gap-3 w-full max-w-full overflow-hidden">
            {/* Калории */}
            <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Калории</div>
              <div className="border-2 border-blue-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.round(calculated.calories)}
                </div>
              </div>
            </div>

            {/* Белки */}
            <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Белки</div>
              <div className="border-2 border-orange-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.round(calculated.protein)}
                </div>
              </div>
            </div>

            {/* Жиры */}
            <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Жиры</div>
              <div className="border-2 border-yellow-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.round(calculated.fat)}
                </div>
              </div>
            </div>

            {/* Углеводы */}
            <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Углеводы</div>
              <div className="border-2 border-green-500 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.round(calculated.carbs)}
                </div>
              </div>
            </div>
          </div>

          {/* User Note - отображается после КБЖУ */}
          {note && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Заметка:</h3>
                <button
                  onClick={handleNoteClick}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Редактировать заметку"
                >
                  <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {note}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            {/* Кнопка "Добавить заметку" показывается только если заметки нет */}
            {!note && (
              <button
                type="button"
                onClick={handleNoteClick}
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  ДОБАВИТЬ ЗАМЕТКУ
                </span>
              </button>
            )}

            {/* Кнопка "Добавить фото" скрыта, если карточка открыта из приёма пищи */}
            {source !== 'meal' && (
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  ДОБАВИТЬ ФОТО
                </span>
              </button>
            )}
          </div>

          {/* Bottom Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              УДАЛИТЬ
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 dark:bg-gray-700 text-white font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно для заметки */}
      <MealNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={handleSaveNote}
        initialNote={note}
        onDelete={async () => {
          if (!user?.id || !entry) return;
          try {
            await mealEntryNotesService.deleteNote(user.id, entry.id);
            setNote('');
            const updatedEntry: MealEntry = {
              ...entry,
              note: null,
            };
            if (mealType) {
              onSave(mealType, updatedEntry);
            }
          } catch (error) {
            console.error('[EditMealEntryModal] Error deleting note:', error);
            alert('Ошибка при удалении заметки');
          }
        }}
      />
    </div>
  );
};

export default EditMealEntryModal;

