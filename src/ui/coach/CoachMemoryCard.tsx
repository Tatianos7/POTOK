import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface CoachMemoryCardProps {
  dateLabel: string;
  situation: string;
  message: string;
  reason?: string;
  sources?: string[];
  impact?: string;
  mode?: CoachEmotionalMode;
}

const CoachMemoryCard = ({
  dateLabel,
  situation,
  message,
  reason,
  sources = [],
  impact,
  mode = 'support',
}: CoachMemoryCardProps) => {
  const styles = coachModeStyles[mode];

  return (
    <section
      className={coachAnimations.calmEnter}
      style={{
        ...styles.containerStyle,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <div className="flex items-center justify-between">
        <p style={{ ...typography.micro, color: styles.accentColor }}>{dateLabel}</p>
        <p style={{ ...typography.micro, color: colors.text.muted }}>{situation}</p>
      </div>
      <h4 style={{ ...styles.titleStyle, marginTop: spacing.sm }}>Что сказал коуч</h4>
      <p style={{ ...styles.bodyStyle, marginTop: spacing.xs }}>{message}</p>
      {reason && (
        <p style={{ ...typography.micro, marginTop: spacing.sm }}>Почему: {reason}</p>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          {sources.map((source) => (
            <span
              key={source}
              style={{
                borderRadius: radius.pill,
                padding: `2px ${spacing.sm}px`,
                backgroundColor: colors.emotional.support,
                color: colors.text.secondary,
                fontSize: typography.micro.fontSize,
              }}
            >
              {source}
            </span>
          ))}
        </div>
      )}
      {impact && (
        <p style={{ ...typography.micro, marginTop: spacing.sm }}>Влияние: {impact}</p>
      )}
    </section>
  );
};

export default CoachMemoryCard;
