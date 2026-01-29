import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';
import { typography } from '../theme/tokens';

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
    <section className={`rounded-2xl p-4 ${styles.container} ${coachAnimations.calmEnter}`}>
      <div className="flex items-center justify-between">
        <p className={`${typography.micro} ${styles.accent}`}>{dateLabel}</p>
        <p className={`${typography.micro} text-gray-500 dark:text-gray-400`}>{situation}</p>
      </div>
      <h4 className={`mt-2 ${styles.title}`}>Что сказал коуч</h4>
      <p className={`${styles.body} mt-1`}>{message}</p>
      {reason && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Почему: {reason}</p>
      )}
      {sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sources.map((source) => (
            <span key={source} className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {source}
            </span>
          ))}
        </div>
      )}
      {impact && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Влияние: {impact}</p>
      )}
    </section>
  );
};

export default CoachMemoryCard;
