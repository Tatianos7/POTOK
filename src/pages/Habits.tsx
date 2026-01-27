import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Check, Circle, Calendar } from 'lucide-react';
import { createHabit, toggleHabitComplete, HabitWithStatus, HabitFrequency } from '../services/habitsService';
import { supabase } from '../lib/supabaseClient';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import ExplainabilityDrawer from '../components/ExplainabilityDrawer';
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';

const Habits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<HabitFrequency>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);
  const [habitStats, setHabitStats] = useState<Record<string, { streak: number; adherence: number }>>({});

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    loadHabits();
  }, [user, selectedDate, navigate]);

  const loadHabits = async () => {
    if (!user?.id || !supabase) return;
    setIsLoading(true);
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Habits', {
      pendingSources: ['habits', 'habit_logs'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка привычек заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getHabitsState(user.id, selectedDate);
      setRuntimeStatus(state.status);
      setHabits(state.habits || []);
      setExplainability(state.explainability ?? null);
      setTrustMessage(state.trust?.message ?? null);
      setHabitStats(state.habitStats || {});
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить привычки.');
      }
    } catch (error) {
      console.error('Error loading habits:', error);
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить привычки.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Habits');
      setIsLoading(false);
    }
  };

  const handleCreateHabit = async () => {
    if (!user?.id || !newHabitTitle.trim()) return;

    setIsLoading(true);
    try {
      const habit = await createHabit({
        userId: user.id,
        title: newHabitTitle.trim(),
        description: newHabitDescription.trim() || undefined,
        frequency: newHabitFrequency,
      });

      if (habit) {
        setNewHabitTitle('');
        setNewHabitDescription('');
        setNewHabitFrequency('daily');
        setIsCreateModalOpen(false);
        await loadHabits();
      }
    } catch (error) {
      console.error('Error creating habit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      await toggleHabitComplete({
        userId: user.id,
        habitId,
        date: selectedDate,
      });
      await loadHabits();
    } catch (error) {
      console.error('Error toggling habit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Сегодня';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Вчера';
    } else if (dateString === tomorrow.toISOString().split('T')[0]) {
      return 'Завтра';
    }

    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'long' });
    return `${day} ${month}`;
  };

  if (!supabase) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
        <div className="max-w-[768px] mx-auto w-full flex flex-col h-full items-center justify-center px-4">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            Supabase не настроен. Настройте переменные окружения для работы с привычками.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            ПРИВЫЧКИ
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
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 px-4 py-6">
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex flex-col gap-2 mobile-lg:flex-row mobile-lg:items-center mobile-lg:justify-between">
                <span>{errorMessage}</span>
                {trustMessage && (
                  <span className="text-xs text-red-700 dark:text-red-200">{trustMessage}</span>
                )}
                <button
                  onClick={() => {
                    uiRuntimeAdapter.recover().finally(loadHabits);
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/50"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
          {runtimeStatus === 'offline' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Работаем офлайн. Данные могут быть неактуальны.
              <button
                onClick={() => {
                  uiRuntimeAdapter.revalidate().finally(loadHabits);
                }}
                className="ml-3 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Обновить
              </button>
            </div>
          )}
          {runtimeStatus === 'recovery' && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Идёт восстановление данных. Продолжаем безопасно.
            </div>
          )}
          {runtimeStatus === 'partial' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Данные доступны частично. Мы показываем то, что уже есть.
            </div>
          )}
          {explainability && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              Доступно объяснение: «Почему так?»
            </div>
          )}
          {/* Date Selector */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => handleDateChange(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Предыдущий день"
            >
              <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="text-center">
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {formatDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={() => handleDateChange(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Следующий день"
            >
              <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-300 rotate-180" />
            </button>
          </div>

          {/* Habits List */}
          {isLoading && habits.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                У вас пока нет привычек
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium"
              >
                Создать первую привычку
              </button>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                      {habit.title}
                    </h3>
                    {habit.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {habit.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {habit.frequency === 'daily' ? 'Ежедневно' : 'Еженедельно'}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>Стрик: {habitStats[habit.id]?.streak ?? 0}</span>
                      <span>•</span>
                      <span>Устойчивость: {Math.round((habitStats[habit.id]?.adherence ?? 0) * 100)}%</span>
                    </div>
                    {!habit.completed && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Срыв — не провал. Давайте вернёмся спокойно.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleHabit(habit.id)}
                    disabled={isLoading}
                    className={`ml-4 p-2 rounded-lg transition-colors ${
                      habit.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                    aria-label={habit.completed ? 'Отметить как невыполненное' : 'Отметить как выполненное'}
                  >
                    {habit.completed ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create Habit Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isLoading}
            style={{ height: '45px', minHeight: '45px', maxHeight: '45px', boxSizing: 'border-box' }}
            className="w-full max-w-full min-[768px]:button-limited px-2.5 flex items-center justify-center rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5 mr-2" />
            СОЗДАТЬ ПРИВЫЧКУ
          </button>
          <div className="mt-6">
            <ExplainabilityDrawer explainability={explainability} />
          </div>
        </main>
      </div>

      {/* Create Habit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full max-w-[768px] mx-auto bg-white dark:bg-gray-900 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Создать привычку
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Название *
                </label>
                <input
                  type="text"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder="Например: Пить воду"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Описание (необязательно)
                </label>
                <textarea
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  placeholder="Добавьте описание..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Частота
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewHabitFrequency('daily')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${
                      newHabitFrequency === 'daily'
                        ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Ежедневно
                  </button>
                  <button
                    onClick={() => setNewHabitFrequency('weekly')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${
                      newHabitFrequency === 'weekly'
                        ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Еженедельно
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateHabit}
                  disabled={!newHabitTitle.trim() || isLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Habits;

