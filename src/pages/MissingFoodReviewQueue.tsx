import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, FlaskConical, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminAccess } from '../hooks/useAdminAccess';
import {
  missingFoodReviewQueueService,
  type MissingFoodReviewQueueRow,
  type MissingFoodReviewStatus,
  type MissingFoodReviewSuggestedSource,
} from '../services/missingFoodReviewQueueService';
import type { SearchReviewClassification } from '../services/searchAdminReviewService';
import type { FoodSearchAnalyticsContext } from '../services/searchAnalyticsService';

const statusLabels: Record<MissingFoodReviewStatus, string> = {
  pending: 'На проверке',
  needs_research: 'Нужно исследовать',
  approved_for_food_draft: 'Одобрено для food draft',
  rejected: 'Отклонено',
  snoozed: 'Отложено',
};

const classificationLabels: Record<SearchReviewClassification, string> = {
  alias_candidate: 'Alias candidate',
  missing_canonical_food: 'Missing food',
  ambiguous_broad_query: 'Ambiguous',
  typo_or_prefix: 'Шум/префикс',
};

const contextOptions: Array<FoodSearchAnalyticsContext | 'all'> = ['all', 'diary', 'recipe', 'favorites', 'barcode', 'admin', 'other'];
const statusOptions: Array<MissingFoodReviewStatus | 'all'> = ['all', 'pending', 'needs_research', 'approved_for_food_draft', 'rejected', 'snoozed'];
const classificationOptions: Array<SearchReviewClassification | 'all'> = ['all', 'missing_canonical_food', 'ambiguous_broad_query', 'typo_or_prefix', 'alias_candidate'];
const suggestedSourceOptions: Array<MissingFoodReviewSuggestedSource | ''> = ['', 'core', 'brand', 'barcode', 'open_food_facts', 'other'];

const canChangeStatus = (row: MissingFoodReviewQueueRow, next: MissingFoodReviewStatus): boolean => {
  if (next === 'needs_research') return row.status === 'pending';
  if (next === 'approved_for_food_draft') return row.status === 'pending' || row.status === 'needs_research';
  if (next === 'rejected' || next === 'snoozed') return row.status === 'pending' || row.status === 'needs_research';
  return false;
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RowEditor = ({
  row,
  reviewerId,
  disabled,
  onSaved,
}: {
  row: MissingFoodReviewQueueRow;
  reviewerId: string;
  disabled: boolean;
  onSaved: () => void;
}) => {
  const [suggestedName, setSuggestedName] = useState(row.suggested_name ?? '');
  const [suggestedCategory, setSuggestedCategory] = useState(row.suggested_category ?? '');
  const [suggestedSource, setSuggestedSource] = useState<MissingFoodReviewSuggestedSource | ''>((row.suggested_source as MissingFoodReviewSuggestedSource | null) ?? '');
  const [comment, setComment] = useState(row.comment ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSuggestedName(row.suggested_name ?? '');
    setSuggestedCategory(row.suggested_category ?? '');
    setSuggestedSource((row.suggested_source as MissingFoodReviewSuggestedSource | null) ?? '');
    setComment(row.comment ?? '');
    setMessage(null);
    setError(null);
  }, [row.id, row.suggested_name, row.suggested_category, row.suggested_source, row.comment]);

  const save = async (status?: Exclude<MissingFoodReviewStatus, 'pending'>) => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await missingFoodReviewQueueService.updateRow({
        rowId: row.id,
        reviewerId,
        status,
        suggestedName,
        suggestedCategory,
        suggestedSource: suggestedSource || null,
        comment,
      });
      setMessage(status ? statusLabels[status] : 'Сохранено');
      onSaved();
    } catch (saveError: any) {
      setError(saveError?.message || 'Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  };

  const approveDisabled = !suggestedName.trim() || row.classification !== 'missing_canonical_food';
  const actionDisabled = disabled || isSaving || !reviewerId;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {statusLabels[row.status]}
            </span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {classificationLabels[row.classification]}
            </span>
            {row.context && (
              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {row.context}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{row.query}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.normalized_query}</p>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          <div>frequency: {row.frequency}</div>
          <div>created: {formatDateTime(row.created_at)}</div>
          <div>updated: {formatDateTime(row.updated_at)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Suggested name
          <input
            value={suggestedName}
            onChange={(event) => setSuggestedName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Category
          <input
            value={suggestedCategory}
            onChange={(event) => setSuggestedCategory(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Source
          <select
            value={suggestedSource}
            onChange={(event) => setSuggestedSource(event.target.value as MissingFoodReviewSuggestedSource | '')}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {suggestedSourceOptions.map((option) => (
              <option key={option || 'empty'} value={option}>
                {option || 'Не выбрано'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium text-gray-700 dark:text-gray-300">
        Comment
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={actionDisabled}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => void save('needs_research')}
          disabled={actionDisabled || !canChangeStatus(row, 'needs_research')}
          className="inline-flex items-center gap-1 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          Needs research
        </button>
        <button
          type="button"
          onClick={() => void save('approved_for_food_draft')}
          disabled={actionDisabled || !canChangeStatus(row, 'approved_for_food_draft') || approveDisabled}
          className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Approve food draft
        </button>
        <button
          type="button"
          onClick={() => void save('rejected')}
          disabled={actionDisabled || !canChangeStatus(row, 'rejected')}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
        <button
          type="button"
          onClick={() => void save('snoozed')}
          disabled={actionDisabled || !canChangeStatus(row, 'snoozed')}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Clock className="h-3.5 w-3.5" />
          Snooze
        </button>
      </div>

      {message && <div className="mt-2 text-xs text-green-700 dark:text-green-300">{message}</div>}
      {error && <div className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</div>}
    </article>
  );
};

const MissingFoodReviewQueue = () => {
  const { user, profile, authStatus } = useAuth();
  const adminAccessStatus = useAdminAccess({ authStatus, user, profile });
  const navigate = useNavigate();
  const [status, setStatus] = useState<MissingFoodReviewStatus | 'all'>('all');
  const [classification, setClassification] = useState<SearchReviewClassification | 'all'>('all');
  const [context, setContext] = useState<FoodSearchAnalyticsContext | 'all'>('all');
  const [rows, setRows] = useState<MissingFoodReviewQueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({ status, classification, context }), [status, classification, context]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await missingFoodReviewQueueService.getRows(filters));
    } catch (loadError: any) {
      setError(loadError?.message || 'Не удалось загрузить Missing Food Review');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authenticated' && adminAccessStatus === 'allowed') {
      void loadRows();
    }
  }, [authStatus, adminAccessStatus, filters]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
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
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Missing Food Review</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">food_missing_review_queue</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadRows()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </header>

        <main className="space-y-4 px-4 py-4">
          <section className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as MissingFoodReviewStatus | 'all')}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'Все' : statusLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Classification
              <select
                value={classification}
                onChange={(event) => setClassification(event.target.value as SearchReviewClassification | 'all')}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {classificationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'Все' : classificationLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Context
              <select
                value={context}
                onChange={(event) => setContext(event.target.value as FoodSearchAnalyticsContext | 'all')}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {contextOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'Все' : option}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Нет строк Missing Food Review.
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row) => (
              <RowEditor
                key={row.id}
                row={row}
                reviewerId={user?.id ?? ''}
                disabled={isLoading || !user?.id}
                onSaved={() => void loadRows()}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MissingFoodReviewQueue;
