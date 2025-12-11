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

        <div className="px-4 pb-5 space-y-3">
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
    className="w-full py-[11px] rounded-full border border-gray-500 text-center text-xs font-semibold text-gray-800 bg-white hover:bg-gray-50 transition-colors"
  >
    {label}
  </button>
);

export default AddProductModal;

