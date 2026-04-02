import { useEffect, useRef } from 'react';

interface WorkoutEntryNoteComposerProps {
  isOpen: boolean;
  value: string;
  isSaving?: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => Promise<void> | void;
}

const WorkoutEntryNoteComposer = ({
  isOpen,
  value,
  isSaving = false,
  onChange,
  onCancel,
  onSave,
}: WorkoutEntryNoteComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    textareaRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="rounded-[20px] border border-gray-300 bg-white px-4 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
      data-testid="workout-entry-note-composer"
    >
      <h3 className="text-center text-[14px] font-bold uppercase leading-none tracking-[0.02em] text-gray-900">
        Добавить заметку
      </h3>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isSaving}
        placeholder="Заметка..."
        className="mt-2.5 h-[64px] w-full resize-none rounded-[16px] border border-emerald-100/70 bg-emerald-50/70 px-4 py-3 text-sm leading-5 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
      />
      <div className="mt-2.5 flex items-center justify-end gap-4 pb-0.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="text-[14px] font-semibold uppercase leading-none text-green-600 transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="text-[14px] font-semibold uppercase leading-none text-green-600 transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          {isSaving ? 'Сохранение...' : 'ОК'}
        </button>
      </div>
    </div>
  );
};

export default WorkoutEntryNoteComposer;
