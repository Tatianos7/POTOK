import { Check, ChevronDown, ChevronRight, Copy, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { copyWorkoutDayNoteText } from '../utils/workoutDayNoteClipboard';

interface WorkoutDayNoteBlockProps {
  note: string;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  defaultExpanded?: boolean;
}

const WorkoutDayNoteBlock = ({
  note,
  isDeleting = false,
  onEdit,
  onDelete,
  defaultExpanded = true,
}: WorkoutDayNoteBlockProps) => {
  const trimmedNote = note.trim();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!trimmedNote) return null;

  const handleCopy = async () => {
    const success = await copyWorkoutDayNoteText(trimmedNote);
    if (success) {
      setCopied(true);
      return;
    }

    alert('Не удалось скопировать заметку.');
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Заметка к тренировке
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setIsExpanded((current) => !current)}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label={isExpanded ? 'Свернуть заметку тренировки' : 'Развернуть заметку тренировки'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => void handleCopy()}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Скопировать заметку тренировки"
            title={copied ? 'Скопировано' : 'Скопировать'}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
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
      {isExpanded ? (
        <div
          className="mt-2 max-h-32 w-full overflow-y-scroll pr-1 select-text [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent"
          data-testid="workout-day-note-scroll-region"
          style={{ scrollbarWidth: 'thin', userSelect: 'text', WebkitUserSelect: 'text' }}
        >
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
            {trimmedNote}
          </p>
        </div>
      ) : null}
      {copied ? (
        <div className="mt-2 text-right text-xs font-medium text-green-600">
          Скопировано
        </div>
      ) : null}
    </div>
  );
};

export default WorkoutDayNoteBlock;
