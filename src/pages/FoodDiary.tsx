import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, Plus, ScanLine, Camera, Coffee, UtensilsCrossed, Utensils, Apple } from 'lucide-react';

const FoodDiary = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(16);

  // Даты для отображения (15-21 сентября)
  const dates = [
    { day: 15, weekday: 'П' },
    { day: 16, weekday: 'В' },
    { day: 17, weekday: 'С' },
    { day: 18, weekday: 'Ч' },
    { day: 19, weekday: 'П' },
    { day: 20, weekday: 'С' },
    { day: 21, weekday: 'В' },
  ];

  const meals = [
    { id: 'breakfast', name: 'ЗАВТРАК', icon: Coffee },
    { id: 'lunch', name: 'ОБЕД', icon: UtensilsCrossed },
    { id: 'dinner', name: 'УЖИН', icon: Utensils },
    { id: 'snack', name: 'ПЕРЕКУС', icon: Apple },
  ];

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
                СЕНТЯБРЬ
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
                key={date.day}
                onClick={() => setSelectedDate(date.day)}
                className={`flex flex-col items-center justify-center min-w-[50px] h-16 rounded-full transition-colors ${
                  selectedDate === date.day
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-sm font-medium">{date.day}</span>
                <span className={`text-xs ${selectedDate === date.day ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
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
                  <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Жиры</p>
                  <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Углеводы</p>
                  <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Калории</p>
                  <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Meal Entry Sections */}
          <div className="space-y-3 mb-6">
            {meals.map((meal) => (
              <div key={meal.id} className="relative">
                {/* Text "Сохранить как рецепт" above right part */}
                <div className="absolute -top-3 right-16 z-10">
                  <div className="relative">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-900 dark:bg-gray-300"></div>
                    <span className="relative bg-white dark:bg-gray-900 px-2 text-xs text-gray-600 dark:text-gray-400">
                      Сохранить как рецепт
                    </span>
                  </div>
                </div>

                {/* Main container with rounded left and semi-circular right */}
                <div className="flex items-center border border-gray-900 dark:border-gray-300 rounded-[15px] bg-white dark:bg-gray-800 overflow-hidden" style={{ borderWidth: '0.5px' }}>
                  {/* Left part with icon and text */}
                  <div className="flex items-center gap-4 px-4 py-4 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      <meal.icon className="w-7 h-7 text-gray-700 dark:text-gray-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                      {meal.name}
                    </h3>
                  </div>
                  
                  {/* Right part - semi-circular button */}
                  <button className="w-16 self-stretch rounded-r-[15px] rounded-bl-[15px] bg-white dark:bg-white border-t border-r border-b border-gray-900 dark:border-gray-300 text-gray-900 dark:text-gray-900 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors flex-shrink-0 -ml-[0.5px]" style={{ borderWidth: '0.5px' }}>
                    <Plus className="w-8 h-8" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Remaining Nutrients Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                ОСТАЛОСЬ
              </h2>
              <div className="flex gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Белки</p>
                  <div className="w-14 h-3 bg-orange-200 dark:bg-orange-900 rounded-full relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-300">
                      0%
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Жиры</p>
                  <div className="w-14 h-3 bg-yellow-200 dark:bg-yellow-900 rounded-full relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-300">
                      0%
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Углеводы</p>
                  <div className="w-14 h-3 bg-green-200 dark:bg-green-900 rounded-full relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-300">
                      0%
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Калории</p>
                  <div className="w-14 h-3 bg-blue-200 dark:bg-blue-900 rounded-full relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-300">
                      0%
                    </div>
                  </div>
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
                  1 стакан 0,3 мл
                </p>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="w-6 h-8 border-2 border-gray-300 dark:border-gray-600 rounded-b-full"
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-[1024px] mx-auto flex items-center justify-between gap-3">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ScanLine className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <button className="flex-1 py-3 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm uppercase hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
              ДОБАВИТЬ ПРОДУКТ
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Camera className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Spacer for bottom bar */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default FoodDiary;

