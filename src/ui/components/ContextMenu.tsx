import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { animation, colors, radius, shadows, spacing, typography } from '../theme/tokens';

interface ContextMenuProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  variant?: 'sheet' | 'inline';
}

const ContextMenu = ({ open, onClose, title, children, variant = 'sheet' }: ContextMenuProps) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setActive(false);
    const frame = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  if (variant === 'inline') {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label={title ?? 'Контекстное меню'}
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          boxShadow: shadows.soft,
          padding: spacing.md,
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(8px)',
          transition: `transform ${animation.base} ${animation.easing}, opacity ${animation.base} ${animation.easing}`,
        }}
      >
        {title && (
          <div style={{ marginBottom: spacing.sm }}>
            <p style={typography.subtitle}>{title}</p>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.32)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 60,
        opacity: active ? 1 : 0,
        transition: `opacity ${animation.base} ${animation.easing}`,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Контекстное меню'}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.soft,
          padding: spacing.lg,
          transform: active ? 'translateY(0)' : 'translateY(12px)',
          opacity: active ? 1 : 0,
          transition: `transform ${animation.base} ${animation.easing}, opacity ${animation.base} ${animation.easing}`,
        }}
      >
        {title && (
          <div style={{ marginBottom: spacing.sm }}>
            <p style={typography.subtitle}>{title}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default ContextMenu;
