import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Plus, ScanLine, Camera, Coffee, UtensilsCrossed, Utensils, Apple, ChevronUp, ChevronDown, MoreVertical, Check, Heart, Copy, Trash2, StickyNote } from 'lucide-react';
import { DailyMeals, MealEntry, Food, UserCustomFood } from '../types';
import { mealService } from '../services/mealService';
import { foodService } from '../services/foodService';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import ProductSearch from '../components/ProductSearch';
import BarcodeScanner from '../components/BarcodeScanner';
import CameraBarcodeScanner from '../components/CameraBarcodeScanner';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import CreateCustomFoodModal from '../components/CreateCustomFoodModal';
import ScanConfirmBottomSheet from '../components/ScanConfirmBottomSheet';
import AddProductModal from '../components/AddProductModal';
import RecipeAnalyzePicker from '../components/RecipeAnalyzePicker';
import RecipeAnalyzeResultSheet from '../components/RecipeAnalyzeResultSheet';
import PhotoFoodAnalyzerModal from '../components/PhotoFoodAnalyzerModal';
import EditMealEntryModal from '../components/EditMealEntryModal';
import InlineCalendar from '../components/InlineCalendar';
import CopyMealModal from '../components/CopyMealModal';
import DeleteMealConfirmModal from '../components/DeleteMealConfirmModal';
import MealNoteModal from '../components/MealNoteModal';
import SaveMealAsRecipeModal from '../components/SaveMealAsRecipeModal';
import { recipesService } from '../services/recipesService';
import { localAIFoodAnalyzer, LocalIngredient } from '../services/localAIFoodAnalyzer';

const FoodDiary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Получаем текущую дату в формате YYYY-MM-DD
  // Получаем сегодняшнюю дату в локальном времени (не UTC)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [dailyMeals, setDailyMeals] = useState<DailyMeals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [isCreateCustomFoodModalOpen, setIsCreateCustomFoodModalOpen] = useState(false);
  const [isConfirmScannedFoodModalOpen, setIsConfirmScannedFoodModalOpen] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [analyzedIngredients, setAnalyzedIngredients] = useState<LocalIngredient[]>([]);
  const [isRecipeResultOpen, setIsRecipeResultOpen] = useState(false);
  const [isPhotoFoodAnalyzerOpen, setIsPhotoFoodAnalyzerOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [scannedFood, setScannedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  
  // State для раскрытия/сворачивания приёмов пищи
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
  });
  
  // State для отметки "съедено" для каждого продукта
  const [eatenEntries, setEatenEntries] = useState<Record<string, boolean>>({});

  
  // State для редактирования записи продукта
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  
  // State для копирования приёма пищи
  const [isCopyMealModalOpen, setIsCopyMealModalOpen] = useState(false);
  const [copyingMealType, setCopyingMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  
  // State для подтверждения удаления приёма пищи
  const [isDeleteMealModalOpen, setIsDeleteMealModalOpen] = useState(false);
  const [deletingMealType, setDeletingMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  
  // State для заметки приёма пищи
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteMealType, setNoteMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  
  // State для сохранения рецепта из приёма пищи
  const [isSaveRecipeModalOpen, setIsSaveRecipeModalOpen] = useState(false);
  const [savingMealType, setSavingMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  
  // State для встроенного календаря
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Закрытие календаря при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        // Проверяем, что клик не по кнопке открытия календаря
        const button = (event.target as HTMLElement).closest('button');
        if (button && button.querySelector('svg[class*="lucide-calendar"]')) {
          return; // Не закрываем, если клик по кнопке календаря
        }
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);
  
  // Переключение состояния раскрытия приёма пищи
  const toggleMealExpanded = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setExpandedMeals((prev) => ({
      ...prev,
      [mealType]: !prev[mealType],
    }));
  };
  
  // Переключение состояния "съедено" для продукта
  const toggleEntryEaten = (entryId: string) => {
    setEatenEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  // Утилита для добавления дней к дате в формате YYYY-MM-DD (без использования Date)
  const addDaysToString = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Создаем Date только для вычисления, но сразу конвертируем обратно в строку
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newYear}-${newMonth}-${newDay}`;
  };

  // Утилита для получения дня недели из строки YYYY-MM-DD
  const getWeekdayFromString = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'][date.getDay()];
  };

  // Быстрый календарь всегда строится от сегодняшней даты (7 дней вперёд)
  const dates = useMemo(() => {
    const datesList = [];
    const today = getTodayDate();
    
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToString(today, i);
      const [, , day] = dateStr.split('-').map(Number);
      
      datesList.push({
        date: dateStr,
        day: day,
        weekday: getWeekdayFromString(dateStr),
      });
    }
    return datesList;
  }, []); // Календарь не зависит от selectedDate, всегда показывает текущую неделю
  
  // Инициализация: при первом рендере выбираем сегодняшнюю дату
  useEffect(() => {
    const currentToday = getTodayDate();
    setSelectedDate(currentToday);
  }, []); // Выполняем только при монтировании компонента

  const meals = [
    { id: 'breakfast', name: 'ЗАВТРАК', icon: Coffee },
    { id: 'lunch', name: 'ОБЕД', icon: UtensilsCrossed },
    { id: 'dinner', name: 'УЖИН', icon: Utensils },
    { id: 'snack', name: 'ПЕРЕКУС', icon: Apple },
  ];

  const mealTypeNames: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
    breakfast: 'Завтрак',
    lunch: 'Обед',
    dinner: 'Ужин',
    snack: 'Перекус',
  };

  // Load meals for selected date (приоритет localStorage для мгновенного отображения)
  useEffect(() => {
    if (!user?.id) return;

    // Очищаем старые данные
    setDailyMeals(null);
    setIsLoading(true);

    // Загружаем данные (getMealsForDate приоритизирует localStorage, затем синхронизирует с Supabase в фоне)
    mealService.getMealsForDate(user.id, selectedDate)
      .then((meals) => {
        setDailyMeals(meals);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[FoodDiary] Error loading meals:', error);
        // В случае ошибки показываем пустой дневник
        setDailyMeals({
          date: selectedDate,
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
          water: 0,
        });
        setIsLoading(false);
      });
  }, [selectedDate, user?.id]);

  // Обработчик синхронизации данных с Supabase
  useEffect(() => {
    if (!user?.id) return;

    const handleMealsSynced = (event: CustomEvent) => {
      const { date, meals } = event.detail;
      // Обновляем только если это текущая выбранная дата
      if (date === selectedDate) {
        setDailyMeals(meals);
      }
    };

    window.addEventListener('meals-synced', handleMealsSynced as EventListener);

    return () => {
      window.removeEventListener('meals-synced', handleMealsSynced as EventListener);
    };
  }, [selectedDate, user?.id]);

  // Calculate totals
  const dayTotals = dailyMeals ? mealService.calculateDayTotals(dailyMeals) : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  
  // Get goal data (if exists) - используем правильный ключ
  const goalData = user?.id ? (() => {
    try {
      const stored = localStorage.getItem(`goal_${user.id}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // Преобразуем строки в числа
      return {
        calories: parseFloat(parsed.calories) || 0,
        proteins: parseFloat(parsed.proteins) || 0,
        fats: parseFloat(parsed.fats) || 0,
        carbs: parseFloat(parsed.carbs) || 0,
      };
    } catch {
      return null;
    }
  })() : null;

  // Дневные нормы из целей (значения по умолчанию, если цели нет)
  const dailyCalories = goalData?.calories || 2000;
  const dailyProtein = goalData?.proteins || 100;
  const dailyFat = goalData?.fats || 70;
  const dailyCarbs = goalData?.carbs || 250;

  // Съедено за день
  const consumedCalories = Math.round(dayTotals.calories);
  const consumedProtein = Math.round(dayTotals.protein * 10) / 10;
  const consumedFat = Math.round(dayTotals.fat * 10) / 10;
  const consumedCarbs = Math.round(dayTotals.carbs * 10) / 10;

  // Осталось съесть (в цифрах, не в процентах)
  const remainingCalories = Math.max(0, Math.round(dailyCalories - consumedCalories));
  const remainingProtein = Math.max(0, Math.round((dailyProtein - consumedProtein) * 10) / 10);
  const remainingFat = Math.max(0, Math.round((dailyFat - consumedFat) * 10) / 10);
  const remainingCarbs = Math.max(0, Math.round((dailyCarbs - consumedCarbs) * 10) / 10);

  // Вычисляем перебор (когда съели больше нормы)
  const overCalories = consumedCalories > dailyCalories ? Math.round(consumedCalories - dailyCalories) : 0;
  const overProtein = consumedProtein > dailyProtein ? Math.round((consumedProtein - dailyProtein) * 10) / 10 : 0;
  const overFat = consumedFat > dailyFat ? Math.round((consumedFat - dailyFat) * 10) / 10 : 0;
  const overCarbs = consumedCarbs > dailyCarbs ? Math.round(consumedCarbs - dailyCarbs) : 0;

  // Проверяем, есть ли перебор по любому из показателей
  const hasOverConsumption = overCalories > 0 || overProtein > 0 || overFat > 0 || overCarbs > 0;

  const handleMealClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setSelectedMealType(mealType);
    navigate('/nutrition/search', { state: { mealType, selectedDate } });
  };

  const handleFoodSelect = (food: Food) => {
    setSelectedFood(food);
    setIsSearchModalOpen(false);
    setIsBarcodeModalOpen(false);
    setIsAddFoodModalOpen(true);
  };

  const handleCameraScan = async (barcode: string) => {
    if (!user?.id) return;

    setIsCameraModalOpen(false);
    
    try {
      const food = await foodService.findByBarcode(barcode, user.id);
      
      if (food) {
        setScannedFood(food);
        setIsConfirmScannedFoodModalOpen(true);
      } else {
        // Если продукт не найден, можно показать ошибку или открыть модальное окно создания
        alert('Продукт не найден');
      }
    } catch (error) {
      console.error('Error finding food by barcode:', error);
      alert('Ошибка при поиске продукта');
    }
  };

  const handleConfirmScannedFood = async (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', weight: number) => {
    if (!user?.id || !scannedFood || !dailyMeals) return;

    // Пересчитываем калории и БЖУ на основе веса
    const k = weight / 100;
    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      foodId: scannedFood.id,
      food: scannedFood,
      weight: weight,
      calories: scannedFood.calories * k,
      protein: scannedFood.protein * k,
      fat: scannedFood.fat * k,
      carbs: scannedFood.carbs * k,
    };

    const normalizedEntry = normalizeEntry(entry);

    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[mealType] = [...updated[mealType], normalizedEntry];
      return updated;
    });
    
    // СРАЗУ разворачиваем блок приёма пищи синхронно
    setExpandedMeals((prev) => ({
      ...prev,
      [mealType]: true,
    }));
    
    setIsConfirmScannedFoodModalOpen(false);
    setScannedFood(null);

    // Сохраняем в фоне (не перезагружаем данные, чтобы не потерять оптимистичное обновление)
    mealService.addMealEntry(user.id, selectedDate, mealType, normalizedEntry).catch((error) => {
      console.error('[FoodDiary] Ошибка сохранения продукта:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };

  const handleRejectScannedFood = () => {
    setIsConfirmScannedFoodModalOpen(false);
    setScannedFood(null);
  };

  const handleAddFood = (entry: MealEntry) => {
    if (!user?.id || !selectedMealType || !dailyMeals) {
      console.warn('[FoodDiary] handleAddFood: missing required data', { user: !!user?.id, selectedMealType, dailyMeals: !!dailyMeals });
      return;
    }

    const mealTypeToExpand = selectedMealType;
    console.log('[FoodDiary] Adding food to', mealTypeToExpand, entry);
    const normalizedEntry = normalizeEntry(entry);

    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) {
        console.warn('[FoodDiary] No previous dailyMeals, creating new');
        return {
          date: selectedDate,
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
          water: 0,
          [selectedMealType]: [normalizedEntry],
        };
      }
      const updated = { ...prev };
      updated[selectedMealType] = [...(updated[selectedMealType] || []), normalizedEntry];
      console.log('[FoodDiary] Updated dailyMeals:', { mealType: selectedMealType, count: updated[selectedMealType].length });
      return updated;
    });
    
    // СРАЗУ разворачиваем блок приёма пищи синхронно
    setExpandedMeals((prev) => ({
      ...prev,
      [mealTypeToExpand]: true,
    }));
    
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    setSelectedMealType(null);

    // Сохраняем в фоне
    mealService.addMealEntry(user.id, selectedDate, selectedMealType, normalizedEntry).catch((error) => {
      console.error('[FoodDiary] Ошибка сохранения продукта:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };


  const handleWaterClick = (index: number) => {
    if (!user?.id || !dailyMeals) return;

    const newWater = index + 1;
    
    console.log('[FoodDiary] Water click:', { index, newWater, currentWater: dailyMeals.water });
    
    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, water: newWater };
      console.log('[FoodDiary] Updated dailyMeals water:', updated.water);
      return updated;
    });
    
    // Сохраняем в фоне
    mealService.updateWater(user.id, selectedDate, newWater)
      .then(() => {
        console.log('[FoodDiary] Water saved successfully:', newWater);
      })
      .catch((error) => {
        console.error('[FoodDiary] Ошибка сохранения воды:', error);
        // В случае ошибки откатываем изменение
        mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
          setDailyMeals(meals);
        });
      });
  };

  const handleCreateCustomFood = (food: UserCustomFood) => {
    handleFoodSelect(food);
  };

  const handleEntryClick = (entry: MealEntry, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setEditingEntry(entry);
    setSelectedMealType(mealType);
    setIsEditEntryModalOpen(true);
  };

  // Нормализация числовых полей записи, чтобы вес/КБЖУ сразу были числами
  const normalizeEntry = (entry: MealEntry): MealEntry => ({
    ...entry,
    weight: Number(entry.weight) || 0,
    calories: Number(entry.calories) || 0,
    protein: Number(entry.protein) || 0,
    fat: Number(entry.fat) || 0,
    carbs: Number(entry.carbs) || 0,
    note: entry.note || null, // Сохраняем заметку
  });

  const handleUpdateEntry = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', updatedEntry: MealEntry) => {
    if (!user?.id || !dailyMeals) return;
    const normalizedEntry = normalizeEntry(updatedEntry);

    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      const index = updated[mealType].findIndex((e) => e.id === updatedEntry.id);
      if (index !== -1) {
        updated[mealType] = [...updated[mealType]];
        updated[mealType][index] = normalizedEntry;
      }
      return updated;
    });
    
    setIsEditEntryModalOpen(false);
    setEditingEntry(null);
    setSelectedMealType(null);

    // Сохраняем в фоне
    mealService.updateMealEntry(user.id, selectedDate, mealType, updatedEntry.id, normalizedEntry).catch((error) => {
      console.error('[FoodDiary] Ошибка обновления продукта:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };

  const handleDeleteEntry = () => {
    if (!user?.id || !selectedMealType || !editingEntry || !dailyMeals) {
      console.warn('[FoodDiary] handleDeleteEntry: missing required data', { 
        user: !!user?.id, 
        selectedMealType, 
        editingEntry: !!editingEntry, 
        dailyMeals: !!dailyMeals 
      });
      return;
    }

    const entryIdToDelete = editingEntry.id;
    const mealTypeToDelete = selectedMealType;

    console.log('[FoodDiary] Deleting entry:', { entryId: entryIdToDelete, mealType: mealTypeToDelete });

    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) {
        console.warn('[FoodDiary] No previous dailyMeals for delete');
        return prev;
      }
      const updated = { ...prev };
      const beforeCount = updated[mealTypeToDelete]?.length || 0;
      updated[mealTypeToDelete] = (updated[mealTypeToDelete] || []).filter((e) => e.id !== entryIdToDelete);
      const afterCount = updated[mealTypeToDelete].length;
      console.log('[FoodDiary] Entry deleted:', { mealType: mealTypeToDelete, beforeCount, afterCount });
      return updated;
    });
    
    // Закрываем модальное окно после обновления состояния
    setIsEditEntryModalOpen(false);
    setEditingEntry(null);
    setSelectedMealType(null);

    // Сохраняем в фоне (не перезагружаем данные, чтобы не потерять оптимистичное обновление)
    mealService.removeMealEntry(user.id, selectedDate, mealTypeToDelete, entryIdToDelete).catch((error) => {
      console.error('[FoodDiary] Ошибка удаления продукта:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };

  const handleDeleteMealClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    // Открываем модальное окно подтверждения
    setDeletingMealType(mealType);
    setIsDeleteMealModalOpen(true);
  };

  const handleClearMeal = () => {
    if (!user?.id || !dailyMeals || !deletingMealType) {
      console.warn('[FoodDiary] handleClearMeal: missing required data', { user: !!user?.id, dailyMeals: !!dailyMeals, deletingMealType });
      return;
    }

    const mealType = deletingMealType;
    console.log('[FoodDiary] Clearing meal type:', mealType);

    // Оптимистичное обновление - сразу очищаем UI
    setDailyMeals((prev) => {
      if (!prev) {
        console.warn('[FoodDiary] No previous dailyMeals');
        return prev;
      }
      const updated = { ...prev };
      updated[mealType] = [];
      console.log('[FoodDiary] Meal type cleared:', mealType);
      return updated;
    });

    // Сохраняем в фоне
    mealService.clearMealType(user.id, selectedDate, mealType).catch((error) => {
      console.error('[FoodDiary] Ошибка очистки приёма пищи:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });

    // Закрываем модальное окно
    setIsDeleteMealModalOpen(false);
    setDeletingMealType(null);
  };

  const handleNoteClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    // Открываем модальное окно заметки
    setNoteMealType(mealType);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = (note: string) => {
    if (!user?.id || !noteMealType) {
      console.warn('[FoodDiary] handleSaveNote: missing required data', { user: !!user?.id, noteMealType });
      return;
    }

    console.log('[FoodDiary] Saving note for meal type:', noteMealType, note);

    // Оптимистичное обновление - сразу обновляем UI
    setDailyMeals((prev) => {
      if (!prev) {
        console.warn('[FoodDiary] No previous dailyMeals');
        return prev;
      }
      const updated = { ...prev };
      if (!updated.notes) {
        updated.notes = {
          breakfast: null,
          lunch: null,
          dinner: null,
          snack: null,
        };
      }
      updated.notes[noteMealType] = note.trim() || null;
      console.log('[FoodDiary] Note saved:', noteMealType, updated.notes[noteMealType]);
      return updated;
    });

    // Сохраняем в фоне
    mealService.saveMealNote(user.id, selectedDate, noteMealType, note).catch((error) => {
      console.error('[FoodDiary] Ошибка сохранения заметки:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };

  const handleDeleteNote = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (!user?.id || !dailyMeals) {
      console.warn('[FoodDiary] handleDeleteNote: missing required data', { user: !!user?.id, dailyMeals: !!dailyMeals });
      return;
    }

    console.log('[FoodDiary] Deleting note for meal type:', mealType);

    // Оптимистичное обновление - сразу удаляем заметку из UI
    setDailyMeals((prev) => {
      if (!prev) {
        console.warn('[FoodDiary] No previous dailyMeals');
        return prev;
      }
      const updated = { ...prev };
      if (!updated.notes) {
        updated.notes = {
          breakfast: null,
          lunch: null,
          dinner: null,
          snack: null,
        };
      }
      updated.notes[mealType] = null;
      console.log('[FoodDiary] Note deleted:', mealType);
      return updated;
    });

    // Сохраняем в фоне
    mealService.saveMealNote(user.id, selectedDate, mealType, '').catch((error) => {
      console.error('[FoodDiary] Ошибка удаления заметки:', error);
      // В случае ошибки откатываем изменение
      mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
        setDailyMeals(meals);
      });
    });
  };

  const handleSaveAsRecipeClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    // Проверяем, что в приёме пищи есть продукты
    const mealEntries = dailyMeals?.[mealType] || [];
    if (mealEntries.length === 0) {
      alert('Добавьте продукты в приём пищи перед сохранением рецепта');
      return;
    }
    
    // Открываем модальное окно
    setSavingMealType(mealType);
    setIsSaveRecipeModalOpen(true);
  };

  const handleSaveRecipe = (name: string, note?: string) => {
    if (!user?.id || !savingMealType || !dailyMeals) {
      console.warn('[FoodDiary] handleSaveRecipe: missing required data', { user: !!user?.id, savingMealType, dailyMeals: !!dailyMeals });
      return;
    }

    const mealEntries = dailyMeals[savingMealType];
    if (mealEntries.length === 0) {
      alert('Нет продуктов для сохранения');
      return;
    }

    console.log('[FoodDiary] Saving meal as recipe:', savingMealType, name);

    try {
      // Создаём рецепт из приёма пищи
      const recipe = recipesService.createRecipeFromMeal({
        name,
        note,
        mealEntries,
        userId: user.id,
      });

      console.log('[FoodDiary] Recipe saved:', recipe.id);
      
      // Закрываем модальное окно
      setIsSaveRecipeModalOpen(false);
      setSavingMealType(null);
      
      // Показываем уведомление
      alert(`Рецепт "${name}" сохранён в "Мои рецепты"`);
    } catch (error) {
      console.error('[FoodDiary] Ошибка сохранения рецепта:', error);
      alert('Ошибка при сохранении рецепта');
    }
  };

  const formatSelectedDate = () => {
    // Используем selectedDate напрямую (это уже строка YYYY-MM-DD)
    const dateStr = selectedDate;
    
    // Получаем сегодняшнюю дату в локальном времени
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    
    // Получаем вчерашнюю дату в локальном времени
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayYear = yesterday.getFullYear();
    const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
    
    // Получаем завтрашнюю дату в локальном времени
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

    // Парсим выбранную дату для форматирования (используем значения напрямую из строки)
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Используем значения напрямую из строки, чтобы избежать проблем с часовыми поясами
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];

    const base = `${day} ${months[month - 1]} ${year}`;
    
    // Сравниваем строки дат напрямую
    if (dateStr === todayStr) return `Сегодня, ${base}`;
    if (dateStr === yesterdayStr) return `Вчера, ${base}`;
    if (dateStr === tomorrowStr) return `Завтра, ${base}`;
    
    // Для дат далеко в прошлом или будущем просто показываем дату
    return base;
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  // Компонент блока приёма пищи с локальным меню
  const MealBlock: React.FC<{
    meal: (typeof meals)[number];
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    mealEntries: MealEntry[];
    mealTotals: { calories: number; protein: number; fat: number; carbs: number };
    isExpanded: boolean;
    toggleMealExpanded: (type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    onCopyMeal: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    onDeleteMeal: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    onNoteClick: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    onDeleteNote?: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    onSaveAsRecipe: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
    mealNote: string | null | undefined;
  }> = ({ meal, mealType, mealEntries, mealTotals, isExpanded, toggleMealExpanded, onCopyMeal, onDeleteMeal, onNoteClick, onDeleteNote, onSaveAsRecipe, mealNote }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [noteMenuOpen, setNoteMenuOpen] = useState(false);
    const noteMenuRef = useRef<HTMLDivElement | null>(null);

    // Закрытие по клику вне
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setMenuOpen(false);
        }
      };
      if (menuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    // Закрытие меню заметки по клику вне
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (noteMenuRef.current && !noteMenuRef.current.contains(event.target as Node)) {
          setNoteMenuOpen(false);
        }
      };
      if (noteMenuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [noteMenuOpen]);

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-visible">
        <div className="relative flex items-center py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-3">
            <meal.icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                {meal.name}
              </h3>
              {mealEntries.length > 0 && (
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {Math.round(mealTotals.calories)}
                </span>
              )}
            </div>

            {mealEntries.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                <span>{mealTotals.protein.toFixed(2).replace('.', ',')}</span>
                <span>{mealTotals.fat.toFixed(2).replace('.', ',')}</span>
                <span>{mealTotals.carbs.toFixed(0)}</span>
              </div>
            )}
            
            {/* Отображение заметки (всегда видна, даже если блок свёрнут) */}
            {mealNote && (
              <div className="mt-2 relative">
                <div
                  onClick={() => setNoteMenuOpen((v) => !v)}
                  className="flex items-start gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                >
                  <StickyNote className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {mealNote}
                  </p>
                </div>
                
                {/* Меню заметки */}
                {noteMenuOpen && (
                  <div
                    ref={noteMenuRef}
                    className="absolute top-full left-0 mt-2 z-50"
                  >
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[120px]">
                      <button
                        onClick={() => {
                          setNoteMenuOpen(false);
                          onNoteClick(mealType);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => {
                          setNoteMenuOpen(false);
                          onDeleteNote?.(mealType);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Меню приёма пищи"
            >
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            {mealEntries.length > 0 && (
              <button
                onClick={() => toggleMealExpanded(mealType)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform" />
                )}
              </button>
            )}
            <button
              onClick={() => handleMealClick(mealType)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Добавить продукт"
            >
              <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-full right-0 mb-2 z-40"
            >
              <div className="flex items-center gap-2 mobile-lg:gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-3 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSaveAsRecipe(mealType);
                  }}
                  className="flex flex-col items-center text-xs text-gray-800 dark:text-gray-200 hover:opacity-70 transition-opacity"
                >
                  <Heart className="w-5 h-5 mb-1" />
                  <span>Сохранить как рецепт</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyMeal(mealType);
                  }}
                  className="flex flex-col items-center text-xs text-gray-800 dark:text-gray-200 hover:opacity-70 transition-opacity"
                >
                  <Copy className="w-5 h-5 mb-1" />
                  <span>Копировать</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteMeal(mealType);
                  }}
                  className="flex flex-col items-center text-xs text-gray-800 dark:text-gray-200 hover:opacity-70 transition-opacity"
                >
                  <Trash2 className="w-5 h-5 mb-1" />
                  <span>Удалить</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onNoteClick(mealType);
                  }}
                  className="flex flex-col items-center text-xs text-gray-800 dark:text-gray-200 hover:opacity-70 transition-opacity"
                >
                  <StickyNote className="w-5 h-5 mb-1" />
                  <span>Заметка</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {mealEntries.length > 0 && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-2">
              {mealEntries.map((entry) => {
                const isEaten = eatenEntries[entry.id] || false;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 mobile-lg:gap-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded transition-colors w-full max-w-full overflow-hidden"
                    style={{ padding: '12px' }}
                  >
                    <div 
                      className="flex-1 min-w-0 max-w-full cursor-pointer overflow-hidden"
                      onClick={() => handleEntryClick(entry, mealType)}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5 inline-flex items-center flex-nowrap">
                        <span>
                          {getFoodDisplayName(entry.food)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" style={{ marginLeft: '10px' }}>
                          {Math.round(Number(entry.weight) || 0)} г
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 mobile-lg:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="shrink-0">{entry.protein.toFixed(2).replace('.', ',')}</span>
                        <span className="shrink-0">{entry.fat.toFixed(2).replace('.', ',')}</span>
                        <span className="shrink-0">{entry.carbs.toFixed(0)}</span>
                      </div>
                      {/* Отображение заметки под продуктом */}
                      {entry.note && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic line-clamp-2">
                          {entry.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEntryEaten(entry.id);
                      }}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isEaten
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      aria-label={isEaten ? 'Отметить как не съедено' : 'Отметить как съедено'}
                    >
                      {isEaten && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="flex-shrink-0 text-sm font-medium text-gray-900 dark:text-white w-10 mobile-lg:w-12 text-right">
                      {Math.round(entry.calories)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive min-h-screen">
        {/* Header */}
        <header className="py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1"></div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase flex-1 text-center whitespace-nowrap">
              ДНЕВНИК ПИТАНИЯ
            </h1>
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
          
          {/* Month */}
          <div className="flex items-center justify-between">
            <div className="relative flex flex-col gap-1">
              <button 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatSelectedDate()}
                </span>
              </button>
              
              {/* Календарь поверх контента */}
              <div
                ref={calendarRef}
                className={`absolute top-full left-0 mt-2 z-50 transition-all duration-300 ease-in-out ${
                  isCalendarOpen 
                    ? 'opacity-100 translate-y-0 pointer-events-auto' 
                    : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
              >
                {isCalendarOpen && (
                  <InlineCalendar
                    selectedDate={selectedDate}
                    onDateSelect={(date) => {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }}
                    onClose={() => setIsCalendarOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="py-4 tablet:py-6">
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Загрузка дневника...</span>
            </div>
          )}
          
          {/* Date Selection Bar */}
          {!isLoading && (
          <div className="grid grid-cols-7 gap-1 mb-6 w-full">
            {dates.map((date) => (
              <button
                key={date.date}
                onClick={() => setSelectedDate(date.date)}
                className={`flex flex-col items-center justify-center h-[54px] w-full rounded-full transition-colors ${
                  selectedDate === date.date
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-[13px] font-semibold leading-tight">{date.day}</span>
                <span className={`text-[11px] leading-tight ${selectedDate === date.date ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {date.weekday}
                </span>
              </button>
            ))}
          </div>
          )}

          {/* Eaten Nutrients Summary */}
          {!isLoading && (
          <div className="mb-6">
            <div className="flex flex-col min-[376px]:flex-row min-[376px]:items-center min-[376px]:justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase mb-2 min-[376px]:mb-0">
                УПОТРЕБЛЕНО
              </h2>
              <div className="flex" style={{ gap: '5px' }}>
                <div className="text-center min-w-0 flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-tight">Белки</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {Math.round(dayTotals.protein)}г
                  </p>
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-tight">Жиры</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {Math.round(dayTotals.fat)}г
                  </p>
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-tight">Углеводы</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {Math.round(dayTotals.carbs)}г
                  </p>
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-tight">Калории</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {Math.round(dayTotals.calories)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Meal Entry Sections */}
          {!isLoading && (
          <div className="space-y-3 mb-6">
            {meals.map((meal) => {
              const mealType = meal.id as 'breakfast' | 'lunch' | 'dinner' | 'snack';
              const mealEntries = dailyMeals?.[mealType] || [];
              const mealTotals = mealService.calculateMealTotals(mealEntries);
              const isExpanded = expandedMeals[mealType];

              return (
                <MealBlock
                  key={meal.id}
                  meal={meal}
                  mealType={mealType}
                  mealEntries={mealEntries}
                  mealTotals={mealTotals}
                  isExpanded={isExpanded}
                  toggleMealExpanded={toggleMealExpanded}
                  onCopyMeal={(mealType) => {
                    setCopyingMealType(mealType);
                    setIsCopyMealModalOpen(true);
                  }}
                  onDeleteMeal={handleDeleteMealClick}
                  onNoteClick={handleNoteClick}
                  onDeleteNote={handleDeleteNote}
                  onSaveAsRecipe={handleSaveAsRecipeClick}
                  mealNote={dailyMeals?.notes?.[mealType]}
                />
              );
            })}
          </div>
          )}

          {/* Remaining Nutrients Summary */}
          {!isLoading && (
          <div className="mb-6 rounded-lg bg-white dark:bg-gray-900">
            <div className="flex flex-col min-[376px]:flex-row min-[376px]:items-center min-[376px]:justify-between mb-3">
              <h2 className="text-sm font-medium uppercase text-gray-900 dark:text-white mb-2 min-[376px]:mb-0">
                ОСТАЛОСЬ
              </h2>
              <div className="flex" style={{ gap: '5px' }}>
                <div className="text-center min-w-0 flex-1">
                  <p className={`text-xs mb-1 ${hasOverConsumption && overProtein > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Белки</p>
                  <p className={`text-sm font-semibold ${hasOverConsumption && overProtein > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {overProtein > 0 ? Math.round(consumedProtein) : remainingProtein} г
                  </p>
                  {overProtein > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                      +{overProtein} г
                    </p>
                  )}
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className={`text-xs mb-1 ${hasOverConsumption && overFat > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Жиры</p>
                  <p className={`text-sm font-semibold ${hasOverConsumption && overFat > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {overFat > 0 ? Math.round(consumedFat) : remainingFat} г
                  </p>
                  {overFat > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                      +{overFat} г
                    </p>
                  )}
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className={`text-xs mb-1 ${hasOverConsumption && overCarbs > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Углеводы</p>
                  <p className={`text-sm font-semibold ${hasOverConsumption && overCarbs > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {overCarbs > 0 ? Math.round(consumedCarbs) : remainingCarbs} г
                  </p>
                  {overCarbs > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                      +{overCarbs} г
                    </p>
                  )}
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className={`text-xs mb-1 ${hasOverConsumption && overCalories > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Калории</p>
                  <p className={`text-sm font-semibold ${hasOverConsumption && overCalories > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {overCalories > 0 ? Math.round(consumedCalories) : remainingCalories}
                  </p>
                  {overCalories > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                      +{overCalories}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Water Intake Tracker */}
          {!isLoading && (
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase mb-1">
                ВОДА
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {dailyMeals?.water || 0} ст. · {(((dailyMeals?.water || 0) * 0.3)).toFixed(1)} л
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleWaterClick(index)}
                  className={`w-6 h-8 border-2 rounded-b-full transition-colors ${
                    index < (dailyMeals?.water || 0)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                ></button>
              ))}
            </div>
          </div>
          )}
          
          {/* Spacer for bottom bar */}
          <div className="h-24"></div>
        </main>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-3 z-50 shadow-lg">
        <div className="container-responsive">
          <div className="flex items-center justify-between gap-2 mobile-lg:gap-3">
            <button
              onClick={() => setIsBarcodeModalOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover-bg-gray-800 rounded-lg transition-colors"
            >
              <ScanLine className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="flex-1 py-3 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm uppercase hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              ДОБАВИТЬ ПРОДУКТ
            </button>
            <button
              onClick={() => setIsPhotoFoodAnalyzerOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Анализ продукта по фото"
            >
              <Camera className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Modals */}
      {isSearchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setIsSearchModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductSearch
              onSelect={(food) => {
                handleFoodSelect(food);
              }}
              userId={user.id}
            />
          </div>
        </div>
      )}

      {isBarcodeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setIsBarcodeModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <BarcodeScanner
              onSelect={handleFoodSelect}
              userId={user.id}
              onClose={() => setIsBarcodeModalOpen(false)}
              onOpenCamera={() => {
                setIsBarcodeModalOpen(false);
                setIsCameraModalOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {isCameraModalOpen && (
        <CameraBarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setIsCameraModalOpen(false)}
        />
      )}

      <ScanConfirmBottomSheet
        food={scannedFood}
        isOpen={isConfirmScannedFoodModalOpen}
        onConfirm={handleConfirmScannedFood}
        onReject={handleRejectScannedFood}
      />

      <AddFoodToMealModal
        food={selectedFood}
        isOpen={isAddFoodModalOpen}
        onClose={() => {
          setIsAddFoodModalOpen(false);
          setSelectedFood(null);
        }}
        onAdd={handleAddFood}
      />

      <CreateCustomFoodModal
        isOpen={isCreateCustomFoodModalOpen}
        onClose={() => setIsCreateCustomFoodModalOpen(false)}
        onCreated={handleCreateCustomFood}
        userId={user.id}
      />

      {showAddProductModal && (
        <AddProductModal
          onClose={() => setShowAddProductModal(false)}
          onBrandInput={() => {
            setShowAddProductModal(false);
            navigate('/nutrition/create-brand-product', { state: { selectedDate } });
          }}
          onCustomInput={() => {
            setShowAddProductModal(false);
            navigate('/nutrition/create-custom-product', { state: { selectedDate } });
          }}
          onRecipeAnalyzer={() => {
            setShowAddProductModal(false);
            navigate('/nutrition/recipe-analyzer');
          }}
        />
      )}

      {showRecipePicker && (
        <RecipeAnalyzePicker
          onClose={() => setShowRecipePicker(false)}
          onSelectFile={async (file) => {
            setShowRecipePicker(false);
            try {
              const result = await localAIFoodAnalyzer.analyzeImageLocal(file);
              setAnalyzedIngredients(result.ingredients || []);
              setIsRecipeResultOpen(true); // покажем лист даже с пустым списком, чтобы видеть сообщение
            } catch (error) {
              console.error(error);
              alert('Не удалось определить ингредиенты. Попробуйте другое фото.');
            }
          }}
        />
      )}

      {isRecipeResultOpen && (
        <RecipeAnalyzeResultSheet
          isOpen={isRecipeResultOpen}
          ingredients={analyzedIngredients}
          onChange={(ings) => setAnalyzedIngredients(ings)}
          onReject={() => {
            setIsRecipeResultOpen(false);
            setAnalyzedIngredients([]);
          }}
          onConfirm={(ings) => {
            if (!user?.id || !selectedMealType || !dailyMeals) {
              setIsRecipeResultOpen(false);
              return;
            }
            
            const mealTypeToExpand = selectedMealType;
            
            // Создаем все записи
            const entries: MealEntry[] = ings.map((ing) => {
              const food = localAIFoodAnalyzer.toFood(ing);
              const grams = ing.grams ?? 100;
              const k = grams / 100;
              return {
                id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                foodId: food.id,
                food,
                weight: grams,
                calories: food.calories * k,
                protein: food.protein * k,
                fat: food.fat * k,
                carbs: food.carbs * k,
              };
            });

            // Оптимистичное обновление - сразу обновляем UI
            setDailyMeals((prev) => {
              if (!prev) return prev;
              const updated = { ...prev };
              updated[selectedMealType] = [...updated[selectedMealType], ...entries];
              return updated;
            });
            
            // СРАЗУ разворачиваем блок приёма пищи синхронно
            setExpandedMeals((prev) => ({
              ...prev,
              [mealTypeToExpand]: true,
            }));
            
            setIsRecipeResultOpen(false);
            setAnalyzedIngredients([]);

            // Сохраняем в фоне
            Promise.all(
              entries.map((entry) => mealService.addMealEntry(user.id, selectedDate, selectedMealType, entry))
            ).catch((error) => {
              console.error('[FoodDiary] Ошибка сохранения рецепта:', error);
              // В случае ошибки откатываем изменение
              mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
                setDailyMeals(meals);
              });
            });
          }}
        />
      )}

      <EditMealEntryModal
        entry={editingEntry}
        mealType={selectedMealType}
        date={selectedDate}
        isOpen={isEditEntryModalOpen}
        source="meal"
        onClose={() => {
          setIsEditEntryModalOpen(false);
          setEditingEntry(null);
          setSelectedMealType(null);
        }}
        onSave={handleUpdateEntry}
        onDelete={handleDeleteEntry}
      />

      {copyingMealType && (
        <CopyMealModal
          isOpen={isCopyMealModalOpen}
          onClose={() => {
            setIsCopyMealModalOpen(false);
            setCopyingMealType(null);
          }}
          sourceMealType={copyingMealType}
          entries={dailyMeals?.[copyingMealType] || []}
          onCopy={async (targetDate, targetMealType, selectedEntryIds) => {
            if (!user?.id || !copyingMealType) return;
            
            try {
              await mealService.copyMeal(
                user.id,
                selectedDate,
                copyingMealType,
                targetDate,
                targetMealType,
                selectedEntryIds
              );
              
              // Обновляем UI независимо от даты (данные уже в localStorage)
              // Если копируем на текущую дату, обновляем сразу
              if (targetDate === selectedDate) {
                // Используем getMealsForDate для получения актуальных данных из localStorage
                const updatedMeals = await mealService.getMealsForDate(user.id, selectedDate);
                setDailyMeals(updatedMeals);
              }
              // Если копируем на другую дату, данные уже сохранены в localStorage
              // При переключении на эту дату useEffect автоматически загрузит актуальные данные
              
              // Показываем уведомление об успехе
              alert(`Приём пищи скопирован на ${targetDate} в ${mealTypeNames[targetMealType]}`);
            } catch (error) {
              console.error('[FoodDiary] Ошибка копирования приёма пищи:', error);
              alert('Ошибка при копировании приёма пищи');
            }
          }}
        />
      )}

      {/* Модальное окно подтверждения удаления приёма пищи */}
      {deletingMealType && (
        <DeleteMealConfirmModal
          isOpen={isDeleteMealModalOpen}
          onClose={() => {
            setIsDeleteMealModalOpen(false);
            setDeletingMealType(null);
          }}
          onConfirm={handleClearMeal}
        />
      )}

      {/* Модальное окно заметки приёма пищи */}
      {noteMealType && (
        <MealNoteModal
          isOpen={isNoteModalOpen}
          onClose={() => {
            setIsNoteModalOpen(false);
            setNoteMealType(null);
          }}
          onSave={handleSaveNote}
          initialNote={dailyMeals?.notes?.[noteMealType] || null}
        />
      )}

      {/* Модальное окно сохранения рецепта из приёма пищи */}
      {savingMealType && (
        <SaveMealAsRecipeModal
          isOpen={isSaveRecipeModalOpen}
          onClose={() => {
            setIsSaveRecipeModalOpen(false);
            setSavingMealType(null);
          }}
          onSave={handleSaveRecipe}
        />
      )}

      {/* Photo Food Analyzer Modal */}
      {isPhotoFoodAnalyzerOpen && (
        <PhotoFoodAnalyzerModal
          isOpen={isPhotoFoodAnalyzerOpen}
          onClose={() => setIsPhotoFoodAnalyzerOpen(false)}
          onSave={(food, weight, mealType = 'lunch') => {
            if (!user?.id || !dailyMeals) return;

            const multiplier = weight / 100;
            const entry: MealEntry = {
              id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              foodId: food.id,
              food,
              weight,
              calories: Math.round(food.calories * multiplier),
              protein: Math.round((food.protein * multiplier) * 10) / 10,
              fat: Math.round((food.fat * multiplier) * 10) / 10,
              carbs: Math.round((food.carbs * multiplier) * 10) / 10,
            };

            // Оптимистичное обновление
            setDailyMeals((prev) => {
              if (!prev) return prev;
              const updated = { ...prev };
              updated[mealType] = [...updated[mealType], entry];
              return updated;
            });

            setExpandedMeals((prev) => ({
              ...prev,
              [mealType]: true,
            }));

            // Сохраняем в фоне
            mealService.addMealEntry(user.id, selectedDate, mealType, entry).catch((error) => {
              console.error('[FoodDiary] Ошибка сохранения продукта из фото:', error);
              mealService.getFoodDiaryByDate(user.id, selectedDate).then((meals) => {
                setDailyMeals(meals);
              });
            });
          }}
          defaultMealType={selectedMealType || 'lunch'}
          userId={user?.id}
        />
      )}
    </>
  );
};

export default FoodDiary;
