import type { RefObject } from 'react';
import { Calendar, ChevronDown, ChevronUp, X } from 'lucide-react';
import WorkoutProgressMonthPicker from './WorkoutProgressMonthPicker';
import ExerciseMediaViewerOverlay, { type ExerciseMediaViewerItem } from './ExerciseMediaViewerOverlay';
import type { PersistedWorkoutExerciseMediaItem } from '../services/userExerciseMediaService';
import type { WorkoutExerciseProgressMediaGroup, WorkoutExerciseProgressMetricRow } from '../utils/workoutExerciseProgress';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import ScreenContainer from '../ui/components/ScreenContainer';
import { WORKOUT_SCREEN_BACKGROUND } from '../utils/workoutLayout';

interface WorkoutExerciseProgressViewProps {
  exerciseName: string;
  periodLabel: string;
  selectedMonthDate: string;
  minDate: string;
  maxDate: string;
  isCalendarOpen: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  metricRows: WorkoutExerciseProgressMetricRow[];
  mediaGroups: WorkoutExerciseProgressMediaGroup[];
  viewerItem: ExerciseMediaViewerItem | null;
  onClose: () => void;
  onToggleCalendar: () => void;
  onMonthSelect: (date: string) => void;
  pickerRef: RefObject<HTMLDivElement>;
  onOpenMedia: (item: PersistedWorkoutExerciseMediaItem) => void;
  onCloseViewer: () => void;
}

function formatProgressDateLabel(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}.${month}.${year}`;
}

function renderProgressMediaTile(
  item: PersistedWorkoutExerciseMediaItem,
  onOpenMedia: (item: PersistedWorkoutExerciseMediaItem) => void,
) {
  return (
    <button
      key={item.id}
      type="button"
      onClick={() => onOpenMedia(item)}
      aria-label={item.kind === 'video' ? 'Открыть видео прогресса упражнения' : 'Открыть фото прогресса упражнения'}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-left"
    >
      {item.kind === 'video' ? (
        <div className="relative flex h-24 w-full items-center justify-center bg-gray-900 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
          <div className="relative flex flex-col items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Видео
            </span>
            <span className="text-xs text-white/70">Открыть</span>
          </div>
        </div>
      ) : (
        <img src={item.previewUrl} alt="Медиа прогресса упражнения" className="h-24 w-full object-cover" />
      )}
    </button>
  );
}

const WorkoutExerciseProgressView = ({
  exerciseName,
  periodLabel,
  selectedMonthDate,
  minDate,
  maxDate,
  isCalendarOpen,
  isLoading,
  errorMessage,
  metricRows,
  mediaGroups,
  viewerItem,
  onClose,
  onToggleCalendar,
  onMonthSelect,
  pickerRef,
  onOpenMedia,
  onCloseViewer,
}: WorkoutExerciseProgressViewProps) => (
  <ScreenContainer backgroundColor={WORKOUT_SCREEN_BACKGROUND}>
    <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
      <div style={{ width: 32 }} />
      <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>
        Прогресс упражнения
      </h1>
      <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть прогресс упражнения">
        <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
      </Button>
    </header>

    <main className="flex-1 overflow-y-auto min-h-0 space-y-4" style={{ paddingBottom: spacing.lg }}>
      <div ref={pickerRef} className="relative bg-white px-1 py-2">
        <button
          type="button"
          onClick={onToggleCalendar}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={isCalendarOpen}
          aria-label="Выбрать период прогресса упражнения"
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
            onMonthSelect={onMonthSelect}
            minDate={minDate}
            maxDate={maxDate}
          />
        ) : null}
      </div>

      <section className="space-y-2 bg-white px-1 py-1">
        <div className="text-lg font-semibold text-gray-900">{exerciseName}</div>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="bg-white px-1">
        <div className="mb-2 grid grid-cols-[84px_56px_56px_minmax(0,1fr)] gap-0 text-[12px] italic text-gray-700">
          <div className="pr-3 font-medium">Дата</div>
          <div className="flex items-center justify-center text-center font-medium">Подход</div>
          <div className="flex items-center justify-center text-center font-medium">Повтор</div>
          <div className="flex items-center justify-center text-center font-medium">Метрика</div>
        </div>

        {isLoading ? (
          <div className="py-6 text-sm text-gray-500">Загружаем прогресс упражнения...</div>
        ) : metricRows.length === 0 ? (
          <div className="py-6 text-sm text-gray-500">За выбранный месяц нет данных по этому упражнению</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {metricRows.map((row) => (
              <div key={row.date} className="grid grid-cols-[84px_56px_56px_minmax(0,1fr)] gap-0">
                <div className="py-4 pr-2 text-[14px] text-gray-700">{formatProgressDateLabel(row.date)}</div>
                <div className="flex min-h-[52px] items-center justify-center border-l border-gray-200 px-1 text-[14px] text-gray-900">
                  {row.sets}
                </div>
                <div className="flex min-h-[52px] items-center justify-center border-l border-gray-200 px-1 text-[14px] text-gray-900">
                  {row.reps}
                </div>
                <div className="flex min-h-[52px] items-center border-l border-gray-200 px-2 text-[14px] text-gray-900">
                  {row.metricValueLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 bg-white px-1 py-1">
        <div className="text-sm font-semibold uppercase text-gray-900">Фото/видео</div>

        {mediaGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            За выбранный месяц для этого упражнения нет фото или видео.
          </div>
        ) : (
          <div className="space-y-4">
            {mediaGroups.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="text-[13px] font-semibold text-gray-700">{formatProgressDateLabel(group.date)}</div>
                <div className="grid grid-cols-3 gap-3" data-testid={`progress-exercise-media-group-${group.date}`}>
                  {group.items.map((item) => renderProgressMediaTile(item, onOpenMedia))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>

    <ExerciseMediaViewerOverlay item={viewerItem} onClose={onCloseViewer} />
  </ScreenContainer>
);

export default WorkoutExerciseProgressView;
