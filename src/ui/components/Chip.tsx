import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ChipProps {
  children: ReactNode;
  tone?: 'default' | 'premium' | 'success' | 'warning';
  onClick?: () => void;
  selected?: boolean;
}

const toneMap: Record<NonNullable<ChipProps['tone']>, { background: string; color: string }> = {
  default: { background: colors.emotional.support, color: colors.text.secondary },
  premium: { background: colors.premium, color: colors.text.primary },
  success: { background: colors.emotional.recovery, color: colors.text.primary },
  warning: { background: colors.emotional.fatigue, color: colors.text.primary },
};

const Chip = ({ children, tone = 'default', onClick, selected }: ChipProps) => {
  const style = toneMap[tone];
  const baseStyle = {
    borderRadius: radius.pill,
    padding: `2px ${spacing.sm}px`,
    backgroundColor: selected ? colors.primary : style.background,
    color: selected ? '#FFFFFF' : style.color,
    ...typography.micro,
  };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center" style={baseStyle}>
      {children}
    </span>
  );
};

export default Chip;
