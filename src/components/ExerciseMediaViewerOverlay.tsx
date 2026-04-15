import { X } from 'lucide-react';

export interface ExerciseMediaViewerItem {
  id: string;
  kind: 'image' | 'video';
  previewUrl: string;
}

interface ExerciseMediaViewerOverlayProps {
  item: ExerciseMediaViewerItem | null;
  onClose: () => void;
}

const ExerciseMediaViewerOverlay = ({ item, onClose }: ExerciseMediaViewerOverlayProps) => {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 min-[376px]:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть просмотр медиа"
          className="absolute right-0 top-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>
        {item.kind === 'video' ? (
          <video
            src={item.previewUrl}
            controls
            playsInline
            className="max-h-[88vh] w-full rounded-2xl bg-black object-contain"
          />
        ) : (
          <img
            src={item.previewUrl}
            alt="Полноэкранный просмотр медиа упражнения"
            className="max-h-[88vh] w-full rounded-2xl object-contain"
          />
        )}
      </div>
    </div>
  );
};

export default ExerciseMediaViewerOverlay;
