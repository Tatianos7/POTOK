import type { ReactNode } from 'react';
import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';
import { typography } from '../theme/tokens';

interface CoachNudgeProps {
  label?: string;
  message: string;
  mode?: CoachEmotionalMode;
  action?: ReactNode;
}

const CoachNudge = ({ label = 'Coach Nudge', message, mode = 'support', action }: CoachNudgeProps) => {
  const styles = coachModeStyles[mode];

  return (
    <div className={`rounded-xl px-4 py-3 ${styles.container} ${coachAnimations.gentlePulse} ${coachAnimations.softFade}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`${typography.micro} ${styles.accent}`}>{label}</p>
          <p className={styles.body}>{message}</p>
        </div>
        {action}
      </div>
    </div>
  );
};

export const CoachDailyNudge = ({ message, mode = 'support', action }: Omit<CoachNudgeProps, 'label'>) => {
  return <CoachNudge label="Daily Nudge" message={message} mode={mode} action={action} />;
};

export default CoachNudge;
