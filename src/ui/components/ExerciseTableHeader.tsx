import { colors, spacing, typography } from '../theme/tokens';

const ExerciseTableHeader = () => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr) 48px 48px 56px',
        alignItems: 'center',
        columnGap: spacing.sm,
        padding: `${spacing.sm}px 0`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div />
      <div style={{ ...typography.micro, color: colors.text.secondary }}>Название упражнения</div>
      <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Подходы</div>
      <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Повторы</div>
      <div style={{ ...typography.micro, textAlign: 'center', color: colors.text.secondary }}>Вес</div>
    </div>
  );
};

export default ExerciseTableHeader;
