import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, MessageSquare, Play, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { aliasApplyService, type AliasApplyResult } from '../services/aliasApplyService';
import { missingFoodReviewQueueService } from '../services/missingFoodReviewQueueService';
import {
  searchAdminReviewService,
  type SearchReviewClassification,
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

const classificationLabel: Record<SearchReviewClassification, string> = {
  alias_candidate: 'Alias candidate',
  missing_canonical_food: 'Missing food',
  ambiguous_broad_query: 'Ambiguous',
  typo_or_prefix: 'Шум/префикс',
};

const classificationActionLabel: Record<SearchReviewClassification, string> = {
  alias_candidate: 'Можно рассматривать Alias Apply',
  missing_canonical_food: 'Нужен missing food review',
  ambiguous_broad_query: 'Нужна дисамбигуация',
  typo_or_prefix: 'Шум/префикс',
};

const classificationClassName: Record<SearchReviewClassification, string> = {
  alias_candidate: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  missing_canonical_food: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  ambiguous_broad_query: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  typo_or_prefix: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const applyResultLabel: Record<AliasApplyResult, string> = {
  applied: 'Алиас добавлен',
  duplicate_alias: 'Алиас уже существует',
  existing_alias_conflict: 'Алиас занят другим продуктом',
  orphan_canonical: 'Целевой продукт не найден',
  invalid_canonical_source: 'Цель не из общей базы',
  not_approved: 'Сначала одобрите строку',
  ambiguous_alias: 'Запрос неоднозначный',
  missing_source_evidence: 'Нет исходных событий',
  already_applied: 'Уже применено',
  permission_denied: 'Нет прав',
  invalid_alias: 'Некорректный алиас',
  review_not_found: 'Строка review не найдена',
  insert_failed: 'Не удалось добавить',
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
  classification,
  reviewerId,
  onUpdate,
  disabled,
}: {
  row: SearchReviewQueueRow;
  classification: SearchReviewClassification;
  reviewerId: string;
  onUpdate: () => void;
  disabled: boolean;
}) => {
  const [comment, setComment] = useState(row.comment ?? '');
  const [alias, setAlias] = useState(row.query);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canApply = classification === 'alias_candidate' && row.status === 'approved' && !row.applied_alias_id;
  const isApplied = Boolean(row.applied_alias_id);

  useEffect(() => {
    setComment(row.comment ?? '');
    setAlias(row.query);
    setApplyMessage(null);
    setApplyError(null);
  }, [row.id, row.comment, row.query]);

  const updateStatus = async (status: Exclude<SearchReviewStatus, 'pending'>) => {
    setIsSubmitting(true);
    try {
      await searchAdminReviewService.updateQueueStatus(row.id, status, reviewerId, comment);
      onUpdate();
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyAlias = async () => {
    setIsSubmitting(true);
    setApplyMessage(null);
    setApplyError(null);
    try {
      const result = await aliasApplyService.applyApprovedAlias(row.id, alias, comment);
      const label = applyResultLabel[result.result];
      if (result.result === 'applied' || result.result === 'already_applied') {
        setApplyMessage(result.aliasId ? `${label}: ${result.aliasId}` : label);
      } else {
        setApplyError(result.error ? `${label}: ${result.error}` : label);
      }
      onUpdate();
    } catch (applyError: any) {
      setApplyError(applyError?.message || 'Не удалось применить алиас');
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
          {row.alias_apply_result && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              apply: {applyResultLabel[row.alias_apply_result]} ({row.alias_apply_result})
              {row.alias_apply_error ? ` · ${row.alias_apply_error}` : ''}
            </div>
          )}
          {isApplied && row.applied_alias_id && (
            <div className="mt-1 text-xs text-green-700 dark:text-green-300">alias: {row.applied_alias_id}</div>
          )}
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
      {row.status === 'pending' && (
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
      )}
      {row.status === 'approved' && classification === 'alias_candidate' && (
        <div className="mt-3 rounded-lg border border-green-100 bg-white px-3 py-3 dark:border-green-900 dark:bg-gray-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
            Alias Apply
          </div>
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            disabled={disabled || isSubmitting || isApplied}
            placeholder="Алиас"
            className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void applyAlias()}
            disabled={disabled || isSubmitting || !canApply}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Apply alias
          </button>
          {applyMessage && (
            <div className="mt-2 text-xs text-green-700 dark:text-green-300">{applyMessage}</div>
          )}
          {applyError && (
            <div className="mt-2 text-xs text-red-700 dark:text-red-300">{applyError}</div>
          )}
        </div>
      )}
      {row.status === 'approved' && classification !== 'alias_candidate' && (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {classificationActionLabel[classification]}
        </div>
      )}
    </div>
  );
};

const SearchAnalyticsAdminReview = () => {
  const { user, profile, authStatus } = useAuth();
  const adminAccessStatus = useAdminAccess({ authStatus, user, profile });
  const navigate = useNavigate();
  const [items, setItems] = useState<SearchReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [missingReviewMessage, setMissingReviewMessage] = useState<Record<string, string>>({});

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
    if (authStatus === 'authenticated' && adminAccessStatus === 'allowed') {
      void loadItems();
    }
  }, [authStatus, adminAccessStatus]);

  if (authStatus === 'booting' || adminAccessStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (authStatus === 'authenticated' && adminAccessStatus === 'denied') {
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

  const createMissingReview = async (item: SearchReviewItem) => {
    setIsMutating(true);
    setError(null);
    setMissingReviewMessage((current) => ({ ...current, [item.key]: '' }));
    try {
      await missingFoodReviewQueueService.createOrUpdatePending({
        item,
        suggestedName: item.query,
        comment: item.classificationReason,
      });
      setMissingReviewMessage((current) => ({ ...current, [item.key]: 'Добавлено в Missing Food Review' }));
    } catch (mutationError: any) {
      setError(mutationError?.message || 'Не удалось обновить Missing Food Review');
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
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${classificationClassName[item.classification]}`}>
                      {classificationLabel[item.classification]}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{item.query}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.normalizedQuery}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {classificationActionLabel[item.classification]} · {item.classificationReason}
                  </p>
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
                    {item.classification === 'missing_canonical_food' && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 dark:border-blue-900 dark:bg-blue-950">
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                          Missing Food Review
                        </div>
                        <div className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                          Нужен отдельный missing food review. Alias Apply недоступен, пока canonical food не существует.
                        </div>
                        <button
                          type="button"
                          onClick={() => void createMissingReview(item)}
                          disabled={isMutating}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          В missing review
                        </button>
                        {missingReviewMessage[item.key] && (
                          <div className="mt-2 text-xs text-blue-700 dark:text-blue-200">
                            {missingReviewMessage[item.key]}
                          </div>
                        )}
                      </div>
                    )}
                    {(item.classification === 'ambiguous_broad_query' || item.classification === 'typo_or_prefix') && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {item.classification === 'ambiguous_broad_query'
                          ? 'Нужна дисамбигуация: не отправляйте широкий запрос в Missing Food Review или Alias Apply без отдельного решения.'
                          : 'Шум/префикс: используйте reject/snooze, не создавая food или alias.'}
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
                    Review queue
                  </div>
                  <div className="space-y-2">
                    {item.pendingRows.length > 0 ? (
                      item.pendingRows.map((row) => (
                        <QueueRow
                          key={row.id}
                          row={row}
                          classification={item.classification}
                          reviewerId={user?.id ?? ''}
                          disabled={isMutating || !user?.id}
                          onUpdate={() => void loadItems()}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Review rows ещё нет.
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
