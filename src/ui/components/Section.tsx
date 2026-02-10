import type { ReactNode } from 'react';
import { spacing, typography } from '../theme/tokens';

interface SectionProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

const Section = ({ title, subtitle, action, children }: SectionProps) => {
  return (
    <section className="flex flex-col" style={{ gap: spacing.sm }}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && <h2 style={typography.title}>{title}</h2>}
            {subtitle && <p style={typography.subtitle}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
};

export default Section;
