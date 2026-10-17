import { Mic, ScanLine, TrendingUp } from 'lucide-react';
import Button from '../ui/components/Button';
import { colors, spacing } from '../ui/theme/tokens';
import FoodMultiAddCartButton from './FoodMultiAddCartButton';
import type { FoodDiaryMultiAddTotals } from '../utils/foodDiaryMultiAdd';

export function FoodDiaryBottomActions({ onBarcode, onAdd, onProgress }: {
  onBarcode: () => void;
  onAdd: () => void;
  onProgress: () => void;
}) {
  return (
    <div style={{ backgroundColor: colors.surface, borderTop: `1px solid ${colors.border}`, padding: spacing.sm }}>
      <div className="mx-auto" style={{ maxWidth: 560, minWidth: 320, padding: `0 ${spacing.lg}px` }}>
        <div className="flex items-center justify-between" style={{ gap: spacing.sm }}>
          <Button variant="ghost" size="sm" onClick={onBarcode}>
            <ScanLine className="w-6 h-6" style={{ color: colors.text.secondary }} />
          </Button>
          <Button variant="primary" size="lg" onClick={onAdd} style={{ flex: 1 }}>
            ДОБАВИТЬ ПРОДУКТ
          </Button>
          <Button variant="ghost" size="sm" onClick={onProgress} title="Прогресс питания" aria-label="Открыть прогресс питания">
            <TrendingUp className="w-6 h-6" style={{ color: colors.text.secondary }} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FoodSearchBottomActions({ onBarcode, onCart, onVoice, count, totals }: {
  onBarcode: () => void;
  onCart: () => void;
  onVoice: () => void;
  count: number;
  totals: FoodDiaryMultiAddTotals;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-3">
      <div className="container-responsive">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBarcode} className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ScanLine className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <FoodMultiAddCartButton count={count} totals={totals} onClick={onCart} />
          <button onClick={onVoice} className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Mic className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductEditorBottomActions({
  variant,
  addToFavorites,
  onFavoritesChange,
  onSave,
  isSaving,
  canSave,
}: {
  variant: 'custom' | 'brand';
  addToFavorites: boolean;
  onFavoritesChange: (value: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
}) {
  return (
    <footer className={`bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 ${variant === 'custom' ? 'px-2 sm:px-4 md:px-6 lg:px-8' : 'px-4'} py-4 space-y-3`}>
      <label className="flex items-center gap-3 cursor-pointer py-2">
        <input
          type="checkbox"
          checked={addToFavorites}
          onChange={(event) => onFavoritesChange(event.target.checked)}
          className="w-5 h-5 text-green-600 focus:ring-green-500 rounded border-gray-300 dark:border-gray-700 accent-green-600"
        />
        <span className="text-sm font-medium text-gray-900 dark:text-white">Добавить в избранное</span>
      </label>
      <button
        onClick={onSave}
        disabled={isSaving || !canSave}
        className="w-full py-3 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm uppercase hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
      </button>
    </footer>
  );
}
