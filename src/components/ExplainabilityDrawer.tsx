import { useState } from 'react';
import type { BaseExplainabilityDTO } from '../types/explainability';

interface ExplainabilityDrawerProps {
  title?: string;
  explainability?: BaseExplainabilityDTO | null;
}

const ExplainabilityDrawer = ({ title = 'Почему так?', explainability }: ExplainabilityDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!explainability) return null;

  return (
    <div className="w-full max-w-full">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {title}
      </button>
      {isOpen && (
        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-xs text-gray-700 dark:text-gray-300 space-y-2">
          <div>
            <span className="font-semibold">Решение:</span> {explainability.decision_ref}
          </div>
          <div>
            <span className="font-semibold">Уверенность:</span> {Math.round(explainability.confidence * 100)}%
          </div>
          <div>
            <span className="font-semibold">Trust:</span> {explainability.trust_score}
          </div>
          <div>
            <span className="font-semibold">Источники:</span> {explainability.data_sources.join(', ')}
          </div>
          {explainability.safety_notes?.length > 0 && (
            <div>
              <span className="font-semibold">Безопасность:</span> {explainability.safety_notes.join(' · ')}
            </div>
          )}
          {explainability.adaptation_reason && (
            <div>
              <span className="font-semibold">Причина:</span> {explainability.adaptation_reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplainabilityDrawer;
