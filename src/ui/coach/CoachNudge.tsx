import type { ReactNode } from 'react';
import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';
import { radius, spacing, typography } from '../theme/tokens';

interface CoachNudgeProps {
  label?: string;
  message: string;
  mode?: CoachEmotionalMode;
  action?: ReactNode;
}

const CoachNudge = ({ label = 'Coach Nudge', message, mode = 'support', action }: CoachNudgeProps) => {
  const styles = coachModeStyles[mode];

  return (
    <div
      className={`${coachAnimations.gentlePulse} ${coachAnimations.softFade}`}
      style={{
        ...styles.containerStyle,
        borderRadius: radius.md,
        padding: `${spacing.sm}px ${spacing.md}px`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p style={{ ...typography.micro, color: styles.accentColor }}>{label}</p>
          <p style={styles.bodyStyle}>{message}</p>
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
