import { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { photoFoodAnalyzer } from '../services/photoFoodAnalyzer';
import { PhotoAnalysisResult } from '../services/photoFoodAnalyzer';
import { Food } from '../types';
import { foodService } from '../services/foodService';

interface PhotoFoodAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (food: Food, weight: number, mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void; // Сохранение в прием пищи
  onSaveToRecipes?: (result: PhotoAnalysisResult) => void; // Сохранение в рецепты (опционально)
  userId?: string;
  defaultMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // Тип приема пищи по умолчанию
}

const PhotoFoodAnalyzerModal = ({
  isOpen,
  onClose,
  onSave,
  onSaveToRecipes,
  userId,
  defaultMealType,
}: PhotoFoodAnalyzerModalProps) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editableWeight, setEditableWeight] = useState<number>(0);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(defaultMealType || 'lunch');

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await photoFoodAnalyzer.analyzePhoto(file, userId);
      setAnalysisResult(result);
      setEditableWeight(result.estimatedWeight);
      setSelectedFood(result.food);
    } catch (err) {
      console.error('[PhotoFoodAnalyzerModal] Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Не удалось проанализировать фото');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleWeightChange = (newWeight: number) => {
    if (newWeight < 0) return;
    setEditableWeight(newWeight);
    
    // Пересчитываем КБЖУ при изменении веса
    if (selectedFood) {
      const macros = photoFoodAnalyzer.recalculateMacros(selectedFood, newWeight);
      setAnalysisResult((prev) => 
        prev ? { ...prev, estimatedWeight: newWeight, ...macros } : null
      );
    }
  };

  const handleSave = () => {
    if (!selectedFood || editableWeight <= 0) {
      setError('Выберите продукт и укажите вес');
      return;
    }

    onSave(selectedFood, editableWeight, selectedMealType);
    handleClose();
  };

  const handleSaveToRecipes = () => {
    if (!analysisResult || !onSaveToRecipes) return;
    onSaveToRecipes(analysisResult);
    handleClose();
  };

  const handleClose = () => {
    setAnalysisResult(null);
    setError(null);
    setEditableWeight(0);
    setSelectedFood(null);
    setIsAnalyzing(false);
    onClose();
  };

  const handleSearchFood = async (query: string) => {
    if (!query.trim()) return;
    
    const results = await foodService.search(query, { limit: 5, userId });
    if (results.length > 0) {
      const food = results[0];
      setSelectedFood(food);
      const macros = photoFoodAnalyzer.recalculateMacros(food, editableWeight);
      setAnalysisResult((prev) => 
        prev ? { ...prev, food, ...macros } : null
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Анализ фото продукта
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!analysisResult && !isAnalyzing && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Сфотографируйте продукт или выберите фото из галереи. Анализ происходит локально на вашем устройстве.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  Сделать фото
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                  Выбрать из галереи
                </button>
              </div>
            </>
          )}

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Анализируем фото...
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4">
              {/* Preview фото */}
              {analysisResult.photoDataUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={analysisResult.photoDataUrl}
                    alt="Анализируемое фото"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Предупреждение */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  Пищевая ценность указана ориентировочно. Проверьте и при необходимости отредактируйте данные.
                </p>
              </div>

              {/* Распознанный продукт */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Распознанный продукт
                </label>
                {selectedFood ? (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedFood.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Уверенность: {Math.round(analysisResult.confidence * 100)}%
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Продукт не найден в базе. Распознано: "{analysisResult.detectedLabel}"
                    </p>
                    <input
                      type="text"
                      placeholder="Найдите продукт вручную..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchFood(e.currentTarget.value);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Тип приема пищи */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Прием пищи
                </label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="breakfast">Завтрак</option>
                  <option value="lunch">Обед</option>
                  <option value="dinner">Ужин</option>
                  <option value="snack">Перекус</option>
                </select>
              </div>

              {/* Вес */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Вес (г)
                </label>
                <input
                  type="number"
                  value={editableWeight}
                  onChange={(e) => handleWeightChange(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* КБЖУ */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Калории</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {analysisResult.calories}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Белки</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {analysisResult.protein.toFixed(1)} г
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Жиры</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {analysisResult.fat.toFixed(1)} г
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Углеводы</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {analysisResult.carbs.toFixed(1)} г
                  </p>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!selectedFood || editableWeight <= 0}
                  className="flex-1 py-3 px-4 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Сохранить в приём пищи
                </button>
                {onSaveToRecipes && (
                  <button
                    onClick={handleSaveToRecipes}
                    className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    В рецепты
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default PhotoFoodAnalyzerModal;

