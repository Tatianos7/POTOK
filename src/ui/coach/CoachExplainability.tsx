import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { typography } from '../theme/tokens';

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
    <section className={`rounded-2xl p-4 ${styles.container}`}>
      <h4 className={styles.title}>{title}</h4>
      <p className={`${styles.body} mt-2`}>{reason}</p>
      <div className="mt-3 space-y-2">
        {sources.length > 0 && (
          <div>
            <p className={typography.micro}>Sources</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => (
                <span key={source} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}
        {typeof confidence === 'number' && (
          <p className={typography.micro}>Confidence: {Math.round(confidence * 100)}%</p>
        )}
        {trustLevel && <p className={typography.micro}>Trust level: {trustLevel}</p>}
        {safetyFlags.length > 0 && (
          <p className={typography.micro}>Safety flags: {safetyFlags.join(', ')}</p>
        )}
      </div>
    </section>
  );
};

export default CoachExplainability;
