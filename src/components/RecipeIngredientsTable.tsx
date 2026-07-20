import React from 'react';
import { CalculatedIngredient } from '../utils/nutritionCalculator';

interface Props {
  items: CalculatedIngredient[];
}

const RecipeIngredientsTable: React.FC<Props> = ({ items }) => {
  if (!items.length) return null;

  const formatIngredientQuantity = (item: CalculatedIngredient): string => {
    const amount = item.originalAmount ?? item.displayAmount;
    const unit = item.originalUnit ?? item.displayUnit;

    if (amount !== null && amount !== undefined && unit) {
      return `${amount} ${unit}`;
    }

    if (item.amountText) {
      return item.amountText;
    }

    return `${item.quantity_g ?? item.gramsEquivalent ?? item.amountGrams} г`;
  };

  // Функция для очистки названия продукта от единиц измерения и чисел
  const cleanProductName = (name: string): string => {
    let cleaned = name;
    
    // Удаляем все числа сначала
    cleaned = cleaned.replace(/\d+[.,]?\d*\s*[–-]\s*\d+[.,]?\d*/g, ''); // диапазоны
    cleaned = cleaned.replace(/\d+[.,]?\d*/g, ''); // обычные числа
    cleaned = cleaned.replace(/\d+/g, ''); // любые оставшиеся числа
    
    // Агрессивное удаление единиц измерения (включая с точками и запятыми)
    const unitPatterns = [
      /\bгр?\.?\b/gi,  // г, гр, гр.
      /\bкг\.?\b/gi,   // кг, кг.
      /\bл\.?\b(?!\w)/gi,  // л, л. (но не часть слова)
      /\bмл\.?\b/gi,   // мл, мл.
      /\bшт\.?\b/gi,   // шт, шт.
      /\bграмм\w*\.?\b/gi,
      /\bлитр\w*\.?\b/gi,
      /\bмиллилитр\w*\.?\b/gi,
      /\bштук\w*\.?\b/gi,
      /\bдольк\w*\.?\b/gi,
      /\bзубчик\w*\.?\b/gi,
      /\bч\.?\s*л\.?\b/gi,
      /\bст\.?\s*л\.?\b/gi,
      /чайная\s+ложка/gi,
      /столовая\s+ложка/gi,
    ];
    
    // Применяем несколько раз для гарантии
    for (let i = 0; i < 3; i++) {
      for (const pattern of unitPatterns) {
        cleaned = cleaned.replace(pattern, ' ');
      }
    }
    
    // Удаляем точки, запятые и лишние пробелы
    cleaned = cleaned.replace(/[.,;]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  };

  return (
    <div className="w-full">
          <div className="grid grid-cols-6 text-[11px] text-gray-500 px-2">
        <div className="col-span-2">Продукт</div>
        <div className="text-right">Кол-во</div>
        <div className="text-right">Белки</div>
        <div className="text-right">Жиры</div>
        <div className="text-right">Углеводы</div>
      </div>
      <div className="divide-y divide-gray-200">
        {items.map((i, idx) => (
          <div key={idx} className="grid grid-cols-6 px-2 py-2 text-sm">
            <div className="col-span-2 text-gray-900">
              <div>{cleanProductName(i.name)}</div>
              {i.resolution_status !== 'resolved' && (
                <div className="mt-0.5 text-[10px] leading-snug text-amber-700">
                  {i.warning || 'Не найдено точное совпадение в каталоге.'}
                  {i.candidate_food_names && i.candidate_food_names.length > 0
                    ? ` Возможные варианты: ${i.candidate_food_names.join(', ')}.`
                    : ''}
                </div>
              )}
              {i.resolution_status === 'resolved' && i.resolved_food_name && i.resolved_food_name !== i.name && (
                <div className="mt-0.5 text-[10px] leading-snug text-gray-500">
                  {i.resolved_food_name}
                </div>
              )}
            </div>
            <div
              className="text-right text-green-600 text-xs"
              data-testid={`recipe-ingredient-quantity-${idx}`}
              data-original-amount={i.originalAmount ?? i.displayAmount ?? ''}
              data-original-unit={i.originalUnit ?? i.displayUnit ?? ''}
              data-grams-equivalent={i.quantity_g ?? i.gramsEquivalent ?? i.amountGrams}
            >
              {formatIngredientQuantity(i)}
            </div>
            <div className="text-right text-gray-800 text-xs">
              {i.resolution_status === 'resolved' ? (Math.round(i.proteins * 100) / 100).toFixed(2) : '—'}
            </div>
            <div className="text-right text-gray-800 text-xs">
              {i.resolution_status === 'resolved' ? (Math.round(i.fats * 100) / 100).toFixed(2) : '—'}
            </div>
            <div className="text-right text-gray-800 text-xs">
              {i.resolution_status === 'resolved' ? (Math.round(i.carbs * 100) / 100).toFixed(2) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeIngredientsTable;
