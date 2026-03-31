import { Edit, Trash2 } from 'lucide-react';

interface WorkoutDayNoteBlockProps {
  note: string;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const WorkoutDayNoteBlock = ({ note, isDeleting = false, onEdit, onDelete }: WorkoutDayNoteBlockProps) => {
  const trimmedNote = note.trim();
  if (!trimmedNote) return null;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Заметка к тренировке
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">{trimmedNote}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Редактировать заметку тренировки"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400"
            aria-label="Удалить заметку тренировки"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutDayNoteBlock;
