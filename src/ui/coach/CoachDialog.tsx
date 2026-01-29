import type { ReactNode } from 'react';
import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';

interface CoachDialogProps {
  title: string;
  message: string;
  mode?: CoachEmotionalMode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

const CoachDialog = ({
  title,
  message,
  mode = 'support',
  primaryAction,
  secondaryAction,
}: CoachDialogProps) => {
  const styles = coachModeStyles[mode];

  return (
    <section className={`rounded-2xl p-5 ${styles.container} ${coachAnimations.calmEnter}`}>
      <h3 className={styles.title}>{title}</h3>
      <p className={`${styles.body} mt-2`}>{message}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </section>
  );
};

export const CoachRecoveryDialog = ({
  message,
  primaryAction,
  secondaryAction,
}: Omit<CoachDialogProps, 'title' | 'mode'>) => {
  return (
    <CoachDialog
      title="Recovery"
      message={message}
      mode="reframe"
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    />
  );
};

export default CoachDialog;
