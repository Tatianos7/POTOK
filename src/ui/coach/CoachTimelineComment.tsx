import { coachModeStyles, type CoachEmotionalMode } from './coachStyles';
import { coachAnimations } from './coachAnimations';

interface CoachTimelineCommentProps {
  text: string;
  mode?: CoachEmotionalMode;
}

const CoachTimelineComment = ({ text, mode = 'support' }: CoachTimelineCommentProps) => {
  const styles = coachModeStyles[mode];

  return (
    <div className={`rounded-xl px-3 py-2 ${coachAnimations.softSlide}`} style={styles.containerStyle}>
      <p style={styles.bodyStyle}>{text}</p>
    </div>
  );
};

export default CoachTimelineComment;
