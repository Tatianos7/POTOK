import { useState } from 'react';
import { X } from 'lucide-react';

interface AddProductModalProps {
  onClose: () => void;
  onFindProduct?: () => void;
  onMyProducts?: () => void;
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
  onBrandInput,
  onCustomInput,
  onRecipeAnalyzer,
}: AddProductModalProps) => {
  const [view, setView] = useState<'actions' | 'my-products'>('actions');
  const openMyProducts = onMyProducts || (() => setView('my-products'));
  const actions = buildAddProductModalActions({
    onClose,
    onFindProduct,
    onMyProducts: openMyProducts,
    onBrandInput,
    onCustomInput,
    onRecipeAnalyzer,
  });

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
          <div className="px-4 pb-5 space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center">
              <h4 className="text-sm font-semibold text-gray-900">Мои продукты</h4>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Здесь будут продукты, которые вы добавили сами
              </p>
            </div>
            <ModalButton label="Добавить свой продукт" onClick={onCustomInput || onClose} />
            <ModalButton label="Назад" onClick={() => setView('actions')} />
          </div>
        )}
      </div>
    </div>
  );
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
