import { useAiAdvice } from '../hooks/useAiAdvice';
import { generateNutritionPDF, generateTrainingPDF } from '../utils/pdfGenerator';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';

const AiAdviceBlock = () => {
  const { 
    nutritionAdvice, 
    trainingAdvice, 
    loading, 
    error, 
    regenerate,
    userGoalData 
  } = useAiAdvice();

  // Показываем блок только если есть данные цели
  if (!userGoalData && !loading) {
    return null;
  }

  const handleDownloadNutritionPDF = () => {
    if (userGoalData && nutritionAdvice) {
      void generateNutritionPDF(nutritionAdvice, userGoalData);
    }
  };

  const handleDownloadTrainingPDF = () => {
    if (userGoalData && trainingAdvice) {
      void generateTrainingPDF(trainingAdvice, userGoalData);
    }
  };

  // Обрезаем текст для краткого описания (первые 150 символов)
  const getShortDescription = (text: string): string => {
    const lines = text.split('\n');
    const firstParagraph = lines.find(line => line.trim().length > 0) || '';
    return firstParagraph.length > 150 
      ? firstParagraph.substring(0, 150) + '...' 
      : firstParagraph;
  };

  return (
    <div className="mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center justify-between gap-2 mb-3 min-[376px]:mb-4 w-full max-w-full">
        <h2 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white break-words overflow-wrap-anywhere flex-1">
          👉 Персональные рекомендации для достижения вашей цели
        </h2>
        {!loading && (nutritionAdvice || trainingAdvice) && (
          <button
            onClick={regenerate}
            className="flex items-center justify-center gap-1.5 px-2 min-[376px]:px-3 py-1.5 min-[376px]:py-2 rounded-lg text-xs min-[376px]:text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title="Обновить советы"
          >
            <RefreshCw className="w-3.5 h-3.5 min-[376px]:w-4 min-[376px]:h-4" />
            <span className="hidden min-[376px]:inline">Обновить</span>
          </button>
        )}
      </div>

      {/* Состояние загрузки */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-[376px]:p-6 w-full max-w-full">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Генерация персональных рекомендаций...
            </p>
          </div>
        </div>
      )}

      {/* Состояние ошибки */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 min-[376px]:p-6 w-full max-w-full mb-3 min-[376px]:mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                Ошибка генерации рекомендаций
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 break-words overflow-wrap-anywhere">
                {error}
              </p>
              <button
                onClick={regenerate}
                className="mt-3 text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Карточки с советами */}
      {!loading && !error && (nutritionAdvice || trainingAdvice) && (
        <div className="space-y-3 min-[376px]:space-y-4 w-full max-w-full">
          {/* Карточка 1: Питание */}
          {nutritionAdvice && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 min-[376px]:p-4 w-full max-w-full overflow-hidden">
              <div className="flex items-start gap-2 min-[376px]:gap-3 mb-3 min-[376px]:mb-4">
                <span className="text-2xl min-[376px]:text-3xl flex-shrink-0">🥗</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white mb-2 break-words overflow-wrap-anywhere">
                    Питание
                  </h3>
                  <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 break-words overflow-wrap-anywhere">
                    {getShortDescription(nutritionAdvice)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadNutritionPDF}
                disabled={!nutritionAdvice}
                className="w-full max-w-full min-[768px]:max-w-[360px] min-[768px]:mx-auto flex items-center justify-center gap-2 px-3 min-[376px]:px-4 py-2 min-[376px]:py-2.5 rounded-lg font-medium text-xs min-[376px]:text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxSizing: 'border-box' }}
              >
                <Download className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 flex-shrink-0" />
                <span>Скачать PDF (питание)</span>
              </button>
            </div>
          )}

          {/* Карточка 2: Тренировки */}
          {trainingAdvice && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 min-[376px]:p-4 w-full max-w-full overflow-hidden">
              <div className="flex items-start gap-2 min-[376px]:gap-3 mb-3 min-[376px]:mb-4">
                <span className="text-2xl min-[376px]:text-3xl flex-shrink-0">🏋️</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white mb-2 break-words overflow-wrap-anywhere">
                    Тренировки
                  </h3>
                  <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 break-words overflow-wrap-anywhere">
                    {getShortDescription(trainingAdvice)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadTrainingPDF}
                disabled={!trainingAdvice}
                className="w-full max-w-full min-[768px]:max-w-[360px] min-[768px]:mx-auto flex items-center justify-center gap-2 px-3 min-[376px]:px-4 py-2 min-[376px]:py-2.5 rounded-lg font-medium text-xs min-[376px]:text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxSizing: 'border-box' }}
              >
                <Download className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 flex-shrink-0" />
                <span>Скачать PDF (тренировки)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Юридическое предупреждение */}
      {!loading && (nutritionAdvice || trainingAdvice) && (
        <div className="mt-3 min-[376px]:mt-4 pt-3 min-[376px]:pt-4 border-t border-gray-200 dark:border-gray-700 w-full max-w-full">
          <p className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 italic text-center break-words overflow-wrap-anywhere">
            ⚠️ Рекомендации носят информационный характер и не заменяют консультацию врача или специалиста.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiAdviceBlock;
