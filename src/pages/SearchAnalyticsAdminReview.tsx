import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, MessageSquare, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  searchAdminReviewService,
  type SearchReviewCandidate,
  type SearchReviewItem,
  type SearchReviewQueueRow,
  type SearchReviewStatus,
} from '../services/searchAdminReviewService';

const statusLabel: Record<SearchReviewStatus, string> = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  snoozed: 'Отложено',
};

const eventTypeLabel = {
  not_found: 'Не найдено',
  ambiguous: 'Неоднозначно',
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CandidateButton = ({
  candidate,
  onCreate,
  disabled,
}: {
  candidate: SearchReviewCandidate;
  onCreate: (candidateId: string) => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    onClick={() => onCreate(candidate.canonical_food_id || candidate.id)}
    disabled={disabled}
    className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 hover:border-blue-300 dark:hover:border-blue-500 disabled:opacity-50"
  >
    <div className="text-sm font-medium text-gray-900 dark:text-white">{candidate.name}</div>
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span>{candidate.source}</span>
      {candidate.brand && <span>{candidate.brand}</span>}
    </div>
  </button>
);

const QueueRow = ({
  row,
  reviewerId,
  onUpdate,
  disabled,
}: {
  row: SearchReviewQueueRow;
  reviewerId: string;
  onUpdate: () => void;
  disabled: boolean;
}) => {
  const [comment, setComment] = useState(row.comment ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateStatus = async (status: Exclude<SearchReviewStatus, 'pending'>) => {
    setIsSubmitting(true);
    try {
      await searchAdminReviewService.updateQueueStatus(row.id, status, reviewerId, comment);
      onUpdate();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {statusLabel[row.status]}
          </div>
          <div className="mt-1 text-sm text-gray-900 dark:text-white">
            target: {row.suggested_canonical_food_id ?? 'без кандидата'}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">freq {row.frequency}</div>
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        placeholder="Комментарий"
        className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateStatus('approved')}
          disabled={disabled || isSubmitting || !row.suggested_canonical_food_id}
          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Одобрить
        </button>
        <button
          type="button"
          onClick={() => updateStatus('rejected')}
          disabled={disabled || isSubmitting}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Отклонить
        </button>
        <button
          type="button"
          onClick={() => updateStatus('snoozed')}
          disabled={disabled || isSubmitting}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Clock className="h-3.5 w-3.5" />
          Отложить
        </button>
      </div>
    </div>
  );
};

const SearchAnalyticsAdminReview = () => {
  const { user, authStatus } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SearchReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await searchAdminReviewService.getReviewItems());
    } catch (loadError: any) {
      setError(loadError?.message || 'Не удалось загрузить очередь');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authenticated' && user?.isAdmin) {
      void loadItems();
    }
  }, [authStatus, user?.isAdmin]);

  if (authStatus === 'booting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (authStatus === 'authenticated' && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const createPending = async (item: SearchReviewItem, candidateId?: string | null) => {
    setIsMutating(true);
    setError(null);
    try {
      await searchAdminReviewService.createOrUpdatePending(item, candidateId);
      await loadItems();
    } catch (mutationError: any) {
      setError(mutationError?.message || 'Не удалось обновить очередь');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Назад"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Search Review</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">not_found / ambiguous</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadItems()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </header>

        <main className="space-y-4 px-4 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Нет запросов для review.
            </div>
          )}

          {items.map((item) => (
            <section key={item.key} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                      {eventTypeLabel[item.eventType]}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      {item.context}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{item.query}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.normalizedQuery}</p>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <div>frequency: {item.frequency}</div>
                  <div>last_seen: {formatDateTime(item.lastSeen)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Search className="h-4 w-4" />
                    Candidates
                  </div>
                  <div className="space-y-2">
                    {item.candidates.length > 0 ? (
                      item.candidates.map((candidate) => (
                        <CandidateButton
                          key={candidate.id}
                          candidate={candidate}
                          onCreate={(candidateId) => void createPending(item, candidateId)}
                          disabled={isMutating}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Кандидатов нет.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void createPending(item, null)}
                      disabled={isMutating}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-blue-300 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-500"
                    >
                      Создать pending без кандидата
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <MessageSquare className="h-4 w-4" />
                    Pending queue
                  </div>
                  <div className="space-y-2">
                    {item.pendingRows.length > 0 ? (
                      item.pendingRows.map((row) => (
                        <QueueRow
                          key={row.id}
                          row={row}
                          reviewerId={user?.id ?? ''}
                          disabled={isMutating || !user?.id}
                          onUpdate={() => void loadItems()}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Pending rows ещё нет.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};

export default SearchAnalyticsAdminReview;
