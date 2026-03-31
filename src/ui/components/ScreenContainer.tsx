import type { ReactNode } from 'react';
import { colors, spacing } from '../theme/tokens';

interface ScreenContainerProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  padding?: keyof typeof spacing;
  gap?: keyof typeof spacing;
  backgroundColor?: string;
}

const ScreenContainer = ({
  children,
  className,
  contentClassName,
  padding = 'lg',
  gap,
  backgroundColor = colors.background,
}: ScreenContainerProps) => {
  const layoutStyle = gap
    ? {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: spacing[gap],
      }
    : {};

  return (
    <div className={`min-h-screen w-full ${className || ''}`} style={{ backgroundColor }}>
      <div
        className={`mx-auto w-full ${contentClassName || ''}`}
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
