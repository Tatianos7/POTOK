import { useState, useEffect, useMemo, useRef } from 'react';
import { MealEntry } from '../types';
import { X, Pencil, Camera } from 'lucide-react';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { mealEntryNotesService } from '../services/mealEntryNotesService';
import { useAuth } from '../context/AuthContext';
import MealNoteModal from './MealNoteModal';
import { convertDisplayToGrams, FoodDisplayUnit } from '../utils/foodUnits';
import { getQuickFoodPresets, getSafeDisplayUnit, getSupportedFoodDisplayUnits } from '../utils/foodMeasurementPresets';
import FoodSourceBadge from './FoodSourceBadge';
import { submitModalAction } from '../utils/asyncModalSubmit';

interface EditMealEntryModalProps {
  entry: MealEntry | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', updatedEntry: MealEntry) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
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
  const [amount, setAmount] = useState<string>('');
  const [unit, setUnit] = useState<FoodDisplayUnit>('г');
  const [isSaving, setIsSaving] = useState(false);
  const submitLock = useRef({ current: false });
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  const [note, setNote] = useState<string>('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const supportedUnits = useMemo(
    () => (entry?.food ? getSupportedFoodDisplayUnits(entry.food) : (['г'] as FoodDisplayUnit[])),
    [entry?.food]
  );
  const quickPresets = useMemo(
    () =>
      (entry?.food
        ? getQuickFoodPresets(entry.food)
        : [{ quantity: 100, unit: 'г' as FoodDisplayUnit, label: '100 г' }]).filter(
        (preset) => !(preset.unit === 'г' && preset.quantity === 100)
      ),
    [entry?.food]
  );

  useEffect(() => {
    if (entry) {
      const displayUnit = getSafeDisplayUnit(entry.displayUnit as FoodDisplayUnit, supportedUnits);
      const displayAmount = entry.displayAmount ?? entry.weight;
      setUnit(displayUnit);
      setAmount(displayAmount.toString());
      const grams = convertDisplayToGrams(displayAmount, displayUnit, entry.food?.name);
      calculateNutrients(grams);
      // Загружаем заметку, если она есть
      setNote(entry.note || '');
    }
  }, [entry, supportedUnits]);

  useEffect(() => {
    if (!entry) return;
    const safeUnit = getSafeDisplayUnit(unit, supportedUnits);
    if (safeUnit !== unit) {
      setUnit(safeUnit);
      const amountNum = parseFloat(amount) || 0;
      const grams = convertDisplayToGrams(amountNum, safeUnit, entry.food?.name);
      calculateNutrients(grams);
    }
  }, [entry, unit, amount, supportedUnits]);

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

  const handleAmountChange = (value: string) => {
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
      setAmount(value);
      const amountNum = parseFloat(value) || 0;
      const grams = convertDisplayToGrams(amountNum, unit, entry?.food?.name);
      calculateNutrients(grams);
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

  const handleSave = async () => {
    if (!entry || !amount || parseFloat(amount) <= 0) {
      return;
    }

    const amountNum = parseFloat(amount);
    const weightNum = convertDisplayToGrams(amountNum, unit, entry.food?.name);
    const updatedEntry: MealEntry = {
      ...entry,
      weight: weightNum,
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
      baseUnit: 'г',
      displayUnit: unit,
      displayAmount: amountNum,
    };

    if (!mealType) return;

    setIsSaving(true);
    try {
      await submitModalAction(
        submitLock.current,
        () => onSave(mealType, updatedEntry),
        () => {
          onClose();
        }
      );
    } catch (error) {
      console.error('[EditMealEntryModal] Failed to update entry:', error);
      alert('Не удалось сохранить изменения. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await submitModalAction(
        submitLock.current,
        () => onDelete(),
        () => {
          onClose();
        }
      );
    } catch (error) {
      console.error('[EditMealEntryModal] Failed to delete entry:', error);
      alert('Не удалось удалить продукт. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
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
      onClick={() => { if (!isSaving) onClose(); }}
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
            onClick={() => { if (!isSaving) onClose(); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4 disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6" style={{ padding: '10px' }}>
          {/* Food Name and Weight Input */}
          <div className="flex items-center justify-between gap-3 mobile-lg:gap-4 w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              <p 
                className="text-base font-medium text-gray-900 dark:text-white truncate min-w-0"
              >
                {getFoodDisplayName(entry.food)}
              </p>
              <FoodSourceBadge food={entry.food} className="flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Количество</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={isSaving}
                min="0"
                step="1"
                className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-center flex-shrink-0"
                placeholder="150"
                style={{ boxSizing: 'border-box' }}
              />
              <select
                value={unit}
                disabled={isSaving}
                onChange={(e) => {
                  const nextUnit = e.target.value as FoodDisplayUnit;
                  setUnit(nextUnit);
                  const amountNum = parseFloat(amount) || 0;
                  const grams = convertDisplayToGrams(amountNum, nextUnit, entry?.food?.name);
                  calculateNutrients(grams);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {supportedUnits.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {quickPresets.map((preset) => (
              <button
                key={`${preset.quantity}-${preset.unit}`}
                type="button"
                onClick={() => {
                  setAmount(preset.quantity.toString());
                  setUnit(preset.unit);
                  const grams = convertDisplayToGrams(preset.quantity, preset.unit, entry.food?.name);
                  calculateNutrients(grams);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                {preset.label}
              </button>
            ))}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={isSaving}
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
              disabled={isSaving}
              className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
>
              {isSaving ? 'УДАЛЕНИЕ...' : 'УДАЛИТЬ'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 dark:bg-gray-700 text-white font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
>
              {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
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
