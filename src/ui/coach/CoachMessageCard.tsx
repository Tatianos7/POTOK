import type { ReactNode } from 'react';
import { coachAnimations } from './coachAnimations';
import { coachModeCopy, coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface CoachMessageCardProps {
  title?: string;
  message: string;
  mode?: CoachEmotionalMode;
  action?: ReactNode;
  voiceAction?: ReactNode;
  footer?: ReactNode;
}

const CoachMessageCard = ({ title, message, mode = 'support', action, voiceAction, footer }: CoachMessageCardProps) => {
  const styles = coachModeStyles[mode];
  const label = title ?? coachModeCopy[mode];

  return (
    <section
      className={`${coachAnimations.calmEnter} ${coachAnimations.softFade}`}
      style={{
        ...styles.containerStyle,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: spacing.sm }}>
        <div>
          <p style={{ ...typography.micro, color: styles.accentColor }}>{label}</p>
          <h3 style={styles.titleStyle}>Calm Power Coach</h3>
        </div>
        <div className="flex items-center gap-2">
          {voiceAction}
          {action}
        </div>
      </div>
      <p style={styles.bodyStyle}>{message}</p>
      {footer && <div style={{ marginTop: spacing.sm }}>{footer}</div>}
    </section>
  );
};

interface CoachMemoryChipProps {
  text: string;
}

export const CoachMemoryChip = ({ text }: CoachMemoryChipProps) => {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        borderRadius: radius.pill,
        padding: `2px ${spacing.sm}px`,
        backgroundColor: colors.emotional.support,
        color: colors.text.secondary,
        fontSize: typography.micro.fontSize,
      }}
    >
      {text}
    </span>
  );
};

export default CoachMessageCard;
