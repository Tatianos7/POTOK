import React from 'react';
import { CalculatedIngredient } from '../utils/nutritionCalculator';

interface Props {
  items: CalculatedIngredient[];
}

const RecipeIngredientsTable: React.FC<Props> = ({ items }) => {
  if (!items.length) return null;

  // Функция для очистки названия продукта от единиц измерения и чисел
  const cleanProductName = (name: string): string => {
    let cleaned = name;
    // Удаляем все единицы измерения
    cleaned = cleaned.replace(/\b(г|гр|кг|л|мл|шт|грамм|литр|миллилитр|штук|дольк|зубчик|ч\.?л|ст\.?л|чайная\s+ложка|столовая\s+ложка)\b/gi, '');
    // Удаляем все числа (включая диапазоны и десятичные)
    cleaned = cleaned.replace(/\d+[.,]?\d*\s*[–-]\s*\d+[.,]?\d*/g, ''); // диапазоны
    cleaned = cleaned.replace(/\d+[.,]?\d*/g, ''); // обычные числа
    cleaned = cleaned.replace(/\d+/g, ''); // любые оставшиеся числа
    // Удаляем лишние пробелы
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
            <div className="col-span-2 text-gray-900">{cleanProductName(i.name)}</div>
            <div className="text-right text-green-600 text-xs">
              {i.amountText}
            </div>
            <div className="text-right text-gray-800 text-xs">{(Math.round(i.proteins * 100) / 100).toFixed(2)}</div>
            <div className="text-right text-gray-800 text-xs">{(Math.round(i.fats * 100) / 100).toFixed(2)}</div>
            <div className="text-right text-gray-800 text-xs">{(Math.round(i.carbs * 100) / 100).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeIngredientsTable;

