import { X, Trash2 } from 'lucide-react';
import { FoodDisplayUnit } from '../utils/foodUnits';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { getSupportedFoodDisplayUnits } from '../utils/foodMeasurementPresets';
import {
  FoodDiaryMultiAddDraft,
  FoodDiaryMultiAddTotals,
  previewFoodDiaryMultiAddDraft,
} from '../utils/foodDiaryMultiAdd';

interface FoodMultiAddCartSheetProps {
  isOpen: boolean;
  drafts: FoodDiaryMultiAddDraft[];
  totals: FoodDiaryMultiAddTotals;
  highlightedKey: string | null;
  error: string | null;
  isSaving: boolean;
  canSave: boolean;
  onClose: () => void;
  onAddMore: () => void;
  onClear: () => void;
  onSave: () => void;
  onRemove: (key: string) => void;
  onChange: (key: string, patch: Partial<Pick<FoodDiaryMultiAddDraft, 'quantity' | 'unit'>>) => void;
}

const FoodMultiAddCartSheet = ({
  isOpen,
  drafts,
  totals,
  highlightedKey,
  error,
  isSaving,
  canSave,
  onClose,
  onAddMore,
  onClear,
  onSave,
  onRemove,
  onChange,
}: FoodMultiAddCartSheetProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => { if (!isSaving) onClose(); }}>
      <div
        className="w-full max-h-[82vh] overflow-hidden rounded-t-2xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Корзина приёма пищи
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {drafts.length} продукт(а) · {Math.round(totals.calories)} ккал
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            aria-label="Закрыть корзину"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden px-4 py-3 space-y-2">
          {drafts.map((draft) => {
            const preview = previewFoodDiaryMultiAddDraft(draft);
            const supportedUnits = getSupportedFoodDisplayUnits(draft.food);
            const isHighlighted = highlightedKey === draft.key;

            return (
              <div
                key={draft.key}
                className={`rounded-lg border px-2 py-2 transition-colors ${
                  isHighlighted
                    ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {getFoodDisplayName(draft.food)}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${
                      preview.isValid
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {preview.isValid
                        ? `${Math.round(preview.weight)} г · ${Math.round(preview.calories)} ккал · Б ${preview.protein.toFixed(1)} · Ж ${preview.fat.toFixed(1)} · У ${preview.carbs.toFixed(1)}`
                        : preview.error}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={draft.quantity}
                    disabled={isSaving}
                    onChange={(event) => onChange(draft.key, { quantity: event.target.value })}
                    min="0"
                    step={draft.unit === 'шт' ? '1' : '0.1'}
                    className={`w-20 px-2 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 ${
                      preview.isValid
                        ? 'border-gray-300 dark:border-gray-700'
                        : 'border-red-300 dark:border-red-700'
                    }`}
                    placeholder="100"
                    aria-label={`Граммы для ${getFoodDisplayName(draft.food)}`}
                  />
                  <select
                    value={draft.unit}
                    disabled={isSaving}
                    onChange={(event) =>
                      onChange(draft.key, { unit: event.target.value as FoodDisplayUnit })
                    }
                    className="w-16 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    aria-label={`Единица для ${getFoodDisplayName(draft.food)}`}
                  >
                    {supportedUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemove(draft.key)}
                    disabled={isSaving}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Удалить продукт"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
            Итого: {Math.round(totals.calories)} ккал · Б {totals.protein.toFixed(1)} · Ж {totals.fat.toFixed(1)} · У {totals.carbs.toFixed(1)}
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddMore}
              disabled={isSaving}
              className="px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs font-semibold text-green-700 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
            >
              Добавить ещё
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={isSaving || drafts.length === 0}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="flex-1 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
            >
              {isSaving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodMultiAddCartSheet;
