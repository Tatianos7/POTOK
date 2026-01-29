import type { ReactNode } from 'react';
import { coachAnimations } from './coachAnimations';
import { coachModeCopy, coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { typography } from '../theme/tokens';

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
    <section className={`rounded-2xl p-4 ${styles.container} ${coachAnimations.calmEnter} ${coachAnimations.softFade}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className={`${typography.micro} ${styles.accent}`}>{label}</p>
          <h3 className={styles.title}>Calm Power Coach</h3>
        </div>
        <div className="flex items-center gap-2">
          {voiceAction}
          {action}
        </div>
      </div>
      <p className={styles.body}>{message}</p>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
};

interface CoachMemoryChipProps {
  text: string;
}

export const CoachMemoryChip = ({ text }: CoachMemoryChipProps) => {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
      {text}
    </span>
  );
};

export default CoachMessageCard;
