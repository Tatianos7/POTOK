import type { ReactNode } from 'react';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';

type CardTone = 'normal' | 'explainable' | 'error' | 'premium' | 'success';
type CardVariant = 'default' | 'surface' | 'ghost' | 'soft';
type CardSize = 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  title?: string;
  tone?: CardTone;
  variant?: CardVariant;
  size?: CardSize;
  children: ReactNode;
  action?: ReactNode;
}

const toneStyles: Record<CardTone, { background: string; border: string; shadow: string }> = {
  normal: { background: colors.surface, border: colors.border, shadow: shadows.soft },
  explainable: { background: colors.emotional.support, border: colors.border, shadow: shadows.soft },
  error: { background: colors.emotional.fatigue, border: colors.danger, shadow: shadows.soft },
  premium: { background: colors.emotional.plateau, border: colors.premium, shadow: shadows.soft },
  success: { background: colors.emotional.recovery, border: colors.success, shadow: shadows.soft },
};

const variantStyles: Record<CardVariant, { background: string; border: string; shadow: string }> = {
  default: { background: colors.surface, border: colors.border, shadow: shadows.soft },
  surface: { background: colors.surface, border: 'transparent', shadow: shadows.none },
  ghost: { background: 'transparent', border: 'transparent', shadow: shadows.none },
  soft: { background: colors.emotional.support, border: colors.border, shadow: shadows.soft },
};

const sizeStyles: Record<CardSize, number> = {
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
  xl: spacing.xl,
};

const Card = ({ title, tone = 'normal', variant, size = 'md', children, action }: CardProps) => {
  const toneStyle = variant ? variantStyles[variant] : toneStyles[tone];
  return (
    <section
      className="flex flex-col"
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${toneStyle.border}`,
        backgroundColor: toneStyle.background,
        padding: sizeStyles[size],
        boxShadow: toneStyle.shadow,
        gap: spacing.sm,
      }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          {title && <h2 style={typography.title}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
};

export default Card;
