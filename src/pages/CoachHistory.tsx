import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import CoachExplainabilityTimeline from '../ui/coach/CoachExplainabilityTimeline';
import TrustEvolutionIndicator from '../ui/coach/TrustEvolutionIndicator';
import type { CoachDecisionHistoryItem } from '../services/coachRuntime';

const CoachHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [items, setItems] = useState<CoachDecisionHistoryItem[]>([]);
  const [trustNarrative, setTrustNarrative] = useState<string>('Доверие выстраивается постепенно.');
  const [notice, setNotice] = useState<string | null>(null);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setNotice(null);
    Promise.all([
      uiRuntimeAdapter.getCoachHistory({ from: range.from, to: range.to }),
      uiRuntimeAdapter.getTrustNarrative(),
    ])
      .then(([history, narrative]) => {
        setItems(history);
        setTrustNarrative(narrative);
        setRuntimeStatus('active');
      })
      .catch(() => {
        setRuntimeStatus('error');
        setNotice('Не удалось загрузить историю коуча.');
      });
  }, [range.from, range.to, user?.id]);

  const handleClearHistory = async () => {
    await uiRuntimeAdapter.clearCoachHistory();
    setItems([]);
    setNotice('История коуча очищена.');
  };

  const handleResetTrust = async () => {
    await uiRuntimeAdapter.resetCoachTrust();
    setTrustNarrative('Стиль общения сброшен. Коуч будет начинать мягко.');
    setNotice('Стиль общения сброшен.');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase text-center flex-1">
            История рекомендаций
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <main className="py-4 tablet:py-6">
          <StateContainer
            status={runtimeStatus}
            message={runtimeStatus === 'error' ? notice || 'Не удалось загрузить историю.' : undefined}
            onRetry={() => window.location.reload()}
          >
            {notice && runtimeStatus !== 'error' && (
              <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {notice}
              </div>
            )}

            <Card title="Эволюция доверия">
              <TrustEvolutionIndicator narrative={trustNarrative} />
            </Card>

            <Card title="История объяснений коуча">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Мы объясняем, почему коуч вмешался и на чём основывался.
              </p>
              <div className="mt-3">
                <CoachExplainabilityTimeline items={items} />
              </div>
            </Card>

            <Card title="Контроль">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Это не удаляет данные прогресса, только память диалогов и выводов.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={handleClearHistory}
                  className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Очистить историю коуча
                </button>
                <button
                  onClick={handleResetTrust}
                  className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Сбросить стиль общения
                </button>
              </div>
            </Card>
          </StateContainer>
        </main>
      </div>
    </div>
  );
};

export default CoachHistory;
