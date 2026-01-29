import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';

interface CoachTimelineCommentProps {
  text: string;
  mode?: CoachEmotionalMode;
}

const CoachTimelineComment = ({ text, mode = 'support' }: CoachTimelineCommentProps) => {
  const styles = coachModeStyles[mode];

  return (
    <div className={`rounded-xl px-3 py-2 ${styles.container} ${coachAnimations.softSlide}`}>
      <p className={styles.body}>{text}</p>
    </div>
  );
};

export default CoachTimelineComment;
