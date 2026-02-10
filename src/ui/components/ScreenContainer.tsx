import type { ReactNode } from 'react';
import { colors, spacing } from '../theme/tokens';

interface ScreenContainerProps {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof spacing;
  gap?: keyof typeof spacing;
}

const ScreenContainer = ({ children, className, padding = 'lg', gap }: ScreenContainerProps) => {
  const layoutStyle = gap
    ? {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: spacing[gap],
      }
    : {};

  return (
    <div className={`min-h-screen w-full ${className || ''}`} style={{ backgroundColor: colors.background }}>
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: 560,
          minWidth: 320,
          padding: spacing[padding],
          ...layoutStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScreenContainer;
