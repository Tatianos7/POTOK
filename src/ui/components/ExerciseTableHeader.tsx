import {
  EXERCISE_TABLE_CONTENT_GRID_COLUMNS,
  EXERCISE_TABLE_SHELL_GRID_COLUMNS,
} from './exerciseTableLayout';
import { colors, spacing, typography } from '../theme/tokens';

const ExerciseTableHeader = () => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: EXERCISE_TABLE_SHELL_GRID_COLUMNS,
        alignItems: 'center',
        columnGap: 0,
        padding: `${spacing.sm}px 0`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: EXERCISE_TABLE_CONTENT_GRID_COLUMNS,
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Упражнение</div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Подход</div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Повтор</div>
        <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
        <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Вес</div>
      </div>
    </div>
  );
};

export default ExerciseTableHeader;
