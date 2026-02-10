import { useMemo, useState } from 'react';
import CoachExplainabilityDrawer from './CoachExplainabilityDrawer';
import CoachDialogThread from './CoachDialogThread';
import { uiRuntimeAdapter } from '../../services/uiRuntimeAdapter';
import type {
  CoachDialogResponse,
  CoachRequestIntent,
  CoachScreenContext,
} from '../../services/coachRuntime';

interface CoachRequestModalProps {
  open: boolean;
  onClose: () => void;
  context: CoachScreenContext;
}

const CoachRequestModal = ({ open, onClose, context }: CoachRequestModalProps) => {
  const [dialog, setDialog] = useState<CoachDialogResponse | null>(null);
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const intents = useMemo(() => {
    const base = [
      { id: 'explain', label: 'Объясни, что происходит' },
      { id: 'motivate', label: 'Подскажи, что делать дальше' },
      { id: 'support', label: 'Поддержи меня' },
      { id: 'clarify', label: 'Объясни изменения в плане' },
      { id: 'reassure', label: 'Я чувствую усталость / тревогу / сомнения' },
    ];
    if (context.screen !== 'Program') {
      return base.filter((item) => item.id !== 'clarify');
    }
    return base;
  }, [context.screen]);

  const handleRequest = async (intent: CoachRequestIntent) => {
    setIsLoading(true);
    setNotice(null);
    try {
      const result = await uiRuntimeAdapter.requestCoachDialogStart(intent, context);
      setDialog(result);
      setDialogId(result.dialogId);
      if (!result.turns.length) {
        setNotice('Коуч сейчас в режиме тишины.');
      }
    } catch (error) {
      setNotice('Не удалось получить ответ коуча.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async (reply: string) => {
    if (!dialogId) return;
    setIsLoading(true);
    try {
      const result = await uiRuntimeAdapter.requestCoachDialogContinue(dialogId, reply);
      setDialog((prev) =>
        prev
          ? { ...prev, turns: [...prev.turns, ...result.turns], status: result.status, allowFollowups: result.allowFollowups }
          : result
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnd = async () => {
    if (dialogId) {
      await uiRuntimeAdapter.requestCoachDialogEnd(dialogId);
    }
    setDialog(null);
    setDialogId(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">Спросить коуча</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {intents.map((intent) => (
            <button
              key={intent.id}
              type="button"
              onClick={() => handleRequest(intent.id as CoachRequestIntent)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {intent.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Коуч отвечает…</p>
        )}
        {notice && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{notice}</p>
        )}

        {dialog && (
          <div className="mt-4 space-y-3">
            <CoachDialogThread
              turns={dialog.turns}
              status={dialog.status}
              allowFollowups={dialog.allowFollowups}
              onReply={handleReply}
              onEnd={handleEnd}
            />
            {dialog.turns[dialog.turns.length - 1]?.explainability && (
              <CoachExplainabilityDrawer
                decisionId={dialog.turns[dialog.turns.length - 1]?.decisionId}
                trace={dialog.turns[dialog.turns.length - 1]?.explainability ?? null}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachRequestModal;
