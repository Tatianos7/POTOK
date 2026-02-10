import type { ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { RuntimeStatus } from '../../services/uiRuntimeAdapter';
import Button from './Button';

interface StateContainerProps {
  status: RuntimeStatus;
  message?: string;
  onRetry?: () => void;
  children: ReactNode;
}

const StateContainer = ({ status, message, onRetry, children }: StateContainerProps) => {
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ padding: spacing.xl }}>
        <div
          className="animate-spin"
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.pill,
            border: `2px solid ${colors.border}`,
            borderTopColor: colors.primary,
          }}
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="flex flex-col"
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.danger}`,
          backgroundColor: colors.emotional.fatigue,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <p style={typography.body}>{message || 'Что-то пошло не так.'}</p>
        {onRetry && (
          <div>
            <Button onClick={onRetry} variant="outline" size="sm">
              Повторить
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        className="flex flex-col"
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.warning}`,
          backgroundColor: colors.emotional.fatigue,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <p style={typography.body}>Работаем офлайн. Данные могут быть неактуальны.</p>
        {onRetry && (
          <div>
            <Button onClick={onRetry} variant="outline" size="sm">
              Обновить
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (status === 'recovery') {
    return (
      <div
        className="flex flex-col"
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.emotional.support,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <p style={typography.body}>Идёт восстановление. Мы бережно вернём данные.</p>
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div
        className="flex flex-col"
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.emotional.support,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <p style={typography.body}>Данные доступны частично. Показываем то, что уже есть.</p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div
        className="flex flex-col"
        style={{
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.emotional.support,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <p style={typography.body}>{message || 'Данных пока нет.'}</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default StateContainer;
