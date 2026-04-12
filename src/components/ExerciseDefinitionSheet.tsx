import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Exercise } from '../types/workout';

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
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <div className="w-10" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-900">
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
            ) : exercise ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">{exercise.name}</h3>

                  {exercise.media && exercise.media.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {exercise.media
                        .slice()
                        .sort((left, right) => left.order - right.order)
                        .map((mediaItem, index) => renderMediaItem(exercise.name, mediaItem, index))}
                    </div>
                  ) : null}

                  {exercise.muscle_map_image_url ? (
                    <img
                      src={exercise.muscle_map_image_url}
                      alt={`Карта мышц: ${exercise.name}`}
                      className="mx-auto h-44 rounded-xl bg-gray-50 object-contain"
                    />
                  ) : null}
                </div>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase text-gray-900">Техника</h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {exercise.description?.trim() || 'Описание техники пока не заполнено.'}
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase text-gray-900">Основные рекомендации и ошибки</h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {exercise.mistakes?.trim() || 'Рекомендации пока не заполнены.'}
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase text-gray-900">Основные мышцы</h4>
                  <p className="text-sm leading-6 text-gray-700">
                    {exercise.primary_muscles && exercise.primary_muscles.length > 0
                      ? exercise.primary_muscles.join(', ')
                      : 'Не указаны'}
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase text-gray-900">Второстепенные мышцы</h4>
                  <p className="text-sm leading-6 text-gray-700">
                    {exercise.secondary_muscles && exercise.secondary_muscles.length > 0
                      ? exercise.secondary_muscles.join(', ')
                      : 'Не указаны'}
                  </p>
                </section>
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
              disabled={!exercise || isLoading || isSelected}
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
