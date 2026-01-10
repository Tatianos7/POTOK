import { Edit, Trash2 } from 'lucide-react';
import { WorkoutEntry } from '../types/workout';

interface WorkoutEntryCardProps {
  entry: WorkoutEntry;
  onEdit?: (entry: WorkoutEntry) => void;
  onDelete?: (entryId: string) => void;
}

const WorkoutEntryCard = ({ entry, onEdit, onDelete }: WorkoutEntryCardProps) => {
  const primaryMuscle = entry.exercise?.muscles?.[0]?.name || '';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 min-[376px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white mb-1 truncate">
            {entry.exercise?.name || 'Неизвестное упражнение'}
            {primaryMuscle && (
              <span className="text-gray-500 dark:text-gray-400 font-normal"> — {primaryMuscle}</span>
            )}
          </h3>
          <p className="text-sm min-[376px]:text-base font-medium text-gray-700 dark:text-gray-300">
            {entry.sets} × {entry.reps} × {entry.weight} кг
          </p>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(entry)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Редактировать"
              >
                <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Удалить"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutEntryCard;

