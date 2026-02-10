import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface CoachExplainabilityProps {
  title?: string;
  reason: string;
  sources?: string[];
  confidence?: number;
  trustLevel?: string;
  safetyFlags?: string[];
  mode?: CoachEmotionalMode;
}

const CoachExplainability = ({
  title = 'Why this advice',
  reason,
  sources = [],
  confidence,
  trustLevel,
  safetyFlags = [],
  mode = 'reframe',
}: CoachExplainabilityProps) => {
  const styles = coachModeStyles[mode];

  return (
    <section
      style={{
        ...styles.containerStyle,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <h4 style={styles.titleStyle}>{title}</h4>
      <p style={{ ...styles.bodyStyle, marginTop: spacing.sm }}>{reason}</p>
      <div className="flex flex-col" style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {sources.length > 0 && (
          <div className="flex flex-col" style={{ gap: spacing.xs }}>
            <p style={typography.micro}>Sources</p>
            <div className="flex flex-wrap" style={{ gap: spacing.xs }}>
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
          </div>
        )}
        {typeof confidence === 'number' && (
          <p style={typography.micro}>Confidence: {Math.round(confidence * 100)}%</p>
        )}
        {trustLevel && <p style={typography.micro}>Trust level: {trustLevel}</p>}
        {safetyFlags.length > 0 && (
          <p style={typography.micro}>Safety flags: {safetyFlags.join(', ')}</p>
        )}
      </div>
    </section>
  );
};

export default CoachExplainability;
