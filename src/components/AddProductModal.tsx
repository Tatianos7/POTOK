import { useState } from 'react';
import { X } from 'lucide-react';
import type { Food } from '../types';
import { getFoodDisplayName } from '../utils/foodDisplayName';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MyProductsStatus = 'idle' | 'loading' | 'ready' | 'error';

const mealOptions: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'dinner', label: 'Ужин' },
  { value: 'snack', label: 'Перекус' },
];

interface AddProductModalProps {
  onClose: () => void;
  onFindProduct?: () => void;
  onMyProducts?: () => void;
  myProducts?: Food[];
  myProductsStatus?: MyProductsStatus;
  myProductsError?: string | null;
  onSelectMyProduct?: (food: Food, mealType: MealType) => void;
  onBrandInput?: () => void;
  onCustomInput?: () => void;
  onRecipeAnalyzer?: () => void;
}

type AddProductModalAction = {
  label: string;
  onClick: () => void;
};

export const buildAddProductModalActions = ({
  onClose,
  onFindProduct,
  onMyProducts,
  onBrandInput,
  onCustomInput,
  onRecipeAnalyzer,
}: AddProductModalProps): AddProductModalAction[] => [
  { label: 'Найти продукт', onClick: onFindProduct || onClose },
  { label: 'Мои продукты', onClick: onMyProducts || onClose },
  { label: 'Ввод марки продукта', onClick: onBrandInput || onClose },
  { label: 'Ввод своего продукта', onClick: onCustomInput || onClose },
  { label: 'Анализатор рецепта', onClick: onRecipeAnalyzer || onClose },
];

const AddProductModal = ({
  onClose,
  onFindProduct,
  onMyProducts,
  myProducts = [],
  myProductsStatus = 'idle',
  myProductsError,
  onSelectMyProduct,
  onBrandInput,
  onCustomInput,
  onRecipeAnalyzer,
}: AddProductModalProps) => {
  const [view, setView] = useState<'actions' | 'my-products'>('actions');
  const [myProductsMealType, setMyProductsMealType] = useState<MealType | ''>('');
  const [mealTypeError, setMealTypeError] = useState<string | null>(null);
  const openMyProducts = () => {
    setView('my-products');
    setMealTypeError(null);
    onMyProducts?.();
  };
  const actions = buildAddProductModalActions({
    onClose,
    onFindProduct,
    onMyProducts: openMyProducts,
    onBrandInput,
    onCustomInput,
    onRecipeAnalyzer,
  });
  const handleSelectMyProduct = (food: Food) => {
    if (!myProductsMealType) {
      setMealTypeError('Выберите приём пищи');
      return;
    }

    onSelectMyProduct?.(food, myProductsMealType);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6 animate-modal-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-white rounded-2xl shadow-2xl transform transition-all duration-200 ease-out translate-y-0 opacity-100 animate-modal-slide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Добавить продукт
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {view === 'actions' ? (
          <div className="px-4 pb-5 space-y-3">
            {actions.map((action) => (
              <ModalButton key={action.label} label={action.label} onClick={action.onClick} />
            ))}
          </div>
        ) : (
          <MyProductsView
            foods={myProducts}
            status={myProductsStatus}
            error={myProductsError}
            mealType={myProductsMealType}
            mealTypeError={mealTypeError}
            onMealTypeChange={(mealType) => {
              setMyProductsMealType(mealType);
              setMealTypeError(null);
            }}
            onSelectFood={handleSelectMyProduct}
            onAddCustomFood={onCustomInput || onClose}
            onBack={() => setView('actions')}
            onRetry={onMyProducts}
          />
        )}
      </div>
    </div>
  );
};

export const MyProductsView = ({
  foods,
  status,
  error,
  mealType,
  mealTypeError,
  onMealTypeChange,
  onSelectFood,
  onAddCustomFood,
  onBack,
  onRetry,
}: {
  foods: Food[];
  status: MyProductsStatus;
  error?: string | null;
  mealType: MealType | '';
  mealTypeError: string | null;
  onMealTypeChange: (mealType: MealType) => void;
  onSelectFood: (food: Food) => void;
  onAddCustomFood: () => void;
  onBack: () => void;
  onRetry?: () => void;
}) => (
  <div className="px-4 pb-5 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-semibold text-gray-900">Мои продукты</h4>
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
      >
        Назад
      </button>
    </div>

    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-700">Приём пищи</span>
      <select
        value={mealType}
        onChange={(event) => onMealTypeChange(event.target.value as MealType)}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="">Выберите приём пищи</option>
        {mealOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {mealTypeError && <span className="mt-1 block text-xs text-red-600">{mealTypeError}</span>}
    </label>

    {status === 'loading' && (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center text-xs font-semibold text-gray-600">
        Загружаем продукты...
      </div>
    )}

    {status === 'error' && (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-xs text-red-700">
        <p>{error || 'Не удалось загрузить мои продукты'}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-xl border border-red-300 bg-white py-2.5 font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            Повторить
          </button>
        )}
      </div>
    )}

    {status !== 'loading' && status !== 'error' && foods.length === 0 && (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center">
        <div>
          <p className="text-sm font-semibold text-gray-900">Вы ещё не добавляли свои продукты</p>
          <p className="mt-2 text-xs leading-5 text-gray-600">
            Создайте продукт один раз — потом он будет здесь
          </p>
        </div>
        <ModalButton label="Добавить свой продукт" onClick={onAddCustomFood} />
      </div>
    )}

    {status !== 'loading' && status !== 'error' && foods.length > 0 && (
      <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            onClick={() => onSelectFood(food)}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900">{getFoodDisplayName(food)}</p>
              {food.brand && <p className="mt-1 truncate text-[11px] text-gray-500">{food.brand}</p>}
              <p className="mt-1 text-[11px] text-gray-600">
                {Math.round(food.calories)} ккал · Б {formatMacro(food.protein)} · Ж {formatMacro(food.fat)} · У {formatMacro(food.carbs)} / 100 г
              </p>
            </div>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-500 text-sm font-semibold text-gray-800">
              +
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

const formatMacro = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(1)).toString();
};

const ModalButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full py-[11px] rounded-xl border border-gray-500 text-center text-xs font-semibold text-gray-800 bg-white hover:bg-gray-50 transition-colors"
  >
    {label}
  </button>
);

export default AddProductModal;
