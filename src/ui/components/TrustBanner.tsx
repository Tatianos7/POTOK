import type { ReactNode } from 'react';
import { borders, surfaces, typography } from '../theme/tokens';

type TrustTone = 'fatigue' | 'pain' | 'plateau' | 'recovery' | 'safety';

interface TrustBannerProps {
  tone: TrustTone;
  children: ReactNode;
}

const toneStyles: Record<TrustTone, string> = {
  fatigue: `${surfaces.warn} ${borders.warn}`,
  pain: `${surfaces.error} ${borders.error}`,
  plateau: `${surfaces.muted} ${borders.base}`,
  recovery: `${surfaces.info} ${borders.base}`,
  safety: `${surfaces.success} ${borders.success}`,
};

const TrustBanner = ({ tone, children }: TrustBannerProps) => {
  return (
    <div className={`rounded-2xl p-4 ${toneStyles[tone]} mb-4`}>
      <p className={typography.body}>{children}</p>
    </div>
  );
};

export default TrustBanner;
