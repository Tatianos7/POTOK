import { useState } from 'react';
import { Food } from '../types';
import { foodService } from '../services/foodService';
import ProductCard from './ProductCard';
import { ScanLine, Loader2, X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onSelect: (food: Food) => void;
  userId?: string;
  onClose?: () => void;
  onOpenCamera?: () => void;
}

const BarcodeScanner = ({ onSelect, userId, onClose, onOpenCamera }: BarcodeScannerProps) => {
  const [barcode, setBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundFood, setFoundFood] = useState<Food | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!barcode.trim()) {
      setError('Введите штрих-код');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFoundFood(null);

    try {
      const food = await foodService.findByBarcode(barcode.trim(), userId);
      
      if (food) {
        setFoundFood(food);
      } else {
        setError('Продукт не найден');
      }
    } catch (err) {
      console.error('Error scanning barcode:', err);
      setError('Ошибка при поиске продукта');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = () => {
    if (foundFood) {
      onSelect(foundFood);
      setBarcode('');
      setFoundFood(null);
      setError(null);
    }
  };

  return (
    <div className="w-full">
      {onClose && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Сканирование штрих-кода
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Barcode Input */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <ScanLine className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setError(null);
                setFoundFood(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleScan();
                }
              }}
              placeholder="Введите штрих-код"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={isLoading || !barcode.trim()}
            className="px-4 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Поиск...</span>
              </>
            ) : (
              <>
                <ScanLine className="w-5 h-5" />
                <span>Найти</span>
              </>
            )}
          </button>
        </div>
        
        {/* Camera Button */}
        {onOpenCamera && (
          <div className="mt-3">
            <button
              onClick={onOpenCamera}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Camera className="w-5 h-5" />
              <span>Сканировать через камеру</span>
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Found Product */}
      {foundFood && (
        <div className="space-y-3">
          <ProductCard food={foundFood} onClick={handleSelect} />
          <button
            onClick={handleSelect}
            className="w-full py-3 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
          >
            Добавить продукт
          </button>
        </div>
      )}

      {/* Info */}
      {!foundFood && !error && !isLoading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <ScanLine className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm">Введите штрих-код продукта</p>
          <p className="text-xs mt-2">Продукт будет найден в базе или загружен из OpenFoodFacts</p>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;

