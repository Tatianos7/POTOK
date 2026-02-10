import type { ReactNode } from 'react';
import { spacing } from '../theme/tokens';

type StackDirection = 'row' | 'column';
type StackAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch';
type StackJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between';

interface StackProps {
  children: ReactNode;
  direction?: StackDirection;
  gap?: keyof typeof spacing;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
}

const Stack = ({
  children,
  direction = 'column',
  gap = 'md',
  align = 'stretch',
  justify = 'flex-start',
  wrap = false,
}: StackProps) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: spacing[gap],
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

export default Stack;
