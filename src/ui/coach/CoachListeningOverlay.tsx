interface CoachListeningOverlayProps {
  open: boolean;
  onClose: () => void;
}

const CoachListeningOverlay = ({ open, onClose }: CoachListeningOverlayProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-xl dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Коуч слушает…</p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Вы можете остановить запись в любой момент.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-gray-300 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default CoachListeningOverlay;
