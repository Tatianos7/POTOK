import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { Calendar, ChevronUp, ChevronDown, X } from 'lucide-react';
import InlineCalendar from '../components/InlineCalendar';
import RepeatWorkoutModal from '../components/RepeatWorkoutModal';
import { workoutService } from '../services/workoutService';
import type { WorkoutEntry } from '../types/workout';
import WorkoutHistoryDayDetails from '../components/WorkoutHistoryDayDetails';
import { getDefaultWorkoutHistoryRange } from '../utils/workoutHistoryRange';
import {
  applyWorkoutHistoryDateSelection,
  shouldShowWorkoutHistoryRepeatButton,
  toggleWorkoutHistoryCalendar,
} from '../utils/workoutHistoryUi';
import { runRepeatWorkoutCopy } from '../utils/repeatWorkoutFlow';
import { spacing, typography, colors } from '../ui/theme/tokens';
import { WORKOUT_SCREEN_BACKGROUND } from '../utils/workoutLayout';

const WorkoutHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const range = useMemo(() => getDefaultWorkoutHistoryRange(), []);
  const [selectedDate, setSelectedDate] = useState<string>(range.to);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatSelectedDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return `${day} ${months[month - 1]} ${year}`;
  };

  useEffect(() => {
    if (!user?.id) return;

    setIsLoadingDay(true);
    setErrorMessage(null);

    workoutService
      .getWorkoutEntriesPersisted(user.id, selectedDate)
      .then((nextEntries) => {
        setEntries(nextEntries);
      })
      .catch((error: any) => {
        console.error('Ошибка загрузки деталей тренировки:', error);
        setEntries([]);
        setErrorMessage(error?.message || 'Не удалось загрузить тренировку за выбранный день');
      })
      .finally(() => setIsLoadingDay(false));
  }, [user?.id, selectedDate]);

  return (
    <ScreenContainer backgroundColor={WORKOUT_SCREEN_BACKGROUND}>
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>
          История тренировок
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/workouts')} aria-label="Закрыть">
          <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 space-y-4" style={{ paddingBottom: spacing.lg }}>
        <div className="relative rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setIsCalendarOpen((current) => toggleWorkoutHistoryCalendar(current))}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={isCalendarOpen}
            aria-label="Выбрать дату истории тренировок"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Выбрать дату
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatSelectedDate(selectedDate)}
                </div>
              </div>
            </div>
            {isCalendarOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {isCalendarOpen ? (
            <div className="mt-4">
              <InlineCalendar
                selectedDate={selectedDate}
                onDateSelect={(date) => {
                  const next = applyWorkoutHistoryDateSelection(date);
                  setSelectedDate(next.selectedDate);
                  setIsCalendarOpen(next.isCalendarOpen);
                }}
                onClose={() => setIsCalendarOpen(false)}
                minDate={range.from}
                maxDate={range.to}
              />
            </div>
          ) : null}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="text-sm text-gray-900 dark:text-white">{formatSelectedDate(selectedDate)}</div>

        <WorkoutHistoryDayDetails
          date={selectedDate}
          entries={entries}
          isLoading={isLoadingDay}
        />
        {shouldShowWorkoutHistoryRepeatButton(entries.length, isLoadingDay) ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-base font-semibold uppercase text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              aria-label="Повторить тренировку"
              onClick={() => setIsRepeatModalOpen(true)}
            >
              Повторить
            </button>
          </div>
        ) : null}
      </main>

      <RepeatWorkoutModal
        isOpen={isRepeatModalOpen}
        sourceDate={selectedDate}
        entries={entries}
        isSubmitting={isRepeating}
        onClose={() => {
          if (isRepeating) return;
          setIsRepeatModalOpen(false);
        }}
        onConfirm={async (targetDate, exerciseIds) => {
          if (!user?.id) {
            throw new Error('Пользователь не авторизован');
          }

          setIsRepeating(true);
          try {
            const result = await runRepeatWorkoutCopy({
              copyWorkoutEntriesToDate: workoutService.copyWorkoutEntriesToDate.bind(workoutService),
              userId: user.id,
              sourceDate: selectedDate,
              targetDate,
              exerciseIds,
            });
            alert(result.successMessage);
            navigate('/workouts', { state: { selectedDate: result.selectedDate } });
          } catch (error: any) {
            const message = error?.message || 'Не удалось повторить тренировку';
            setErrorMessage(message);
            throw error;
          } finally {
            setIsRepeating(false);
          }
        }}
      />
    </ScreenContainer>
  );
};

export default WorkoutHistory;
