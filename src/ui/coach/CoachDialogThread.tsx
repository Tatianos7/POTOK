import type { CoachDialogStatus, CoachDialogTurn } from '../../services/coachRuntime';

interface CoachDialogThreadProps {
  turns: CoachDialogTurn[];
  status: CoachDialogStatus;
  allowFollowups: boolean;
  onReply: (reply: string) => void;
  onEnd: () => void;
}

const quickReplies = [
  'Понял',
  'Объясни подробнее',
  'Что мне делать дальше?',
  'Поддержи меня',
  'Спасибо, достаточно',
];

const statusLabel: Record<CoachDialogStatus, string> = {
  thinking: 'Коуч думает…',
  responding: 'Ответ готов',
  safety: 'Сейчас важна безопасность',
  explainability: 'Показываю объяснение',
  cooldown: 'Сделаем паузу',
};

const CoachDialogThread = ({ turns, status, allowFollowups, onReply, onEnd }: CoachDialogThreadProps) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{statusLabel[status]}</p>
      <div className="mt-3 space-y-2">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`rounded-xl px-3 py-2 text-sm ${
              turn.role === 'user'
                ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                : 'bg-blue-50 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            }`}
          >
            <p className="text-[11px] uppercase text-gray-500 dark:text-gray-400">
              {turn.role === 'user' ? 'Вы' : 'Коуч'}
            </p>
            <p>{turn.message}</p>
          </div>
        ))}
      </div>
      {allowFollowups && (
        <div className="mt-3 grid gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => {
                if (reply === 'Спасибо, достаточно') {
                  onEnd();
                } else {
                  onReply(reply);
                }
              }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {reply}
            </button>
          ))}
        </div>
      )}
      {!allowFollowups && (
        <button
          type="button"
          onClick={onEnd}
          className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          Закрыть
        </button>
      )}
    </div>
  );
};

export default CoachDialogThread;
