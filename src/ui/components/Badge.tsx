import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface BadgeProps {
  children: ReactNode;
  tone?: 'default' | 'premium' | 'success' | 'warning' | 'danger';
}

const toneMap: Record<NonNullable<BadgeProps['tone']>, { background: string; color: string }> = {
  default: { background: colors.emotional.support, color: colors.text.secondary },
  premium: { background: colors.premium, color: colors.text.primary },
  success: { background: colors.success, color: '#FFFFFF' },
  warning: { background: colors.warning, color: colors.text.primary },
  danger: { background: colors.danger, color: '#FFFFFF' },
};

const Badge = ({ children, tone = 'default' }: BadgeProps) => {
  const style = toneMap[tone];
  return (
    <span
      className="inline-flex items-center"
      style={{
        borderRadius: radius.sm,
        padding: `2px ${spacing.sm}px`,
        backgroundColor: style.background,
        color: style.color,
        ...typography.micro,
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
