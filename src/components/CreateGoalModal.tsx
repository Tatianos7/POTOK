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
    const weightValue = Number(formData.weight);
    if (!Number.isFinite(weightValue) || weightValue <= 0) return;
    if (formData.goal !== 'gain') return;

    const max = Math.min(weightValue + 30, 150);
    const min = Math.min(weightValue + 1, max);
    const currentTarget = Number(formData.targetWeight);
    if (!Number.isFinite(currentTarget) || currentTarget < min || currentTarget > max) {
      const fallback = Math.min(weightValue + 5, max);
      setFormData((prev) => ({
        ...prev,
        targetWeight: String(fallback),
      }));
    }
  }, [formData.goal, formData.weight, formData.targetWeight]);

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
  const weightValue = Number(formData.weight);
  const gainMax = Number.isFinite(weightValue) && weightValue > 0 ? Math.min(weightValue + 30, 150) : 150;
  const gainMin = Number.isFinite(weightValue) && weightValue > 0 ? Math.min(weightValue + 1, gainMax) : 40;
  const rawGainTarget = Number(formData.targetWeight);
  const gainTarget =
    Number.isFinite(rawGainTarget) && rawGainTarget >= gainMin && rawGainTarget <= gainMax
      ? rawGainTarget
      : Math.min((Number.isFinite(weightValue) ? weightValue + 5 : 55), gainMax);
  const gainRange = gainMax - gainMin;
  const gainProgress = gainRange > 0 ? (gainTarget - gainMin) / gainRange : 1;
  const gainProgressClamped = Math.min(0.98, Math.max(0.02, gainProgress));
  const lossTarget = Number(formData.targetWeight) || 55;
  const lossProgress = (lossTarget - 40) / (150 - 40);
  const lossProgressClamped = Math.min(0.98, Math.max(0.02, lossProgress));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 min-[376px]:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <header className="px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10 w-full max-w-full overflow-hidden">
          <div className="flex-1"></div>
          <h1 className="text-base min-[376px]:text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            ЗАДАЙ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-2 min-[376px]:px-4 py-4 min-[376px]:py-6 space-y-4 min-[376px]:space-y-6 w-full max-w-full overflow-hidden">
          {/* Gender Selection */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
              Пол:
            </label>
            <div className="flex gap-3 min-[376px]:gap-4">
              <label className="flex items-center gap-1.5 min-[376px]:gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={handleChange('gender')}
                  className="sr-only"
                />
                <div className={`w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  formData.gender === 'male'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {formData.gender === 'male' && (
                    <Check className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className="text-xs min-[376px]:text-sm text-gray-900 dark:text-white whitespace-nowrap">Мужчина</span>
              </label>
              <label className="flex items-center gap-1.5 min-[376px]:gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={handleChange('gender')}
                  className="sr-only"
                />
                <div className={`w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  formData.gender === 'female'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {formData.gender === 'female' && (
                    <Check className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className="text-xs min-[376px]:text-sm text-gray-900 dark:text-white whitespace-nowrap">Женщина</span>
              </label>
            </div>
          </div>

          {/* Personal Data */}
          <div className="flex flex-row gap-2 min-[376px]:gap-4 w-full max-w-full overflow-hidden">
            <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Возраст
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={handleChange('age')}
                className={`w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 rounded-lg border text-xs min-[376px]:text-sm ${
                  isFieldValid(formData.age)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                style={{ boxSizing: 'border-box' }}
                placeholder="0"
              />
            </div>
            <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Вес, кг
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={handleChange('weight')}
                className={`w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 rounded-lg border text-xs min-[376px]:text-sm ${
                  isFieldValid(formData.weight)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                style={{ boxSizing: 'border-box' }}
                placeholder="0"
              />
            </div>
            <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Рост, см
              </label>
              <input
                type="number"
                value={formData.height}
                onChange={handleChange('height')}
                className={`w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 rounded-lg border text-xs min-[376px]:text-sm ${
                  isFieldValid(formData.height)
                    ? 'border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                style={{ boxSizing: 'border-box' }}
                placeholder="0"
              />
            </div>
          </div>

          {/* Lifestyle */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
              Образ жизни:
            </label>
            <div className="space-y-2 min-[376px]:space-y-2">
              {[
                { value: 'sedentary', label: 'Сидячий и малоподвижный' },
                { value: 'light', label: 'Легкая активность', desc: '1-3 раза в неделю физическая нагрузка' },
                { value: 'moderate', label: 'Средняя активность', desc: '3-5 раз в неделю физическая нагрузка' },
                { value: 'high', label: 'Высокая активность', desc: '6-7 раз в неделю физическая нагрузка' },
                { value: 'very-high', label: 'Очень высокая активность', desc: 'постоянная физическая нагрузка' },
              ].map((option) => {
                const isChecked = formData.lifestyle === option.value;
                return (
                  <label key={option.value} className="flex items-start gap-2 cursor-pointer w-full max-w-full overflow-hidden">
                    <input
                      type="radio"
                      name="lifestyle"
                      value={option.value}
                      checked={isChecked}
                      onChange={handleChange('lifestyle')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                      isChecked
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isChecked && (
                        <Check className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-xs min-[376px]:text-sm font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
                        {option.label}
                      </div>
                      {option.desc && (
                        <div className="text-[10px] min-[376px]:text-xs text-gray-600 dark:text-gray-400 mt-0.5 min-[376px]:mt-1 break-words overflow-wrap-anywhere">
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
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
              Цель:
            </label>
            <div className="flex flex-wrap gap-3 min-[376px]:gap-4">
              {[
                { value: 'weight-loss', label: 'Похудение' },
                { value: 'maintain', label: 'Поддержка формы' },
                { value: 'gain', label: 'Набор' },
              ].map((option) => {
                const isChecked = formData.goal === option.value;
                return (
                  <label key={option.value} className="flex items-center gap-1.5 min-[376px]:gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="radio"
                      name="goal"
                      value={option.value}
                      checked={isChecked}
                      onChange={handleChange('goal')}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      isChecked
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isChecked && (
                        <Check className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <span className="text-xs min-[376px]:text-sm font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
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
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Похудеть до, кг
              </label>
              <div className="relative h-5 mb-1">
                <div
                  className="absolute text-sm font-medium text-gray-900 dark:text-white"
                  style={{
                    left: `calc(${lossProgressClamped * 100}%)`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {lossTarget}
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="40"
                  max="150"
                  value={lossTarget}
                  onChange={handleSliderChange}
                  className="weight-slider w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${lossProgress * 100}%, #e5e7eb ${lossProgress * 100}%, #e5e7eb 100%)`
                  }}
                />
                <style>{`
                  .weight-slider::-webkit-slider-thumb {
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3) !important;
                  }
                  .weight-slider::-webkit-slider-thumb:hover {
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
                  }
                  .weight-slider::-moz-range-thumb {
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3) !important;
                    -moz-appearance: none !important;
                  }
                  .weight-slider::-moz-range-thumb:hover {
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
                  }
                  .weight-slider::-ms-thumb {
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                  }
                  .weight-slider::-ms-track {
                    background: transparent;
                    border-color: transparent;
                    color: transparent;
                  }
                `}</style>
              </div>
            </div>
          )}
          {formData.goal === 'gain' && (
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Набрать до, кг
              </label>
              <div className="relative h-5 mb-1">
                <div
                  className="absolute text-sm font-medium text-gray-900 dark:text-white"
                  style={{
                    left: `calc(${gainProgressClamped * 100}%)`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {gainTarget}
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={gainMin}
                  max={gainMax}
                  value={gainTarget}
                  onChange={handleSliderChange}
                  className="weight-slider w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${gainProgress * 100}%, #e5e7eb ${gainProgress * 100}%, #e5e7eb 100%)`
                  }}
                />
                <style>{`
                  .weight-slider::-webkit-slider-thumb {
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3) !important;
                  }
                  .weight-slider::-webkit-slider-thumb:hover {
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
                  }
                  .weight-slider::-moz-range-thumb {
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3) !important;
                    -moz-appearance: none !important;
                  }
                  .weight-slider::-moz-range-thumb:hover {
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
                  }
                  .weight-slider::-ms-thumb {
                    width: 20px !important;
                    height: 20px !important;
                    border-radius: 50% !important;
                    background: #10b981 !important;
                    cursor: pointer !important;
                    border: 2px solid #10b981 !important;
                  }
                  .weight-slider::-ms-track {
                    background: transparent;
                    border-color: transparent;
                    color: transparent;
                  }
                `}</style>
              </div>
            </div>
          )}

          {/* Intensity (only if weight loss is selected) */}
          {formData.goal === 'weight-loss' && (
            <div className="w-full max-w-full overflow-hidden" style={{ marginTop: '20px' }}>
              <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
                Интенсивность похудения:
              </label>
              <div className="flex gap-3 min-[376px]:gap-4">
                {['10', '15', '20'].map((value) => {
                  const isChecked = formData.intensity === value;
                  return (
                    <label key={value} className="flex items-center gap-1.5 min-[376px]:gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="radio"
                        name="intensity"
                        value={value}
                        checked={isChecked}
                        onChange={handleChange('intensity')}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                        isChecked
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isChecked && (
                          <Check className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span className="text-xs min-[376px]:text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{value}%</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calculate Button */}
          <button
            type="submit"
            className="w-full max-w-full py-3 min-[376px]:py-4 rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            style={{ boxSizing: 'border-box' }}
          >
            РАСЧИТАТЬ
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGoalModal;
