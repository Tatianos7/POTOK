import { useState, useEffect, useRef } from 'react';
import { submitModalAction } from '../utils/asyncModalSubmit';

interface MealNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void> | void;
  initialNote?: string | null;
  onDelete?: () => Promise<void> | void; // Опциональная функция для удаления заметки
}

const MealNoteModal = ({ isOpen, onClose, onSave, initialNote, onDelete }: MealNoteModalProps) => {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const submitLock = useRef({ current: false });

  // Загружаем существующую заметку при открытии
  useEffect(() => {
    if (isOpen) {
      setNote(initialNote || '');
    }
  }, [isOpen, initialNote]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await submitModalAction(
        submitLock.current,
        () => onSave(note.trim()),
        () => {
          onClose();
        }
      );
    } catch (error) {
      console.error('[MealNoteModal] Failed to save note:', error);
      alert('Не удалось сохранить заметку. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSaving(true);
    try {
      await submitModalAction(
        submitLock.current,
        () => onDelete(),
        () => {
          onClose();
        }
      );
    } catch (error) {
      console.error('[MealNoteModal] Failed to delete note:', error);
      alert('Не удалось удалить заметку. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { if (!isSaving) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center uppercase">
            ДОБАВИТЬ ЗАМЕТКУ
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isSaving}
            placeholder="Заметка..."
            className="w-full min-h-[200px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            autoFocus
          />
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex justify-between items-center">
          {onDelete && initialNote && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="text-red-600 dark:text-red-400 font-semibold uppercase hover:opacity-70 transition-opacity disabled:opacity-50"
            >
              УДАЛИТЬ
            </button>
          )}
          <div className="flex gap-4 ml-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="text-green-600 dark:text-green-400 font-semibold uppercase hover:opacity-70 transition-opacity disabled:opacity-50"
            >
              ОТМЕНИТЬ
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-green-600 dark:text-green-400 font-semibold uppercase hover:opacity-70 transition-opacity disabled:opacity-50"
>
              {isSaving ? 'СОХРАНЕНИЕ...' : 'ОК'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealNoteModal;

