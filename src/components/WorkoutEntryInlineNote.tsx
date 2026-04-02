import { ChevronDown, ChevronRight, X } from 'lucide-react';

interface WorkoutEntryInlineNoteProps {
  note: string;
  isExpanded: boolean;
  isDeleteConfirmOpen?: boolean;
  isDeleting?: boolean;
  onToggle: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => Promise<void> | void;
  onCancelDelete: () => void;
}

const WorkoutEntryInlineNote = ({
  note,
  isExpanded,
  isDeleteConfirmOpen = false,
  isDeleting = false,
  onToggle,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: WorkoutEntryInlineNoteProps) => {
  return (
    <div
      className="border-b border-gray-200 pl-6"
      data-testid="workout-entry-inline-note"
    >
      {isExpanded ? (
        <div className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm italic leading-5 text-gray-700">
            {note}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={isDeleting}
              className="rounded-md p-1 text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              aria-label="Удалить заметку"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              disabled={isDeleting}
              className="rounded-md p-1 text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              aria-label="Свернуть заметку"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end py-2">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1 text-gray-700 transition-colors hover:bg-gray-100"
            aria-label="Развернуть заметку"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {isDeleteConfirmOpen ? (
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 py-2 pr-2">
          <span className="text-xs text-gray-600">Удалить заметку?</span>
          <button
            type="button"
            onClick={onCancelDelete}
            disabled={isDeleting}
            className="text-xs font-semibold uppercase text-gray-500 transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            Нет
          </button>
          <button
            type="button"
            onClick={() => void onConfirmDelete()}
            disabled={isDeleting}
            className="text-xs font-semibold uppercase text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {isDeleting ? 'Удаление...' : 'Да'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default WorkoutEntryInlineNote;
