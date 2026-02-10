import { colors } from '../theme/tokens';

interface DividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const Divider = ({ className, orientation = 'horizontal' }: DividerProps) => {
  if (orientation === 'vertical') {
    return (
      <div
        className={className}
        style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }}
      />
    );
  }
  return <div className={className} style={{ height: 1, backgroundColor: colors.border }} />;
};

export default Divider;
