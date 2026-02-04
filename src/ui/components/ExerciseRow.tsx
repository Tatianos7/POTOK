import { useEffect, useRef, useState } from 'react';
import Text from './Text';
import Button from './Button';
import ExerciseActionMenu from './ExerciseActionMenu';
import { colors, spacing, typography } from '../theme/tokens';

interface ExerciseRowProps {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  unit?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onNote?: () => void;
  onMedia?: () => void;
}

const ExerciseRow = ({ name, sets, reps, weight, unit = 'кг', onEdit, onDelete, onNote, onMedia }: ExerciseRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const handleEdit = onEdit ?? (() => console.log('edit', name));
  const handleDelete = onDelete ?? (() => console.log('delete', name));
  const handleNote = onNote ?? (() => console.log('note', name));
  const handleMedia = onMedia ?? (() => console.log('media', name));

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleScroll = () => setMenuOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rowRef} style={{ position: 'relative' }}>
      {menuOpen && (
        <div ref={menuRef}>
          <ExerciseActionMenu
            open={menuOpen}
            anchorRef={rowRef}
            onClose={() => setMenuOpen(false)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNote={handleNote}
            onMedia={handleMedia}
          />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px minmax(0, 1fr) 1px 48px 1px 48px 1px 56px',
          alignItems: 'center',
          columnGap: 0,
          padding: `${spacing.sm}px 0`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMenuOpen((open) => !open)}
          ref={triggerRef}
          style={{ width: 24, height: 24, paddingLeft: 0, paddingRight: 0 }}
        >
          ⋮
        </Button>
        <div
          style={{
            ...typography.body,
            fontSize: 'clamp(11px, 3.2vw, 14px)',
            lineHeight: '18px',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {name}
        </div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center' }}>{sets}</div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center' }}>{reps}</div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center' }}>
          {weight} {unit}
        </div>
      </div>
    </div>
  );
};

export default ExerciseRow;
