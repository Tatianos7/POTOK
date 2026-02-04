import { Pencil, Trash2, StickyNote, Camera } from 'lucide-react';
import Button from './Button';
import Text from './Text';
import { colors, radius, shadows, spacing } from '../theme/tokens';

interface ExerciseActionMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  onEdit: () => void;
  onDelete: () => void;
  onNote: () => void;
  onMedia: () => void;
  onClose: () => void;
}

const ExerciseActionMenu = ({
  open,
  anchorRef,
  onEdit,
  onDelete,
  onNote,
  onMedia,
  onClose,
}: ExerciseActionMenuProps) => {
  if (!open) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      role="menu"
      aria-label="Действия упражнения"
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translate(-50%, -100%) translateY(-8px)',
        width: '100%',
        maxWidth: 520,
        zIndex: 30,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.soft,
        padding: spacing.md,
        pointerEvents: anchorRef.current ? 'auto' : 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: spacing.md,
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => handleAction(onEdit)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
            <Pencil size={20} color={colors.text.primary} />
            <Text variant="micro">РЕДАКТИРОВАТЬ</Text>
          </div>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onDelete)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
            <Trash2 size={20} color={colors.text.primary} />
            <Text variant="micro">УДАЛИТЬ</Text>
          </div>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onNote)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
            <StickyNote size={20} color={colors.text.primary} />
            <Text variant="micro">ЗАМЕТКА</Text>
          </div>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onMedia)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs }}>
            <Camera size={20} color={colors.text.primary} />
            <Text variant="micro">ФОТО/ВИДЕО</Text>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default ExerciseActionMenu;
