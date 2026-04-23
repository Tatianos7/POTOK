import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Play,
  Shield,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import type { Exercise, WorkoutEntry } from '../types/workout';
import { userExerciseMediaService, type PersistedWorkoutExerciseMediaItem, toUserExerciseMediaErrorMessage } from '../services/userExerciseMediaService';
import { formatWorkoutMetricValue, normalizeWorkoutMetricType } from '../utils/workoutEntryMetric';
import { lookupExerciseContent } from '../utils/exerciseContentLookup';
import { getMuscleLabel } from '../utils/muscleLabels';
import ExerciseMediaViewerOverlay, { type ExerciseMediaViewerItem } from './ExerciseMediaViewerOverlay';

export const WORKOUT_EXERCISE_CARD_SUCCESS_MESSAGE = 'Сохранено';
const WORKOUT_EXERCISE_CARD_ANIMATION_MS = 180;
const SECTION_ICON_CLASS = 'h-4 w-4';
const SECTION_HEADING_ROW_CLASS = 'flex items-center gap-2';
const ICON_COLORS = {
  technique: 'text-violet-500 dark:text-violet-400',
  primary: 'text-amber-500 dark:text-amber-400',
  secondary: 'text-slate-500 dark:text-slate-400',
  start: 'text-cyan-500 dark:text-cyan-400',
  execution: 'text-indigo-500 dark:text-indigo-400',
  top: 'text-emerald-500 dark:text-emerald-400',
  return: 'text-orange-500 dark:text-orange-400',
  breathing: 'text-blue-500 dark:text-blue-400',
  safety: 'text-green-500 dark:text-green-400',
  mistakes: 'text-red-500 dark:text-red-400',
} as const;

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

function renderMediaTile(item: ExerciseMediaViewerItem, onOpen?: () => void, onRemove?: () => void) {
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
  const [viewerItem, setViewerItem] = useState<ExerciseMediaViewerItem | null>(null);
  const [isTechniqueExpanded, setIsTechniqueExpanded] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [renderEntry, setRenderEntry] = useState<WorkoutEntry | null>(entry);

  useEffect(() => {
    let openFrame = 0;
    let closeTimer: number | null = null;

    if (isOpen && entry) {
      setRenderEntry(entry);
      setIsRendered(true);
      openFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      closeTimer = window.setTimeout(() => {
        setIsRendered(false);
        setRenderEntry(null);
      }, WORKOUT_EXERCISE_CARD_ANIMATION_MS);
    }

    return () => {
      window.cancelAnimationFrame(openFrame);
      if (closeTimer) {
        window.clearTimeout(closeTimer);
      }
    };
  }, [entry, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isRendered) {
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
      setIsTechniqueExpanded(false);
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
  }, [entry?.id, isOpen, isRendered]);

  const hasDraftMedia = draftItems.length > 0;
  const mediaSectionOrder = getWorkoutExerciseCardMediaSectionOrder(draftItems.length > 0, persistedItems.length > 0);

  const techniqueMedia = useMemo(
    () => renderEntry?.exercise?.media?.slice().sort((left, right) => left.order - right.order) ?? [],
    [renderEntry?.exercise?.media],
  );
  const isUserCreatedExercise = renderEntry?.exercise?.is_custom === true;
  const techniqueContent = useMemo(() => {
    if (isUserCreatedExercise) return undefined;

    return lookupExerciseContent({
      exerciseId: renderEntry?.exercise_id ?? renderEntry?.exercise?.id,
      exerciseName: renderEntry?.exercise?.name,
    });
  }, [isUserCreatedExercise, renderEntry?.exercise?.id, renderEntry?.exercise?.name, renderEntry?.exercise_id]);

  if (!isRendered || !renderEntry) return null;

  const exercise = renderEntry.exercise;
  const primaryMuscles = techniqueContent
    ? techniqueContent.primary_muscles
    : buildTechniqueMuscles(exercise);
  const secondaryMuscles = techniqueContent
    ? techniqueContent.secondary_muscles
    : (exercise?.secondary_muscles ?? []).filter((value): value is string => Boolean(value?.trim()));
  const techniqueSections = [
    { label: 'Исходное положение', value: techniqueContent?.start_position },
    { label: 'Выполнение', value: techniqueContent?.execution },
    { label: 'Верхняя точка', value: techniqueContent?.top_position },
    { label: 'Возврат', value: techniqueContent?.return_phase },
    { label: 'Дыхание', value: techniqueContent?.breathing },
    { label: 'Безопасность', value: techniqueContent?.safety },
  ].filter((section) => Boolean(section.value?.trim()));
  const techniqueMistakes = techniqueContent?.mistakes?.filter((item) => Boolean(item.trim())) ?? [];
  const hasStructuredTechniqueText = techniqueSections.length > 0 || techniqueMistakes.length > 0;
  const exerciseDescription = exercise?.description?.trim() ?? '';
  const exerciseMistakesText = exercise?.mistakes?.trim() ?? '';
  const shouldRenderMyWorkoutSection = !isUserCreatedExercise || draftItems.length > 0 || persistedItems.length > 0;
  const shouldRenderPrimaryMuscles = !isUserCreatedExercise || primaryMuscles.length > 0;
  const shouldRenderSecondaryMuscles = !isUserCreatedExercise || secondaryMuscles.length > 0;
  const shouldRenderFallbackTechniqueText = !isUserCreatedExercise || Boolean(exerciseDescription || exerciseMistakesText);
  const shouldRenderTechniqueBlock = hasStructuredTechniqueText || techniqueMedia.length > 0 || Boolean(exercise?.muscle_map_image_url) || shouldRenderFallbackTechniqueText;
  const shouldRenderExerciseDetailsSection = !isUserCreatedExercise
    || Boolean(techniqueContent?.technique_image_url)
    || shouldRenderPrimaryMuscles
    || shouldRenderSecondaryMuscles
    || shouldRenderTechniqueBlock;

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/50 transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className={`flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl transition-all duration-200 ease-out dark:bg-gray-900 ${
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.985] opacity-0'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700">
            <div className="w-10" />
            <h2 className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.05em] text-gray-900 dark:text-white">
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
                {renderEntry.sets} × {renderEntry.reps} × {formatWorkoutMetricValue(renderEntry.displayAmount ?? renderEntry.weight, normalizeWorkoutMetricType(renderEntry.metricType), renderEntry.metricUnit ?? renderEntry.displayUnit)}
              </p>
            </section>

            {shouldRenderMyWorkoutSection ? (
            <section className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="text-sm font-semibold uppercase text-gray-900 dark:text-white">Моя тренировка</div>
              {!isUserCreatedExercise ? (
                <>
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
                </>
              ) : null}

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
            ) : null}

            {shouldRenderExerciseDetailsSection ? (
            <section className="space-y-5 border-t border-gray-100 pt-5 dark:border-gray-800">
              {techniqueContent?.technique_image_url ? (
                <img
                  src={techniqueContent.technique_image_url}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  alt={exercise?.name || techniqueContent.exercise_name}
                  className="w-full rounded-[12px] object-contain"
                />
              ) : null}

              {shouldRenderPrimaryMuscles ? (
              <div className="space-y-2 rounded-2xl bg-gray-50/70 px-4 py-3 dark:bg-gray-800/40">
                <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                  <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.primary}`} />
                  <span>Основные работающие мышцы</span>
                </div>
                <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                  {primaryMuscles.length > 0 ? primaryMuscles.map(getMuscleLabel).join(', ') : 'Не указаны'}
                </p>
              </div>
              ) : null}

              {shouldRenderSecondaryMuscles ? (
              <div className="space-y-2 rounded-2xl bg-gray-50/70 px-4 py-3 dark:bg-gray-800/40">
                <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                  <CircleDot className={`${SECTION_ICON_CLASS} ${ICON_COLORS.secondary}`} />
                  <span>Второстепенные мышцы</span>
                </div>
                <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                  {secondaryMuscles.length > 0 ? secondaryMuscles.map(getMuscleLabel).join(', ') : 'Не указаны'}
                </p>
              </div>
              ) : null}

              {shouldRenderTechniqueBlock ? (
              <>
              <button
                type="button"
                onClick={() => setIsTechniqueExpanded((current) => !current)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={isTechniqueExpanded}
              >
                <div className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900 dark:text-white`}>
                  <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.technique}`} />
                  <span>Техника</span>
                </div>
                {isTechniqueExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              <div
                className={`grid transition-all duration-200 ease-out ${isTechniqueExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-5 pt-1">
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

                    {hasStructuredTechniqueText ? (
                      <>
                        {techniqueSections.map((section) => (
                          <div key={section.label} className="space-y-2 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0 dark:border-gray-800">
                            <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                              {section.label === 'Исходное положение' ? <ArrowUpFromLine className={`${SECTION_ICON_CLASS} ${ICON_COLORS.start}`} /> : null}
                              {section.label === 'Выполнение' ? <Play className={`${SECTION_ICON_CLASS} ${ICON_COLORS.execution}`} /> : null}
                              {section.label === 'Верхняя точка' ? <ArrowUp className={`${SECTION_ICON_CLASS} ${ICON_COLORS.top}`} /> : null}
                              {section.label === 'Возврат' ? <ArrowDown className={`${SECTION_ICON_CLASS} ${ICON_COLORS.return}`} /> : null}
                              {section.label === 'Дыхание' ? <Wind className={`${SECTION_ICON_CLASS} ${ICON_COLORS.breathing}`} /> : null}
                              {section.label === 'Безопасность' ? <Shield className={`${SECTION_ICON_CLASS} ${ICON_COLORS.safety}`} /> : null}
                              <span>{section.label}</span>
                            </div>
                            <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700 dark:text-gray-200">
                              {section.value}
                            </p>
                          </div>
                        ))}

                        {techniqueMistakes.length > 0 ? (
                          <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                            <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                              <AlertTriangle className={`${SECTION_ICON_CLASS} ${ICON_COLORS.mistakes}`} />
                              <span>Ошибки</span>
                            </div>
                            <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[15px] leading-7 text-gray-700 marker:text-gray-400 dark:text-gray-200 dark:marker:text-gray-500">
                              {techniqueMistakes.map((item) => (
                                <li key={item} className="whitespace-pre-wrap">{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {exerciseDescription || !isUserCreatedExercise ? (
                          <div className="space-y-2">
                            <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                              <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.technique}`} />
                              <span>{isUserCreatedExercise ? 'Описание упражнения' : 'Описание техники'}</span>
                            </div>
                            <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700 dark:text-gray-200">
                              {exerciseDescription || 'Описание техники пока не заполнено.'}
                            </p>
                          </div>
                        ) : null}

                        {exerciseMistakesText || !isUserCreatedExercise ? (
                          <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                            <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700 dark:text-gray-300`}>
                              <AlertTriangle className={`${SECTION_ICON_CLASS} ${ICON_COLORS.mistakes}`} />
                              <span>Рекомендации и ошибки</span>
                            </div>
                            <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700 dark:text-gray-200">
                              {exerciseMistakesText || 'Рекомендации пока не заполнены.'}
                            </p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
              </>
              ) : null}
            </section>
            ) : null}
          </div>

          {!isUserCreatedExercise || hasDraftMedia ? (
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
                    exerciseId: renderEntry.exercise_id,
                    workoutEntryId: renderEntry.id,
                    workoutDate: renderEntry.workout_day?.date ?? null,
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
          ) : null}
        </div>
      </div>
      <ExerciseMediaViewerOverlay item={viewerItem} onClose={() => setViewerItem(null)} />
    </>
  );
};

export default WorkoutExerciseCardSheet;
