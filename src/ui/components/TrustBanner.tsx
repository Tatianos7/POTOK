import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

type TrustTone = 'fatigue' | 'pain' | 'plateau' | 'recovery' | 'safety';

interface TrustBannerProps {
  tone: TrustTone;
  children: ReactNode;
}

const toneStyles: Record<TrustTone, { background: string; border: string }> = {
  fatigue: { background: colors.emotional.fatigue, border: colors.warning },
  pain: { background: colors.emotional.fatigue, border: colors.danger },
  plateau: { background: colors.emotional.plateau, border: colors.border },
  recovery: { background: colors.emotional.recovery, border: colors.border },
  safety: { background: colors.emotional.recovery, border: colors.success },
};

const TrustBanner = ({ tone, children }: TrustBannerProps) => {
  const style = toneStyles[tone];
  return (
    <div
      className="mb-4"
      style={{
        borderRadius: radius.lg,
        padding: spacing.lg,
        border: `1px solid ${style.border}`,
        backgroundColor: style.background,
      }}
    >
      <p style={typography.body}>{children}</p>
    </div>
  );
};

export default TrustBanner;
