import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Exercise, WorkoutEntry } from '../types/workout';
import { userExerciseMediaService, type PersistedWorkoutExerciseMediaItem, toUserExerciseMediaErrorMessage } from '../services/userExerciseMediaService';
import { formatWorkoutMetricValue, normalizeWorkoutMetricType } from '../utils/workoutEntryMetric';

export const WORKOUT_EXERCISE_CARD_SUCCESS_MESSAGE = 'Сохранено';

interface WorkoutExerciseCardSheetProps {
  isOpen: boolean;
  entry: WorkoutEntry | null;
  onClose: () => void;
}

export interface WorkoutExerciseCardDraftMediaItem {
  id: string;
  file: File;
  kind: 'image' | 'video';
  label: string;
  previewUrl: string;
}

interface WorkoutExerciseCardViewerItem {
  id: string;
  kind: 'image' | 'video';
  previewUrl: string;
}

function buildTechniqueMuscles(exercise: Exercise | undefined): string[] {
  if (!exercise) return [];
  const mappedMuscles = (exercise.muscles ?? [])
    .map((item) => item.name?.trim())
    .filter((value): value is string => Boolean(value));

  if (mappedMuscles.length > 0) {
    return mappedMuscles;
  }

  return (exercise.primary_muscles ?? []).filter((value): value is string => Boolean(value?.trim()));
}

function renderTechniqueMediaItem(exerciseName: string, mediaItem: NonNullable<Exercise['media']>[number], index: number) {
  if (mediaItem.type === 'video') {
    return (
      <video
        key={`${mediaItem.url}-${index}`}
        src={mediaItem.url}
        controls
        playsInline
        className="h-28 w-full rounded-2xl bg-black object-cover"
        aria-label={`Техника видео ${exerciseName}`}
      />
    );
  }

  return (
    <img
      key={`${mediaItem.url}-${index}`}
      src={mediaItem.url}
      alt={`Техника ${exerciseName}`}
      className="h-28 w-full rounded-2xl bg-gray-100 object-cover"
    />
  );
}

function renderMediaTile(item: WorkoutExerciseCardViewerItem, onOpen?: () => void, onRemove?: () => void) {
  return (
    <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={item.kind === 'video' ? 'Открыть видео упражнения' : 'Открыть фото упражнения'}
          className="block w-full text-left"
        >
          {item.kind === 'video' ? (
            <div className="relative flex h-28 w-full items-center justify-center bg-gray-900 text-white">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
              <div className="relative flex flex-col items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Видео
                </span>
                <span className="text-xs text-white/70">Открыть</span>
              </div>
            </div>
          ) : (
            <img src={item.previewUrl} alt="Медиа упражнения" className="h-28 w-full object-cover" />
          )}
        </button>
        {onRemove ? (
          <button
            type="button"
            aria-label="Удалить черновик"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/75"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function buildWorkoutExerciseCardDraftMediaItems(
  files: File[],
  createObjectUrl: (file: File) => string,
): WorkoutExerciseCardDraftMediaItem[] {
  return files.map((file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    file,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    label: file.name,
    previewUrl: createObjectUrl(file),
  }));
}

export function removeWorkoutExerciseCardDraftMedia(
  items: WorkoutExerciseCardDraftMediaItem[],
  itemId: string,
  revokeObjectUrl?: (url: string) => void,
): WorkoutExerciseCardDraftMediaItem[] {
  const target = items.find((item) => item.id === itemId);
  if (target && revokeObjectUrl) {
    revokeObjectUrl(target.previewUrl);
  }
  return items.filter((item) => item.id !== itemId);
}

export function getWorkoutExerciseCardMediaSectionOrder(hasDraftMedia: boolean, hasPersistedMedia: boolean): Array<'draft' | 'persisted'> {
  const order: Array<'draft' | 'persisted'> = [];

  if (hasDraftMedia) {
    order.push('draft');
  }

  if (hasPersistedMedia) {
    order.push('persisted');
  }

  return order;
}

export function getWorkoutExerciseCardViewerLabel(kind: 'image' | 'video') {
  return kind === 'video' ? 'Открыть видео упражнения' : 'Открыть фото упражнения';
}

const WorkoutExerciseCardSheet = ({ isOpen, entry, onClose }: WorkoutExerciseCardSheetProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftItems, setDraftItems] = useState<WorkoutExerciseCardDraftMediaItem[]>([]);
  const [persistedItems, setPersistedItems] = useState<PersistedWorkoutExerciseMediaItem[]>([]);
  const [isLoadingPersisted, setIsLoadingPersisted] = useState(false);
  const [isSavingPersisted, setIsSavingPersisted] = useState(false);
  const [deletingPersistedMediaId, setDeletingPersistedMediaId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewerItem, setViewerItem] = useState<WorkoutExerciseCardViewerItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setDraftItems((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setPersistedItems([]);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSavingPersisted(false);
      setDeletingPersistedMediaId(null);
      setIsLoadingPersisted(false);
      setViewerItem(null);
      return;
    }

    if (!entry) return;

    let cancelled = false;
    setIsLoadingPersisted(true);
    setErrorMessage(null);

    void userExerciseMediaService
      .listWorkoutExerciseMedia(entry.id)
      .then((items) => {
        if (!cancelled) {
          setPersistedItems(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersistedItems([]);
          setErrorMessage(toUserExerciseMediaErrorMessage('load'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPersisted(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, entry?.id]);

  const hasDraftMedia = draftItems.length > 0;
  const mediaSectionOrder = getWorkoutExerciseCardMediaSectionOrder(draftItems.length > 0, persistedItems.length > 0);

  const techniqueMuscles = useMemo(() => buildTechniqueMuscles(entry?.exercise), [entry?.exercise]);
  const techniqueMedia = useMemo(
    () => entry?.exercise?.media?.slice().sort((left, right) => left.order - right.order) ?? [],
    [entry?.exercise?.media],
  );

  if (!isOpen || !entry) return null;

  const exercise = entry.exercise;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-gray-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700">
            <div className="w-10" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-900 dark:text-white">
              Карточка тренировки
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Закрыть карточку тренировки"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {exercise?.name || 'Упражнение'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {entry.sets} × {entry.reps} × {formatWorkoutMetricValue(entry.displayAmount ?? entry.weight, normalizeWorkoutMetricType(entry.metricType), entry.metricUnit ?? entry.displayUnit)}
              </p>
            </section>

            <section className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-[18px] border border-green-200 bg-green-50/80 px-4 py-3 text-sm font-semibold uppercase text-green-900 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100"
              >
                Загрузить фото/видео
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  if (selected.length === 0) return;
                  setDraftItems((current) => [
                    ...current,
                    ...buildWorkoutExerciseCardDraftMediaItems(selected, (file) => URL.createObjectURL(file)),
                  ]);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  event.currentTarget.value = '';
                }}
              />
            </section>

            <section className="space-y-3">
              <div className="text-sm font-semibold uppercase text-gray-900 dark:text-white">Моя тренировка</div>
              {isLoadingPersisted ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Загрузка медиа...
                </div>
              ) : null}

              {mediaSectionOrder.map((section) => (section === 'draft' ? (
                <div key="draft" className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Новые</div>
                  <div className="grid grid-cols-2 gap-3" data-testid="workout-exercise-card-draft-grid">
                    {draftItems.map((item) => renderMediaTile(item, () => {
                      setViewerItem(item);
                    }, () => {
                      setDraftItems((current) => removeWorkoutExerciseCardDraftMedia(current, item.id, (url) => URL.revokeObjectURL(url)));
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }))}
                  </div>
                </div>
              ) : (
                <div key="persisted" className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Сохранено</div>
                  <div className="grid grid-cols-2 gap-3" data-testid="workout-exercise-card-persisted-grid">
                    {persistedItems.map((item) => renderMediaTile(item, () => {
                      setViewerItem(item);
                    }, () => {
                      if (deletingPersistedMediaId) return;
                      setDeletingPersistedMediaId(item.id);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      void userExerciseMediaService
                        .deleteWorkoutExerciseMedia(item)
                        .then((items) => {
                          setPersistedItems(items);
                        })
                        .catch((error: unknown) => {
                          setErrorMessage(error instanceof Error ? error.message : 'Не удалось удалить файл');
                        })
                        .finally(() => {
                          setDeletingPersistedMediaId(null);
                        });
                    }))}
                  </div>
                </div>
              )))}

              {!isLoadingPersisted && persistedItems.length === 0 && draftItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  Фото и видео для этого упражнения ещё не добавлены.
                </div>
              ) : null}

              {deletingPersistedMediaId ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Удаление...</p>
              ) : null}
              {errorMessage ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
              ) : null}
              {successMessage ? (
                <p className="text-xs text-green-600 dark:text-green-400">{successMessage}</p>
              ) : null}
            </section>

            <section className="space-y-4">
              <div className="text-sm font-semibold uppercase text-gray-900 dark:text-white">Техника</div>

              {techniqueMedia.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {techniqueMedia.map((mediaItem, index) => renderTechniqueMediaItem(exercise?.name || 'Упражнение', mediaItem, index))}
                </div>
              ) : null}

              {exercise?.muscle_map_image_url ? (
                <img
                  src={exercise.muscle_map_image_url}
                  alt={`Карта мышц: ${exercise?.name || 'Упражнение'}`}
                  className="mx-auto max-h-52 rounded-2xl bg-gray-50 object-contain dark:bg-gray-800"
                />
              ) : null}

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">Основные работающие мышцы</div>
                <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                  {techniqueMuscles.length > 0 ? techniqueMuscles.join(', ') : 'Не указаны'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">Описание техники</div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
                  {exercise?.description?.trim() || 'Описание техники пока не заполнено.'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">Рекомендации и ошибки</div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
                  {exercise?.mistakes?.trim() || 'Рекомендации пока не заполнены.'}
                </p>
              </div>
            </section>
          </div>

          <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <button
              type="button"
              disabled={!hasDraftMedia || isSavingPersisted}
              onClick={() => {
                if (!hasDraftMedia || isSavingPersisted) return;
                setIsSavingPersisted(true);
                setErrorMessage(null);
                setSuccessMessage(null);
                void userExerciseMediaService
                  .saveWorkoutExerciseMediaDrafts({
                    exerciseId: entry.exercise_id,
                    workoutEntryId: entry.id,
                    workoutDate: entry.workout_day?.date ?? null,
                    files: draftItems.map((item) => item.file),
                  })
                  .then((items) => {
                    setPersistedItems(items);
                    setDraftItems((current) => {
                      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                      return [];
                    });
                    setSuccessMessage(WORKOUT_EXERCISE_CARD_SUCCESS_MESSAGE);
                  })
                  .catch(() => {
                    setErrorMessage(toUserExerciseMediaErrorMessage('save'));
                    setSuccessMessage(null);
                  })
                  .finally(() => {
                    setIsSavingPersisted(false);
                  });
              }}
              className="w-full rounded-[18px] border-2 border-gray-900 px-4 py-3 text-sm font-semibold uppercase text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 dark:border-white dark:text-white dark:hover:bg-gray-800 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
            >
              {isSavingPersisted ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
      {viewerItem ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 min-[376px]:p-4"
          onClick={() => setViewerItem(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewerItem(null)}
              aria-label="Закрыть просмотр медиа"
              className="absolute right-0 top-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            {viewerItem.kind === 'video' ? (
              <video
                src={viewerItem.previewUrl}
                controls
                playsInline
                className="max-h-[88vh] w-full rounded-2xl bg-black object-contain"
              />
            ) : (
              <img
                src={viewerItem.previewUrl}
                alt="Полноэкранный просмотр медиа упражнения"
                className="max-h-[88vh] w-full rounded-2xl object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default WorkoutExerciseCardSheet;
