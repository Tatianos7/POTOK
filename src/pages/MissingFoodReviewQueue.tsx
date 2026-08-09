import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, Clock, FlaskConical, RefreshCw, Save, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminAccess } from '../hooks/useAdminAccess';
import {
  missingFoodDraftService,
  validateMissingFoodDraft,
  type EditableMissingFoodDraftStatus,
  type MissingFoodDraftDuplicate,
  type MissingFoodDraftRow,
} from '../services/missingFoodDraftService';
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

const draftStatusLabels: Record<EditableMissingFoodDraftStatus, string> = {
  draft: 'Draft',
  needs_revision: 'Needs revision',
  ready_for_owner_apply: 'Ready for owner apply',
  rejected: 'Rejected draft',
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

const parseOptionalNumber = (value: string): number | null => {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatOptionalNumber = (value: number | null | undefined): string => {
  return value === null || value === undefined ? '' : String(value);
};

const DraftPanel = ({
  row,
  draft,
  reviewerId,
  disabled,
  onSaved,
}: {
  row: MissingFoodReviewQueueRow;
  draft?: MissingFoodDraftRow;
  reviewerId: string;
  disabled: boolean;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(draft?.name ?? row.suggested_name ?? row.query);
  const [category, setCategory] = useState(draft?.category ?? row.suggested_category ?? '');
  const [calories, setCalories] = useState(formatOptionalNumber(draft?.calories));
  const [protein, setProtein] = useState(formatOptionalNumber(draft?.protein));
  const [fat, setFat] = useState(formatOptionalNumber(draft?.fat));
  const [carbs, setCarbs] = useState(formatOptionalNumber(draft?.carbs));
  const [fiber, setFiber] = useState(formatOptionalNumber(draft?.fiber));
  const [dataSource, setDataSource] = useState(draft?.data_source ?? '');
  const [sourceUrl, setSourceUrl] = useState(draft?.source_url ?? '');
  const [sourceNotes, setSourceNotes] = useState(draft?.source_notes ?? '');
  const [reviewerNotes, setReviewerNotes] = useState(draft?.reviewer_notes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<MissingFoodDraftDuplicate[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setName(draft?.name ?? row.suggested_name ?? row.query);
    setCategory(draft?.category ?? row.suggested_category ?? '');
    setCalories(formatOptionalNumber(draft?.calories));
    setProtein(formatOptionalNumber(draft?.protein));
    setFat(formatOptionalNumber(draft?.fat));
    setCarbs(formatOptionalNumber(draft?.carbs));
    setFiber(formatOptionalNumber(draft?.fiber));
    setDataSource(draft?.data_source ?? '');
    setSourceUrl(draft?.source_url ?? '');
    setSourceNotes(draft?.source_notes ?? '');
    setReviewerNotes(draft?.reviewer_notes ?? '');
    setMessage(null);
    setError(null);
  }, [draft?.id, row.id, row.query, row.suggested_name, row.suggested_category]);

  const draftInput = {
    sourceReviewId: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    reviewerId,
    name,
    category,
    calories: parseOptionalNumber(calories),
    protein: parseOptionalNumber(protein),
    fat: parseOptionalNumber(fat),
    carbs: parseOptionalNumber(carbs),
    fiber: parseOptionalNumber(fiber),
    dataSource,
    sourceUrl,
    sourceNotes,
    reviewerNotes,
  };

  const validation = validateMissingFoodDraft({
    ...draftInput,
    status: 'ready_for_owner_apply',
  });

  useEffect(() => {
    const normalizedName = validation.normalizedName;
    if (!normalizedName) {
      setDuplicates([]);
      return;
    }

    let cancelled = false;
    setIsCheckingDuplicates(true);
    missingFoodDraftService
      .findDuplicateFoods(normalizedName)
      .then((matches) => {
        if (!cancelled) setDuplicates(matches);
      })
      .catch(() => {
        if (!cancelled) setDuplicates([]);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingDuplicates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [validation.normalizedName]);

  const saveDraft = async (status: EditableMissingFoodDraftStatus) => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await missingFoodDraftService.saveDraft({
        ...draftInput,
        status,
      });
      setMessage(draftStatusLabels[status]);
      onSaved();
    } catch (saveError: any) {
      setError(saveError?.message || 'Не удалось сохранить food draft');
    } finally {
      setIsSaving(false);
    }
  };

  const applyOwnerDraft = async () => {
    if (!draft || draft.status !== 'ready_for_owner_apply' || draft.applied_food_id) return;

    const confirmed = window.confirm(
      'Owner apply food создаст 1 core food из этого draft. Aliases не создаст. Продолжить?'
    );
    if (!confirmed) return;

    setIsApplying(true);
    setMessage(null);
    setError(null);
    try {
      const result = await missingFoodDraftService.applyOwnerApprovedDraft(draft.id);
      const details = result.foodId ? ` food_id: ${result.foodId}` : '';
      if (result.result === 'applied') {
        setMessage(`Owner apply result: ${result.result}.${details}`);
      } else {
        setError(`Owner apply result: ${result.result}. ${result.error ?? ''}`.trim());
      }
      onSaved();
    } catch (applyError: any) {
      setError(applyError?.message || 'Не удалось выполнить owner apply food');
    } finally {
      setIsApplying(false);
    }
  };

  const actionDisabled = disabled || isSaving || isApplying || !reviewerId;
  const ownerApplyVisible = draft?.status === 'ready_for_owner_apply';
  const ownerApplyDisabled = actionDisabled || isApplying || !draft || Boolean(draft.applied_food_id);

  return (
    <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Food draft</h3>
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            {draft ? `${draftStatusLabels[draft.status as EditableMissingFoodDraftStatus] ?? draft.status} · ${draft.id}` : 'Draft row ещё не создана'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-white px-2 py-1 font-medium text-emerald-800 dark:bg-gray-900 dark:text-emerald-200">
            source: core
          </span>
          <span className="rounded bg-white px-2 py-1 font-medium text-emerald-800 dark:bg-gray-900 dark:text-emerald-200">
            unit: g
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Category
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        {[
          ['Calories', calories, setCalories],
          ['Protein', protein, setProtein],
          ['Fat', fat, setFat],
          ['Carbs', carbs, setCarbs],
          ['Fiber', fiber, setFiber],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label as string}
            <input
              value={value as string}
              onChange={(event) => (setter as (next: string) => void)(event.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Data source
          <input
            value={dataSource}
            onChange={(event) => setDataSource(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Source URL
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Source notes
          <textarea
            value={sourceNotes}
            onChange={(event) => setSourceNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Reviewer notes
          <textarea
            value={reviewerNotes}
            onChange={(event) => setReviewerNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </div>

      {duplicates.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Duplicate warning
          </div>
          <div className="mt-1">
            {duplicates.map((duplicate) => `${duplicate.name} (${duplicate.source})`).join(', ')}
          </div>
        </div>
      )}

      {validation.errors.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {validation.errors.join(' ')}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveDraft('draft')}
          disabled={actionDisabled}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save draft
        </button>
        <button
          type="button"
          onClick={() => void saveDraft('needs_revision')}
          disabled={actionDisabled}
          className="inline-flex items-center gap-1 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          Needs revision
        </button>
        <button
          type="button"
          onClick={() => void saveDraft('ready_for_owner_apply')}
          disabled={actionDisabled || !validation.isComplete || duplicates.length > 0 || isCheckingDuplicates}
          className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Ready for owner apply
        </button>
        <button
          type="button"
          onClick={() => void saveDraft('rejected')}
          disabled={actionDisabled}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject draft
        </button>
        {ownerApplyVisible && (
          <button
            type="button"
            onClick={() => void applyOwnerDraft()}
            disabled={ownerApplyDisabled}
            className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Owner apply food
          </button>
        )}
      </div>

      {draft?.applied_food_id && (
        <div className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
          Applied food: {draft.applied_food_id}
        </div>
      )}

      {message && <div className="mt-2 text-xs text-green-700 dark:text-green-300">{message}</div>}
      {error && <div className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</div>}
    </section>
  );
};

const RowEditor = ({
  row,
  draft,
  reviewerId,
  disabled,
  onSaved,
}: {
  row: MissingFoodReviewQueueRow;
  draft?: MissingFoodDraftRow;
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

      {row.status === 'approved_for_food_draft' && (
        <DraftPanel
          row={row}
          draft={draft}
          reviewerId={reviewerId}
          disabled={disabled}
          onSaved={onSaved}
        />
      )}
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
  const [draftsByReviewId, setDraftsByReviewId] = useState<Record<string, MissingFoodDraftRow>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({ status, classification, context }), [status, classification, context]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextRows = await missingFoodReviewQueueService.getRows(filters);
      setRows(nextRows);
      const draftRows = await missingFoodDraftService.getDraftsByReviewIds(
        nextRows.filter((row) => row.status === 'approved_for_food_draft').map((row) => row.id)
      );
      setDraftsByReviewId(
        Object.fromEntries(draftRows.map((draft) => [draft.source_review_id, draft]))
      );
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
                draft={draftsByReviewId[row.id]}
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
