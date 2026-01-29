import type { ReactNode } from 'react';
import { coachModeStyles } from './coachStyles';
import { coachAnimations } from './coachAnimations';

interface CoachSafetyBannerProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

const CoachSafetyBanner = ({ title = 'Safety first', message, action }: CoachSafetyBannerProps) => {
  const styles = coachModeStyles.protect;

  return (
    <div className={`rounded-xl px-4 py-3 ${styles.container} ${coachAnimations.calmEnter}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={styles.title}>{title}</p>
          <p className={styles.body}>{message}</p>
        </div>
        {action}
      </div>
    </div>
  );
};

export default CoachSafetyBanner;
