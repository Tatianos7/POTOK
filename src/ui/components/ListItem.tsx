import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
}

const ListItem = ({ title, subtitle, right, onClick }: ListItemProps) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <div>
        <div style={typography.body}>{title}</div>
        {subtitle && <div style={typography.subtitle}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
};

export default ListItem;
