import { useEffect, useState } from 'react';
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
  Wind,
  X,
} from 'lucide-react';
import type { Exercise } from '../types/workout';
import { lookupExerciseContent } from '../utils/exerciseContentLookup';
import { getMuscleLabel } from '../utils/muscleLabels';

const EXERCISE_DEFINITION_SHEET_ANIMATION_MS = 180;
const SECTION_ICON_CLASS = 'h-4 w-4';
const SECTION_HEADING_ROW_CLASS = 'flex items-center gap-2';
const ICON_COLORS = {
  technique: 'text-violet-500',
  primary: 'text-amber-500',
  secondary: 'text-slate-500',
  start: 'text-cyan-500',
  execution: 'text-indigo-500',
  top: 'text-emerald-500',
  return: 'text-orange-500',
  breathing: 'text-blue-500',
  safety: 'text-green-500',
  mistakes: 'text-red-500',
} as const;

interface ExerciseDefinitionSheetProps {
  isOpen: boolean;
  exercise: Exercise | null;
  isLoading?: boolean;
  error?: string | null;
  isSelected?: boolean;
  onClose: () => void;
  onAddToWorkout: () => void;
}

const renderMediaItem = (exerciseName: string, mediaItem: NonNullable<Exercise['media']>[number], index: number) => {
  if (mediaItem.type === 'video') {
    return (
      <video
        key={`${mediaItem.url}-${index}`}
        src={mediaItem.url}
        controls
        playsInline
        className="h-28 w-full rounded-xl bg-black object-cover"
        aria-label={`Видео упражнения ${exerciseName}`}
      />
    );
  }

  return (
    <img
      key={`${mediaItem.url}-${index}`}
      src={mediaItem.url}
      alt={exerciseName}
      className="h-28 w-full rounded-xl bg-gray-100 object-cover"
    />
  );
};

const ExerciseDefinitionSheet = ({
  isOpen,
  exercise,
  isLoading = false,
  error = null,
  isSelected = false,
  onClose,
  onAddToWorkout,
}: ExerciseDefinitionSheetProps) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [renderExercise, setRenderExercise] = useState<Exercise | null>(exercise);
  const [isTechniqueExpanded, setIsTechniqueExpanded] = useState(false);

  useEffect(() => {
    let openFrame = 0;
    let closeTimer: number | null = null;

    if (isOpen && exercise) {
      setRenderExercise(exercise);
      setIsRendered(true);
      openFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      closeTimer = window.setTimeout(() => {
        setIsRendered(false);
        setRenderExercise(null);
        setIsTechniqueExpanded(false);
      }, EXERCISE_DEFINITION_SHEET_ANIMATION_MS);
    }

    return () => {
      window.cancelAnimationFrame(openFrame);
      if (closeTimer) {
        window.clearTimeout(closeTimer);
      }
    };
  }, [exercise, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isRendered) return null;

  const isUserCreatedExercise = renderExercise?.is_custom === true;
  const techniqueContent = isUserCreatedExercise
    ? undefined
    : lookupExerciseContent({
        exerciseId: renderExercise?.id,
        exerciseName: renderExercise?.name,
      });
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
  const exercisePrimaryMuscles = (renderExercise?.primary_muscles ?? []).filter((value): value is string => Boolean(value?.trim()));
  const exerciseSecondaryMuscles = (renderExercise?.secondary_muscles ?? []).filter((value): value is string => Boolean(value?.trim()));
  const exerciseLinkedMuscles = (renderExercise?.muscles ?? [])
    .map((muscle) => muscle.name)
    .filter((value): value is string => Boolean(value?.trim()));
  const primaryMuscles = techniqueContent
    ? techniqueContent.primary_muscles
    : exercisePrimaryMuscles.length > 0
      ? exercisePrimaryMuscles
      : exerciseLinkedMuscles;
  const secondaryMuscles = techniqueContent
    ? techniqueContent.secondary_muscles
    : exerciseSecondaryMuscles;
  const exerciseDescription = renderExercise?.description?.trim() ?? '';
  const exerciseMistakesText = renderExercise?.mistakes?.trim() ?? '';
  const shouldRenderPrimaryMuscles = !isUserCreatedExercise || primaryMuscles.length > 0;
  const shouldRenderSecondaryMuscles = !isUserCreatedExercise || secondaryMuscles.length > 0;
  const shouldRenderFallbackTechniqueText = !isUserCreatedExercise || Boolean(exerciseDescription || exerciseMistakesText);
  const shouldRenderTechniqueBlock = hasStructuredTechniqueText || shouldRenderFallbackTechniqueText;

  return (
    <>
      <div
        className={`fixed inset-0 z-[80] bg-black/50 transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className={`flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl transition-all duration-200 ease-out ${
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.985] opacity-0'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <div className="w-10" />
            <h2 className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.05em] text-gray-900">
              Карточка упражнения
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Закрыть карточку упражнения"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
              </div>
            ) : renderExercise ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">{renderExercise.name}</h3>

                  {renderExercise.media && renderExercise.media.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {renderExercise.media
                        .slice()
                        .sort((left, right) => left.order - right.order)
                        .map((mediaItem, index) => renderMediaItem(renderExercise.name, mediaItem, index))}
                    </div>
                  ) : null}

                  {techniqueContent?.technique_image_url ? (
                    <img
                      src={techniqueContent.technique_image_url}
                      alt={renderExercise.name}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                      className="w-full rounded-[12px] object-contain"
                    />
                  ) : null}

                  {renderExercise.muscle_map_image_url ? (
                    <img
                      src={renderExercise.muscle_map_image_url}
                      alt={`Карта мышц: ${renderExercise.name}`}
                      className="mx-auto h-44 rounded-xl bg-gray-50 object-contain"
                    />
                  ) : null}
                </div>

                {shouldRenderPrimaryMuscles ? (
                  <section className="space-y-2 rounded-2xl bg-gray-50/70 px-4 py-3">
                    <h4 className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900`}>
                      <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.primary}`} />
                      <span>Основные мышцы</span>
                    </h4>
                    <p className="text-sm leading-6 text-gray-700">
                      {primaryMuscles.length > 0
                        ? primaryMuscles.map(getMuscleLabel).join(', ')
                        : 'Не указаны'}
                    </p>
                  </section>
                ) : null}

                {shouldRenderSecondaryMuscles ? (
                  <section className="space-y-2 rounded-2xl bg-gray-50/70 px-4 py-3">
                    <h4 className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900`}>
                      <CircleDot className={`${SECTION_ICON_CLASS} ${ICON_COLORS.secondary}`} />
                      <span>Второстепенные мышцы</span>
                    </h4>
                    <p className="text-sm leading-6 text-gray-700">
                      {secondaryMuscles.length > 0
                        ? secondaryMuscles.map(getMuscleLabel).join(', ')
                        : 'Не указаны'}
                    </p>
                  </section>
                ) : null}

                {shouldRenderTechniqueBlock ? (
                <section className="space-y-5 border-t border-gray-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsTechniqueExpanded((current) => !current)}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={isTechniqueExpanded}
                  >
                    <h4 className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900`}>
                      <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.technique}`} />
                      <span>Техника</span>
                    </h4>
                    {isTechniqueExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  <div
                    className={`grid transition-all duration-200 ease-out ${isTechniqueExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-5 pt-1">
                        {hasStructuredTechniqueText ? (
                          <>
                            {techniqueSections.map((section) => (
                              <div key={section.label} className="space-y-2 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                                <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700`}>
                                  {section.label === 'Исходное положение' ? <ArrowUpFromLine className={`${SECTION_ICON_CLASS} ${ICON_COLORS.start}`} /> : null}
                                  {section.label === 'Выполнение' ? <Play className={`${SECTION_ICON_CLASS} ${ICON_COLORS.execution}`} /> : null}
                                  {section.label === 'Верхняя точка' ? <ArrowUp className={`${SECTION_ICON_CLASS} ${ICON_COLORS.top}`} /> : null}
                                  {section.label === 'Возврат' ? <ArrowDown className={`${SECTION_ICON_CLASS} ${ICON_COLORS.return}`} /> : null}
                                  {section.label === 'Дыхание' ? <Wind className={`${SECTION_ICON_CLASS} ${ICON_COLORS.breathing}`} /> : null}
                                  {section.label === 'Безопасность' ? <Shield className={`${SECTION_ICON_CLASS} ${ICON_COLORS.safety}`} /> : null}
                                  <span>{section.label}</span>
                                </div>
                                <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
                                  {section.value}
                                </p>
                              </div>
                            ))}

                            {techniqueMistakes.length > 0 ? (
                              <div className="space-y-2 border-t border-gray-100 pt-4">
                                <div className={`${SECTION_HEADING_ROW_CLASS} text-xs font-bold uppercase text-gray-700`}>
                                  <AlertTriangle className={`${SECTION_ICON_CLASS} ${ICON_COLORS.mistakes}`} />
                                  <span>Ошибки</span>
                                </div>
                                <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[15px] leading-7 text-gray-700 marker:text-gray-400">
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
                              <section className="space-y-2">
                                <h4 className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900`}>
                                  <Activity className={`${SECTION_ICON_CLASS} ${ICON_COLORS.technique}`} />
                                  <span>{isUserCreatedExercise ? 'Описание упражнения' : 'Техника'}</span>
                                </h4>
                                <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
                                  {exerciseDescription || 'Описание техники пока не заполнено.'}
                                </p>
                              </section>
                            ) : null}

                            {exerciseMistakesText || !isUserCreatedExercise ? (
                              <section className="space-y-2 border-t border-gray-100 pt-4">
                                <h4 className={`${SECTION_HEADING_ROW_CLASS} text-sm font-bold uppercase text-gray-900`}>
                                  <AlertTriangle className={`${SECTION_ICON_CLASS} ${ICON_COLORS.mistakes}`} />
                                  <span>Основные рекомендации и ошибки</span>
                                </h4>
                                <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
                                  {exerciseMistakesText || 'Рекомендации пока не заполнены.'}
                                </p>
                              </section>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
                ) : null}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">
                {error || 'Не удалось загрузить карточку упражнения'}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              onClick={onAddToWorkout}
              disabled={!renderExercise || isLoading || isSelected}
              className="w-full rounded-[18px] border-2 border-gray-900 px-4 py-3 text-sm font-semibold uppercase text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
            >
              {isSelected ? 'Уже добавлено' : 'Добавить в тренировку'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExerciseDefinitionSheet;
