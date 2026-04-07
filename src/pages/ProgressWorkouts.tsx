import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WorkoutProgressMonthPicker from '../components/WorkoutProgressMonthPicker';
import WorkoutProgressList from '../components/WorkoutProgressList';
import { workoutService } from '../services/workoutService';
import type { WorkoutProgressRow } from '../types/workout';
import { buildWorkoutProgressList } from '../utils/workoutProgress';
import {
  applyWorkoutProgressMonthSelection,
  formatWorkoutProgressMonthLabel,
  getWorkoutProgressMonthPeriod,
} from '../utils/workoutProgressPeriod';
import { getLocalDayKey } from '../utils/dayKey';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { WORKOUT_SCREEN_BACKGROUND } from '../utils/workoutLayout';
import { getDefaultWorkoutHistoryRange } from '../utils/workoutHistoryRange';

const ProgressWorkouts: FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultDate = getLocalDayKey();
  const range = useMemo(() => getDefaultWorkoutHistoryRange(), []);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(defaultDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [rows, setRows] = useState<WorkoutProgressRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const period = useMemo(() => getWorkoutProgressMonthPeriod(selectedMonthDate), [selectedMonthDate]);
  const periodLabel = useMemo(() => formatWorkoutProgressMonthLabel(selectedMonthDate), [selectedMonthDate]);
  const trendHistoryStart = '1900-01-01';

  useEffect(() => {
    if (!isCalendarOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCalendarOpen]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    Promise.all([
      workoutService.getWorkoutProgressObservations(user.id, period.from, period.to),
      workoutService.getWorkoutProgressObservations(user.id, trendHistoryStart, period.to),
    ])
      .then(([displayObservations, trendHistoryObservations]) => {
        if (!isMounted) return;
        setRows(buildWorkoutProgressList(displayObservations, trendHistoryObservations));
      })
      .catch((error: any) => {
        if (!isMounted) return;
        console.error('[ProgressWorkouts] load failed', error);
        setRows([]);
        setErrorMessage(error?.message || 'Не удалось загрузить прогресс тренировок');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [period.from, period.to, user?.id]);

  return (
    <ScreenContainer backgroundColor={WORKOUT_SCREEN_BACKGROUND}>
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>
          Прогресс тренировок
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/progress')} aria-label="Закрыть">
          <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 space-y-3" style={{ paddingBottom: spacing.lg }}>
        <div ref={pickerRef} className="relative bg-white px-1 py-2">
          <button
            type="button"
            onClick={() => setIsCalendarOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={isCalendarOpen}
            aria-label="Выбрать период прогресса тренировок"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-[15px] font-medium text-gray-800">Выбрать период</div>
                <div className="text-[12px] capitalize text-gray-500">{periodLabel}</div>
              </div>
            </div>
            {isCalendarOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {isCalendarOpen ? (
            <WorkoutProgressMonthPicker
              selectedMonthDate={selectedMonthDate}
              onMonthSelect={(date) => {
                const next = applyWorkoutProgressMonthSelection(date);
                setSelectedMonthDate(next.selectedMonthDate);
                setIsCalendarOpen(next.isCalendarOpen);
              }}
              minDate={range.from}
              maxDate={range.to}
            />
          ) : null}
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <WorkoutProgressList rows={rows} isLoading={isLoading} />
      </main>
    </ScreenContainer>
  );
};

export default ProgressWorkouts;
