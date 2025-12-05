import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Plus, ScanLine, Camera, Coffee, UtensilsCrossed, Utensils, Apple, Trash2 } from 'lucide-react';
import { DailyMeals, MealEntry, Food, UserCustomFood } from '../types';
import { mealService } from '../services/mealService';
import { foodService } from '../services/foodService';
import ProductSearch from '../components/ProductSearch';
import BarcodeScanner from '../components/BarcodeScanner';
import CameraBarcodeScanner from '../components/CameraBarcodeScanner';
import AddFoodToMealModal from '../components/AddFoodToMealModal';
import CreateCustomFoodModal from '../components/CreateCustomFoodModal';
import ScanConfirmBottomSheet from '../components/ScanConfirmBottomSheet';

const FoodDiary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const currentDate = new Date();
  const [dailyMeals, setDailyMeals] = useState<DailyMeals | null>(null);
  
  // Modal states
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [isCreateCustomFoodModalOpen, setIsCreateCustomFoodModalOpen] = useState(false);
  const [isConfirmScannedFoodModalOpen, setIsConfirmScannedFoodModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [scannedFood, setScannedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);

  // Generate dates for the week
  const generateDates = () => {
    const dates = [];
    const today = new Date(currentDate);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        day: date.getDate(),
        weekday: ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'][date.getDay()],
      });
    }
    return dates;
  };

  const dates = generateDates();

  const meals = [
    { id: 'breakfast', name: 'ЗАВТРАК', icon: Coffee },
    { id: 'lunch', name: 'ОБЕД', icon: UtensilsCrossed },
    { id: 'dinner', name: 'УЖИН', icon: Utensils },
    { id: 'snack', name: 'ПЕРЕКУС', icon: Apple },
  ];

  // Load meals for selected date
  useEffect(() => {
    if (user?.id) {
      const meals = mealService.getMealsForDate(user.id, selectedDate);
      setDailyMeals(meals);
    }
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

  const handleMealClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setSelectedMealType(mealType);
    setIsSearchModalOpen(true);
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

    mealService.addMealEntry(user.id, selectedDate, mealType, entry);
    
    // Reload meals
    const updatedMeals = mealService.getMealsForDate(user.id, selectedDate);
    setDailyMeals(updatedMeals);
    
    setIsConfirmScannedFoodModalOpen(false);
    setScannedFood(null);
  };

  const handleRejectScannedFood = () => {
    setIsConfirmScannedFoodModalOpen(false);
    setScannedFood(null);
  };

  const handleAddFood = (entry: MealEntry) => {
    if (!user?.id || !selectedMealType || !dailyMeals) return;

    mealService.addMealEntry(user.id, selectedDate, selectedMealType, entry);
    
    // Reload meals
    const updatedMeals = mealService.getMealsForDate(user.id, selectedDate);
    setDailyMeals(updatedMeals);
    
    setIsAddFoodModalOpen(false);
    setSelectedFood(null);
    setSelectedMealType(null);
  };

  const handleRemoveEntry = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string) => {
    if (!user?.id || !dailyMeals) return;

    mealService.removeMealEntry(user.id, selectedDate, mealType, entryId);
    
    // Reload meals
    const updatedMeals = mealService.getMealsForDate(user.id, selectedDate);
    setDailyMeals(updatedMeals);
  };

  const handleWaterClick = (index: number) => {
    if (!user?.id || !dailyMeals) return;

    const newWater = index + 1;
    mealService.updateWater(user.id, selectedDate, newWater);
    
    // Reload meals
    const updatedMeals = mealService.getMealsForDate(user.id, selectedDate);
    setDailyMeals(updatedMeals);
  };

  const handleCreateCustomFood = (food: UserCustomFood) => {
    handleFoodSelect(food);
  };

  const getMonthName = () => {
    const months = [
      'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
      'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
    ];
    return months[currentDate.getMonth()];
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto">
        {/* Header */}
        <header className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
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
          
          {/* Month and Report */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getMonthName()}
              </span>
            </div>
            <button className="text-sm font-medium text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              ОТЧЕТ
            </button>
          </div>
        </header>

        <main className="px-4 py-6">
          {/* Date Selection Bar */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {dates.map((date) => (
              <button
                key={date.date}
                onClick={() => setSelectedDate(date.date)}
                className={`flex flex-col items-center justify-center min-w-[50px] h-16 rounded-full transition-colors ${
                  selectedDate === date.date
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-sm font-medium">{date.day}</span>
                <span className={`text-xs ${selectedDate === date.date ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {date.weekday}
                </span>
              </button>
            ))}
          </div>

          {/* Eaten Nutrients Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                СЪЕДЕНО
              </h2>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Белки</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.round(dayTotals.protein)}г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Жиры</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.round(dayTotals.fat)}г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Углеводы</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.round(dayTotals.carbs)}г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Калории</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.round(dayTotals.calories)} ккал
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Meal Entry Sections */}
          <div className="space-y-3 mb-6">
            {meals.map((meal) => {
              const mealType = meal.id as 'breakfast' | 'lunch' | 'dinner' | 'snack';
              const mealEntries = dailyMeals?.[mealType] || [];
              const mealTotals = mealService.calculateMealTotals(mealEntries);

              return (
                <div key={meal.id} className="space-y-2">
                  <div className="relative">
                    {/* Text "Сохранить как рецепт" above right part */}
                    <div className="absolute -top-3 right-16 z-10">
                      <div className="relative">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-900 dark:bg-gray-300"></div>
                        <span className="relative bg-white dark:bg-gray-900 px-2 text-xs text-gray-600 dark:text-gray-400">
                          Сохранить как рецепт
                        </span>
                      </div>
                    </div>

                    {/* Main container */}
                    <div className="flex items-center border border-gray-900 dark:border-gray-300 rounded-[15px] bg-white dark:bg-gray-800 overflow-hidden" style={{ borderWidth: '0.5px' }}>
                      {/* Left part with icon and text */}
                      <div className="flex items-center gap-4 px-4 py-[10px] flex-1">
                        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                          <meal.icon className="w-7 h-7 text-gray-700 dark:text-gray-300" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                            {meal.name}
                          </h3>
                          {mealEntries.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {Math.round(mealTotals.calories)} ккал
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Right part - button */}
                      <button
                        onClick={() => handleMealClick(mealType)}
                        className="w-16 self-stretch rounded-r-[15px] rounded-bl-[15px] bg-white dark:bg-white border-t border-r border-b border-gray-900 dark:border-gray-300 text-gray-900 dark:text-gray-900 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors flex-shrink-0 -ml-[0.5px]"
                        style={{ borderWidth: '0.5px' }}
                      >
                        <Plus className="w-8 h-8" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Meal Entries */}
                  {mealEntries.length > 0 && (
                    <div className="ml-4 space-y-2">
                      {mealEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                              {entry.food.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.weight}г · {Math.round(entry.calories)} ккал
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveEntry(mealType, entry.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Remaining Nutrients Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                ОСТАЛОСЬ
              </h2>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Белки</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {remainingProtein} г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Жиры</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {remainingFat} г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Углеводы</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {remainingCarbs} г
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Калории</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {remainingCalories} ккал
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Water Intake Tracker */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase mb-1">
                  ВОДА
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {dailyMeals?.water || 0} стакан(ов) · {(dailyMeals?.water || 0) * 0.3} л
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
          </div>
        </main>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-[1024px] mx-auto flex items-center justify-between gap-3">
            <button
              onClick={() => setIsBarcodeModalOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ScanLine className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => {
                setSelectedMealType('snack');
                setIsSearchModalOpen(true);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm uppercase hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              ДОБАВИТЬ ПРОДУКТ
            </button>
            <button
              onClick={() => setIsCreateCustomFoodModalOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Camera className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Spacer for bottom bar */}
        <div className="h-20"></div>
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
              onSelect={handleFoodSelect}
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
    </div>
  );
};

export default FoodDiary;
