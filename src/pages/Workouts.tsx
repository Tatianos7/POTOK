import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Edit, Trash2, Clock, Plus, CheckCircle } from 'lucide-react';
import InlineCalendar from '../components/InlineCalendar';
import ExerciseCategorySheet from '../components/ExerciseCategorySheet';
import ExerciseListSheet from '../components/ExerciseListSheet';
import SelectedExercisesEditor from '../components/SelectedExercisesEditor';
import WorkoutEntryCard from '../components/WorkoutEntryCard';
import CreateExerciseModal from '../components/CreateExerciseModal';
import { exerciseService } from '../services/exerciseService';
import { workoutService } from '../services/workoutService';
import { ExerciseCategory, Exercise, SelectedExercise, WorkoutEntry } from '../types/workout';
import '../utils/checkExercisesData'; // Импортируем для доступа через window

const Workouts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isExerciseCategorySheetOpen, setIsExerciseCategorySheetOpen] = useState(false);
  const [isExerciseListSheetOpen, setIsExerciseListSheetOpen] = useState(false);
  const [isSelectedExercisesEditorOpen, setIsSelectedExercisesEditorOpen] = useState(false);
  const [isCreateExerciseModalOpen, setIsCreateExerciseModalOpen] = useState(false);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Утилита для добавления дней к дате в формате YYYY-MM-DD
  const addDaysToString = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
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

  // Форматирование выбранной даты для отображения
  const formatSelectedDate = (): string => {
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

  // Инициализация: при первом рендере выбираем сегодняшнюю дату
  useEffect(() => {
    const currentToday = getTodayDate();
    setSelectedDate(currentToday);
  }, []); // Выполняем только при монтировании компонента

  // Загружаем категории при монтировании (с автоматической инициализацией)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        let cats = await exerciseService.getCategories();
        
        // Если категорий нет, пытаемся инициализировать данные
        if (cats.length === 0) {
          const { initializeExerciseData } = await import('../utils/initializeExerciseData');
          await initializeExerciseData();
          // Повторно загружаем категории после инициализации
          cats = await exerciseService.getCategories();
        }
        
        setCategories(cats);
      } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
      }
    };
    loadCategories();
  }, []);

  // Загружаем упражнения тренировки при изменении даты
  useEffect(() => {
    if (!user?.id) return;

    const loadWorkoutEntries = async () => {
      setIsLoading(true);
      try {
        const entries = await workoutService.getWorkoutEntries(user.id, selectedDate);
        setWorkoutEntries(entries);
      } catch (error) {
        console.error('Ошибка загрузки записей тренировки:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkoutEntries();
  }, [user?.id, selectedDate]);

  // Закрытие календаря при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCalendarOpen]);


  const handleClose = () => {
    navigate('/');
  };

  const handleEditWorkout = () => {
    // TODO: Реализовать редактирование тренировки
    console.log('Редактировать тренировку');
  };

  const handleDeleteWorkout = () => {
    // TODO: Реализовать удаление тренировки
    console.log('Удалить тренировку');
  };


  const handleAdd = () => {
    setIsExerciseCategorySheetOpen(true);
  };

  const handleCategorySelect = async (category: ExerciseCategory) => {
    setSelectedCategory(category);
    setIsExerciseCategorySheetOpen(false);
    setIsLoading(true);
    
    try {
      const exs = await exerciseService.getExercisesByCategory(category.id, user?.id);
      setExercises(exs);
      setIsExerciseListSheetOpen(true);
    } catch (error) {
      console.error('Ошибка загрузки упражнений:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExercisesSelect = (selected: Exercise[]) => {
    setSelectedExercises(selected);
    setIsExerciseListSheetOpen(false);
    setIsSelectedExercisesEditorOpen(true);
  };

  const handleSaveSelectedExercises = async (exercises: SelectedExercise[]) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      await workoutService.addExercisesToWorkout(user.id, selectedDate, exercises);
      
      // Перезагружаем записи тренировки
      const entries = await workoutService.getWorkoutEntries(user.id, selectedDate);
      setWorkoutEntries(entries);
      
      setIsSelectedExercisesEditorOpen(false);
      setSelectedExercises([]);
    } catch (error) {
      console.error('Ошибка сохранения упражнений:', error);
      alert('Ошибка при сохранении упражнений');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Удалить это упражнение из тренировки?')) return;

    try {
      await workoutService.deleteWorkoutEntry(entryId);
      
      // Перезагружаем записи
      if (user?.id) {
        const entries = await workoutService.getWorkoutEntries(user.id, selectedDate);
        setWorkoutEntries(entries);
      }
    } catch (error) {
      console.error('Ошибка удаления записи:', error);
      alert('Ошибка при удалении упражнения');
    }
  };

  const handleHistory = () => {
    // TODO: Реализовать переход на историю
    console.log('История');
  };

  const handleSchedule = () => {
    // TODO: Реализовать планирование тренировки
    console.log('Запланировать');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden w-full min-w-[320px] max-w-full overflow-x-hidden">
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full max-w-full overflow-hidden">
        {/* Header */}
        <header className="px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0 w-full max-w-full overflow-hidden">
          <div className="flex-1"></div>
          <h1 className="text-base min-[376px]:text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            ДНЕВНИК ТРЕНИРОВОК
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 w-full max-w-full">
          {/* Calendar Section */}
          <div className="mb-4 min-[376px]:mb-6 w-full max-w-full">
            {/* Month */}
            <div className="flex items-center justify-between mb-4 min-[376px]:mb-6">
              <div className="relative flex flex-col gap-1 w-full z-10">
                <button 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity w-fit"
                >
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatSelectedDate()}
                  </span>
                </button>
                
                {/* Календарь поверх контента */}
                <div
                  ref={calendarRef}
                  className={`absolute top-full left-0 right-0 mt-2 z-50 transition-all duration-300 ease-in-out ${
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

            {/* Week Calendar */}
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
          </div>

          {/* Workout Section */}
          <div className="mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between mb-3 min-[376px]:mb-4 w-full max-w-full">
              <h2 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white">
                Моя тренировка
              </h2>
              <div className="flex items-center gap-2 min-[376px]:gap-3">
                <button
                  onClick={handleEditWorkout}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Редактировать"
                >
                  <Edit className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={handleDeleteWorkout}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            {/* Table Headers */}
            <div className="grid grid-cols-4 gap-2 min-[376px]:gap-4 mb-3 min-[376px]:mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 w-full max-w-full">
              <div className="text-xs min-[376px]:text-sm font-semibold text-gray-700 dark:text-gray-300 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                Упражнение
              </div>
              <div className="text-xs min-[376px]:text-sm font-semibold text-gray-700 dark:text-gray-300 text-center break-words overflow-wrap-anywhere">
                Подходы
              </div>
              <div className="text-xs min-[376px]:text-sm font-semibold text-gray-700 dark:text-gray-300 text-center break-words overflow-wrap-anywhere">
                Повторы
              </div>
              <div className="text-xs min-[376px]:text-sm font-semibold text-gray-700 dark:text-gray-300 text-center break-words overflow-wrap-anywhere">
                Вес
              </div>
            </div>

            {/* Workout Entries */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12 min-[376px]:py-16 w-full max-w-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            ) : workoutEntries.length === 0 ? (
              <div className="flex items-center justify-center py-12 min-[376px]:py-16 w-full max-w-full">
                <p className="text-sm min-[376px]:text-base text-gray-500 dark:text-gray-400 text-center break-words overflow-wrap-anywhere">
                  Здесь будет ваша тренировка....
                </p>
              </div>
            ) : (
              <div className="space-y-3 min-[376px]:space-y-4">
                {workoutEntries.map((entry) => (
                  <WorkoutEntryCard
                    key={entry.id}
                    entry={entry}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-around px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 w-full max-w-full">
            <button
              onClick={handleHistory}
              className="flex flex-col items-center justify-center gap-1 min-[376px]:gap-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex-1 min-w-0"
            >
              <div className="relative flex items-center justify-center">
                <Clock className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6" />
                <Calendar className="w-3 h-3 min-[376px]:w-4 min-[376px]:h-4 absolute -bottom-0.5 -right-0.5 bg-white dark:bg-gray-900 rounded-full p-0.5" />
              </div>
              <span className="text-[10px] min-[376px]:text-xs font-medium uppercase break-words overflow-wrap-anywhere">
                ИСТОРИЯ
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="flex flex-col items-center justify-center gap-1 min-[376px]:gap-1.5 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-1 min-w-0"
            >
              <div className="w-10 h-10 min-[376px]:w-12 min-[376px]:h-12 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center">
                <Plus className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6" />
              </div>
              <span className="text-[10px] min-[376px]:text-xs font-medium uppercase break-words overflow-wrap-anywhere">
                ДОБАВИТЬ
              </span>
            </button>
            <button
              onClick={handleSchedule}
              className="flex flex-col items-center justify-center gap-1 min-[376px]:gap-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex-1 min-w-0"
            >
              <CheckCircle className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6" />
              <span className="text-[10px] min-[376px]:text-xs font-medium uppercase break-words overflow-wrap-anywhere">
                ЗАПЛАНИРОВАТЬ
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Category Sheet */}
      <ExerciseCategorySheet
        isOpen={isExerciseCategorySheetOpen}
        onClose={() => setIsExerciseCategorySheetOpen(false)}
        categories={categories}
        onCategorySelect={handleCategorySelect}
        onCreateExercise={() => {
          setIsExerciseCategorySheetOpen(false);
          setIsCreateExerciseModalOpen(true);
        }}
      />

      {/* Create Exercise Modal */}
      {user?.id && (
        <CreateExerciseModal
          isOpen={isCreateExerciseModalOpen}
          onClose={() => setIsCreateExerciseModalOpen(false)}
          onExerciseCreated={async () => {
            // Перезагружаем категории и упражнения
            const cats = await exerciseService.getCategories();
            setCategories(cats);
            if (selectedCategory) {
              const exs = await exerciseService.getExercisesByCategory(selectedCategory.id, user.id);
              setExercises(exs);
            }
          }}
          userId={user.id}
        />
      )}

      {/* Exercise List Sheet */}
      <ExerciseListSheet
        isOpen={isExerciseListSheetOpen}
        onClose={() => {
          setIsExerciseListSheetOpen(false);
          setSelectedCategory(null);
          setExercises([]);
        }}
        category={selectedCategory}
        exercises={exercises}
        onExercisesSelect={handleExercisesSelect}
      />

      {/* Selected Exercises Editor */}
      <SelectedExercisesEditor
        isOpen={isSelectedExercisesEditorOpen}
        onClose={() => {
          setIsSelectedExercisesEditorOpen(false);
          setSelectedExercises([]);
        }}
        exercises={selectedExercises}
        onSave={handleSaveSelectedExercises}
      />
    </div>
  );
};

export default Workouts;

