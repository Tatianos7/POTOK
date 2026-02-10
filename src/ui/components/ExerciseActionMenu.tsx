import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, StickyNote, Camera } from 'lucide-react';
import Button from './Button';
import Text from './Text';
import { colors, radius, shadows, spacing } from '../theme/tokens';

interface ExerciseActionMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  menuRef?: React.RefObject<HTMLDivElement>;
  onEdit: () => void;
  onDelete: () => void;
  onNote: () => void;
  onMedia: () => void;
  onClose: () => void;
}

const ExerciseActionMenu = ({
  open,
  anchorRef,
  menuRef,
  onEdit,
  onDelete,
  onNote,
  onMedia,
  onClose,
}: ExerciseActionMenuProps) => {
  if (!open) return null;

  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const maxWidth = Math.min(520, window.innerWidth - spacing.md * 2);
      setPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
        width: Math.max(160, maxWidth),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, anchorRef]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menu = (
    <div
      role="menu"
      aria-label="Действия упражнения"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        width: position.width,
        maxWidth: 520,
        zIndex: 1000,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.soft,
        padding: spacing.md,
      }}
    >
      {/* Portal to body prevents clipping by parent overflow/stacking contexts */}
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

  return createPortal(menu, document.body);
};

export default ExerciseActionMenu;
