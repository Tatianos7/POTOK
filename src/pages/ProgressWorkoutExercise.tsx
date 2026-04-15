import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WorkoutExerciseProgressView from '../components/WorkoutExerciseProgressView';
import type { ExerciseMediaViewerItem } from '../components/ExerciseMediaViewerOverlay';
import { userExerciseMediaService, type PersistedWorkoutExerciseMediaItem } from '../services/userExerciseMediaService';
import { workoutService } from '../services/workoutService';
import {
  applyWorkoutProgressMonthSelection,
  formatWorkoutProgressMonthLabel,
  getWorkoutProgressMonthPeriod,
} from '../utils/workoutProgressPeriod';
import { getLocalDayKey } from '../utils/dayKey';
import { getDefaultWorkoutHistoryRange } from '../utils/workoutHistoryRange';
import {
  buildWorkoutExerciseProgressMetricRows,
  getWorkoutExerciseProgressGroupKey,
  groupWorkoutExerciseProgressMediaByDate,
  type WorkoutExerciseProgressMediaGroup,
  type WorkoutExerciseProgressMetricRow,
} from '../utils/workoutExerciseProgress';

interface ProgressWorkoutExerciseLocationState {
  exerciseName?: string;
  selectedMonthDate?: string;
}

const ProgressWorkoutExercise: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { exerciseGroupKey } = useParams<{ exerciseGroupKey: string }>();
  const { user } = useAuth();
  const defaultDate = getLocalDayKey();
  const locationState = (location.state ?? {}) as ProgressWorkoutExerciseLocationState;
  const range = useMemo(() => getDefaultWorkoutHistoryRange(), []);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(locationState.selectedMonthDate ?? defaultDate);
  const [exerciseName, setExerciseName] = useState(locationState.exerciseName ?? 'Упражнение');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [metricRows, setMetricRows] = useState<WorkoutExerciseProgressMetricRow[]>([]);
  const [mediaGroups, setMediaGroups] = useState<WorkoutExerciseProgressMediaGroup[]>([]);
  const [viewerItem, setViewerItem] = useState<ExerciseMediaViewerItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const period = useMemo(() => getWorkoutProgressMonthPeriod(selectedMonthDate), [selectedMonthDate]);
  const periodLabel = useMemo(() => formatWorkoutProgressMonthLabel(selectedMonthDate), [selectedMonthDate]);

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
    if (!exerciseGroupKey) {
      navigate('/progress/workouts', { replace: true });
    }
  }, [exerciseGroupKey, navigate]);

  useEffect(() => {
    if (!user?.id || !exerciseGroupKey) return;

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void workoutService
      .getWorkoutProgressEntryDetails(user.id, period.from, period.to)
      .then(async (entries) => {
        if (cancelled) return;

        const matchingEntries = entries.filter((entry) => getWorkoutExerciseProgressGroupKey(entry) === exerciseGroupKey);
        const nextMetricRows = buildWorkoutExerciseProgressMetricRows(matchingEntries, exerciseGroupKey);
        const fallbackDatesByWorkoutEntryId = new Map(
          matchingEntries
            .filter((entry): entry is typeof entry & { workout_day: { date: string } } => Boolean(entry.workout_day?.date))
            .map((entry) => [entry.id, entry.workout_day.date]),
        );

        setMetricRows(nextMetricRows);
        if (nextMetricRows[0]?.exerciseName) {
          setExerciseName(nextMetricRows[0].exerciseName);
        }

        if (matchingEntries.length === 0) {
          setMediaGroups([]);
          return;
        }

        try {
          const items = await userExerciseMediaService.listWorkoutExerciseMediaForEntries(
            matchingEntries.map((entry) => entry.id),
          );
          if (cancelled) return;

          setMediaGroups(groupWorkoutExerciseProgressMediaByDate(items, fallbackDatesByWorkoutEntryId));
        } catch {
          if (!cancelled) {
            setMediaGroups([]);
            setErrorMessage('Не удалось загрузить медиа упражнения');
          }
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[ProgressWorkoutExercise] load failed', error);
        setMetricRows([]);
        setMediaGroups([]);
        setErrorMessage('Не удалось загрузить прогресс упражнения');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseGroupKey, period.from, period.to, user?.id]);

  return (
    <WorkoutExerciseProgressView
      exerciseName={exerciseName}
      periodLabel={periodLabel}
      selectedMonthDate={selectedMonthDate}
      minDate={range.from}
      maxDate={range.to}
      isCalendarOpen={isCalendarOpen}
      isLoading={isLoading}
      errorMessage={errorMessage}
      metricRows={metricRows}
      mediaGroups={mediaGroups}
      viewerItem={viewerItem}
      onClose={() => navigate('/progress/workouts', { state: { selectedMonthDate } })}
      onToggleCalendar={() => setIsCalendarOpen((current) => !current)}
      onMonthSelect={(date) => {
        const next = applyWorkoutProgressMonthSelection(date);
        setSelectedMonthDate(next.selectedMonthDate);
        setIsCalendarOpen(next.isCalendarOpen);
      }}
      pickerRef={pickerRef}
      onOpenMedia={(item: PersistedWorkoutExerciseMediaItem) => setViewerItem(item)}
      onCloseViewer={() => setViewerItem(null)}
    />
  );
};

export default ProgressWorkoutExercise;
