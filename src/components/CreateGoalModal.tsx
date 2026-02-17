import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { ACTIVITY_HINTS } from '../constants/activityHints';
import BaseInput from './ui/BaseInput';

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
  trainingPlace: 'home' | 'gym';
  goal: string;
  targetWeight: string;
  intensity: string;
}

const CreateGoalModal = ({ isOpen, onClose, onCalculate }: CreateGoalModalProps) => {
  const [openLifestyleHint, setOpenLifestyleHint] = useState<string | null>(null);
  const [hintPosition, setHintPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const lifestyleHintRef = useRef<HTMLDivElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState<GoalFormData>({
    gender: 'female',
    age: '',
    weight: '',
    height: '',
    lifestyle: '',
    trainingPlace: 'home',
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
      setOpenLifestyleHint(null);
      setHintPosition(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!openLifestyleHint) return;
    const modalBodyNode = modalBodyRef.current;

    const updateHintPosition = () => {
      const trigger = document.querySelector<HTMLElement>(`[data-lifestyle-hint-trigger="${openLifestyleHint}"]`);
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(320, Math.max(240, viewportWidth - 24));
      const approxHeight = 170;
      const left = Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12));
      const shouldPlaceAbove = rect.bottom + 8 + approxHeight > viewportHeight - 12;
      const top = shouldPlaceAbove
        ? Math.max(12, rect.top - approxHeight - 8)
        : Math.min(rect.bottom + 8, viewportHeight - 12);
      setHintPosition({ top, left, width });
    };

    updateHintPosition();

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const isTrigger = target instanceof HTMLElement && Boolean(target.closest('[data-lifestyle-hint-trigger]'));
      if (isTrigger) return;
      if (lifestyleHintRef.current && target && !lifestyleHintRef.current.contains(target)) {
        setOpenLifestyleHint(null);
        setHintPosition(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenLifestyleHint(null);
        setHintPosition(null);
      }
    };

    const onScrollOrResize = () => {
      updateHintPosition();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    modalBodyNode?.addEventListener('scroll', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      modalBodyNode?.removeEventListener('scroll', onScrollOrResize);
    };
  }, [openLifestyleHint]);

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
      <div ref={modalBodyRef} className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
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
              <BaseInput
                type="number"
                value={formData.age}
                onChange={handleChange('age')}
                className="w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 text-xs min-[376px]:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Вес, кг
              </label>
              <BaseInput
                type="number"
                value={formData.weight}
                onChange={handleChange('weight')}
                className="w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 text-xs min-[376px]:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Рост, см
              </label>
              <BaseInput
                type="number"
                value={formData.height}
                onChange={handleChange('height')}
                className="w-full max-w-full px-1.5 min-[376px]:px-3 py-1.5 min-[376px]:py-2 text-xs min-[376px]:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
              {ACTIVITY_HINTS.map((option) => {
                const isChecked = formData.lifestyle === option.value;
                return (
                  <label key={option.value} className="flex items-start gap-2 cursor-pointer w-full max-w-full overflow-visible">
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
                    <div className="flex-1 min-w-0 overflow-visible relative">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs min-[376px]:text-sm font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
                          {option.label}
                        </div>
                        <button
                          type="button"
                          aria-label={`Что значит: ${option.label}`}
                          data-lifestyle-hint-trigger={option.value}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const trigger = e.currentTarget;
                            setOpenLifestyleHint((prev) => {
                              if (prev === option.value) {
                                setHintPosition(null);
                                return null;
                              }
                              const rect = trigger.getBoundingClientRect();
                              const viewportWidth = window.innerWidth;
                              const viewportHeight = window.innerHeight;
                              const width = Math.min(320, Math.max(240, viewportWidth - 24));
                              const approxHeight = 170;
                              const left = Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12));
                              const shouldPlaceAbove = rect.bottom + 8 + approxHeight > viewportHeight - 12;
                              const top = shouldPlaceAbove
                                ? Math.max(12, rect.top - approxHeight - 8)
                                : Math.min(rect.bottom + 8, viewportHeight - 12);
                              setHintPosition({ top, left, width });
                              return option.value;
                            });
                          }}
                          className="flex-shrink-0 mt-0.5 inline-flex h-4 w-4 min-[376px]:h-5 min-[376px]:w-5 items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 text-[10px] min-[376px]:text-xs font-semibold text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          !
                        </button>
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
          {openLifestyleHint && hintPosition && (
            <div
              ref={lifestyleHintRef}
              role="dialog"
              aria-live="polite"
              className="fixed z-[70] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg text-[11px] min-[376px]:text-xs leading-5 text-gray-700 dark:text-gray-200"
              style={{ top: hintPosition.top, left: hintPosition.left, width: hintPosition.width }}
            >
              {ACTIVITY_HINTS.find((item) => item.value === openLifestyleHint)?.hint}
            </div>
          )}

          {/* Goal */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
              Тренировки:
            </label>
            <div className="flex flex-wrap gap-3 min-[376px]:gap-4">
              {[
                { value: 'home', label: 'Дома / на улице' },
                { value: 'gym', label: 'В зале' },
              ].map((option) => {
                const isChecked = formData.trainingPlace === option.value;
                return (
                  <label key={option.value} className="flex items-center gap-1.5 min-[376px]:gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="radio"
                      name="trainingPlace"
                      value={option.value}
                      checked={isChecked}
                      onChange={handleChange('trainingPlace')}
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
                      {option.label}
                    </span>
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
