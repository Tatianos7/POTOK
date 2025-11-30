import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCalculate: (data: GoalFormData) => void;
}

export interface GoalFormData {
  gender: 'male' | 'female';
  age: string;
  weight: string;
  height: string;
  lifestyle: string;
  goal: string;
  targetWeight: string;
  intensity: string;
}

const CreateGoalModal = ({ isOpen, onClose, onCalculate }: CreateGoalModalProps) => {
  const [formData, setFormData] = useState<GoalFormData>({
    gender: 'female',
    age: '',
    weight: '',
    height: '',
    lifestyle: '',
    goal: '',
    targetWeight: '55',
    intensity: '10',
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof GoalFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      targetWeight: e.target.value,
    }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(formData);
  };

  const isFieldValid = (value: string) => value.trim() !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ minWidth: '360px' }}>
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            ЗАДАЙ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {/* Gender Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Пол:
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={handleChange('gender')}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  formData.gender === 'male'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {formData.gender === 'male' && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className="text-gray-900 dark:text-white">Мужчина</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={handleChange('gender')}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  formData.gender === 'female'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {formData.gender === 'female' && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className="text-gray-900 dark:text-white">Женщина</span>
              </label>
            </div>
          </div>

          {/* Personal Data */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Возраст
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={handleChange('age')}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isFieldValid(formData.age)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Вес, кг
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={handleChange('weight')}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isFieldValid(formData.weight)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Рост, см
              </label>
              <input
                type="number"
                value={formData.height}
                onChange={handleChange('height')}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isFieldValid(formData.height)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                placeholder="0"
              />
            </div>
          </div>

          {/* Lifestyle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Образ жизни:
            </label>
            <div className="space-y-2">
              {[
                { value: 'sedentary', label: 'Сидячий и малоподвижный' },
                { value: 'light', label: 'Легкая активность', desc: '1-3 раза в неделю физическая нагрузка' },
                { value: 'moderate', label: 'Средняя активность', desc: '3-5 раз в неделю физическая нагрузка' },
                { value: 'high', label: 'Высокая активность', desc: '6-7 раз в неделю физическая нагрузка' },
                { value: 'very-high', label: 'Очень высокая активность', desc: 'постоянная физическая нагрузка' },
              ].map((option) => {
                const isChecked = formData.lifestyle === option.value;
                return (
                  <label key={option.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lifestyle"
                      value={option.value}
                      checked={isChecked}
                      onChange={handleChange('lifestyle')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                      isChecked
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isChecked && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </div>
                      {option.desc && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {option.desc}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Цель:
            </label>
            <div className="flex gap-4 flex-wrap">
              {[
                { value: 'weight-loss', label: 'Похудение' },
                { value: 'maintain', label: 'Поддержка формы' },
                { value: 'gain', label: 'Набор' },
              ].map((option) => {
                const isChecked = formData.goal === option.value;
                return (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="goal"
                      value={option.value}
                      checked={isChecked}
                      onChange={handleChange('goal')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      isChecked
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isChecked && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.value === 'maintain' ? (
                        <>
                          Поддержка<br />формы
                        </>
                      ) : (
                        option.label
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Target Weight Slider (only if weight loss is selected) */}
          {formData.goal === 'weight-loss' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Похудеть до, кг: {formData.targetWeight}
              </label>
              <input
                type="range"
                min="40"
                max="150"
                value={formData.targetWeight}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${(parseInt(formData.targetWeight) - 40) / (150 - 40) * 100}%, #e5e7eb ${(parseInt(formData.targetWeight) - 40) / (150 - 40) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>
          )}

          {/* Intensity (only if weight loss is selected) */}
          {formData.goal === 'weight-loss' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Интенсивность похудения:
              </label>
              <div className="flex gap-4">
                {['10', '15', '20'].map((value) => (
                  <label key={value} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="intensity"
                      value={value}
                      checked={formData.intensity === value}
                      onChange={handleChange('intensity')}
                      className="sr-only"
                    />
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                      formData.intensity === value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {formData.intensity === value && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                      <span className="text-gray-900 dark:text-white">{value}%</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Calculate Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            РАСЧИТАТЬ
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGoalModal;

