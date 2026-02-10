import { colors, radius } from '../theme/tokens';

interface ProgressBarProps {
  value: number;
  max: number;
}

const ProgressBar = ({ value, max }: ProgressBarProps) => {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: '100%',
          backgroundColor: colors.primary,
        }}
      />
    </div>
  );
};

export default ProgressBar;
