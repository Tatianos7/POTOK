import type { ReactNode } from 'react';
import { borders, surfaces, typography } from '../theme/tokens';

type CardTone = 'normal' | 'explainable' | 'error' | 'premium' | 'success';

interface CardProps {
  title?: string;
  tone?: CardTone;
  children: ReactNode;
  action?: ReactNode;
}

const toneStyles: Record<CardTone, string> = {
  normal: `${surfaces.card} ${borders.base}`,
  explainable: `${surfaces.muted} ${borders.base}`,
  error: `${surfaces.error} ${borders.error}`,
  premium: `${surfaces.warn} ${borders.warn}`,
  success: `${surfaces.success} ${borders.success}`,
};

const Card = ({ title, tone = 'normal', children, action }: CardProps) => {
  return (
    <section className={`rounded-2xl ${toneStyles[tone]} p-4`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-2">
          {title && <h2 className={typography.title}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
};

export default Card;
