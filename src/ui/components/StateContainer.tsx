import type { ReactNode } from 'react';
import { borders, surfaces, typography } from '../theme/tokens';
import type { RuntimeStatus } from '../../services/uiRuntimeAdapter';

interface StateContainerProps {
  status: RuntimeStatus;
  message?: string;
  onRetry?: () => void;
  children: ReactNode;
}

const StateContainer = ({ status, message, onRetry, children }: StateContainerProps) => {
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`rounded-2xl ${surfaces.error} ${borders.error} p-4 mb-4`}>
        <p className={typography.body}>{message || 'Что-то пошло не так.'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            Повторить
          </button>
        )}
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className={`rounded-2xl ${surfaces.warn} ${borders.warn} p-4 mb-4`}>
        <p className={typography.body}>
          Работаем офлайн. Данные могут быть неактуальны.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            Обновить
          </button>
        )}
      </div>
    );
  }

  if (status === 'recovery') {
    return (
      <div className={`rounded-2xl ${surfaces.info} ${borders.base} p-4 mb-4`}>
        <p className={typography.body}>Идёт восстановление. Мы бережно вернём данные.</p>
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div className={`rounded-2xl ${surfaces.muted} ${borders.base} p-4 mb-4`}>
        <p className={typography.body}>Данные доступны частично. Показываем то, что уже есть.</p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className={`rounded-2xl ${surfaces.muted} ${borders.base} p-4 mb-4`}>
        <p className={typography.body}>{message || 'Данных пока нет.'}</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default StateContainer;
