import { X } from 'lucide-react';

interface AddProductModalProps {
  onClose: () => void;
  onBrandInput?: () => void;
  onCustomInput?: () => void;
  onRecipeAnalyzer?: () => void;
}

const AddProductModal = ({
  onClose,
  onBrandInput,
  onCustomInput,
  onRecipeAnalyzer,
}: AddProductModalProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all duration-200 ease-out translate-y-0 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
            Добавить продукт
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <ModalButton label="Ввод марки продукта" onClick={onBrandInput || onClose} />
          <ModalButton label="Ввод своего продукта" onClick={onCustomInput || onClose} />
          <ModalButton label="Анализатор рецепта" onClick={onRecipeAnalyzer || onClose} />
        </div>
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
    className="w-full py-3 rounded-2xl border border-gray-400 text-center text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
  >
    {label}
  </button>
);

export default AddProductModal;

