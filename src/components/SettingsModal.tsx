import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Settings {
  waterReminders: boolean;
  mealReminders: boolean;
  workoutReminders: boolean;
  goalNotifications: boolean;
}

type ToggleSettingKey = keyof Settings;

const DEFAULT_SETTINGS: Settings = {
  waterReminders: false,
  mealReminders: false,
  workoutReminders: false,
  goalNotifications: false,
};

const notificationSettings: Array<{ key: ToggleSettingKey; label: string }> = [
  { key: 'waterReminders', label: 'Напоминание о воде' },
  { key: 'mealReminders', label: 'Напоминание о питании' },
  { key: 'workoutReminders', label: 'Напоминание о тренировках' },
  { key: 'goalNotifications', label: 'Уведомления о достижении целей' },
];

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [themeNotice, setThemeNotice] = useState(false);

  // Загружаем настройки из localStorage при открытии
  useEffect(() => {
    if (isOpen && user?.id) {
      const savedSettings = localStorage.getItem(`settings_${user.id}`);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings({
            waterReminders: Boolean(parsed.waterReminders),
            mealReminders: Boolean(parsed.mealReminders),
            workoutReminders: Boolean(parsed.workoutReminders),
            goalNotifications: Boolean(parsed.goalNotifications),
          });
        } catch (error) {
          console.error('Ошибка загрузки настроек:', error);
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, [isOpen, user?.id]);

  const handleToggle = (key: ToggleSettingKey) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleConfirm = () => {
    if (user?.id) {
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Общие настройки
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Уведомления
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              {notificationSettings.map((setting, index) => {
                const value = settings[setting.key];
                return (
                  <div
                    key={setting.key}
                    className={`flex min-h-[56px] items-center justify-between gap-4 px-4 py-3 ${
                      index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {setting.label}
                    </span>
                    <button
                      onClick={() => handleToggle(setting.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:focus:ring-gray-600 dark:focus:ring-offset-gray-800 ${
                        value ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      role="switch"
                      aria-checked={value}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform dark:bg-gray-900 ${
                          value ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Внешний вид
            </h3>
            <button
              type="button"
              onClick={() => setThemeNotice(true)}
              className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left dark:border-gray-700 dark:bg-gray-800/70"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Тёмная тема
              </span>
              <span className="rounded-full bg-gray-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Скоро
              </span>
            </button>
            {themeNotice && (
              <p className="rounded-xl bg-gray-100 px-3 py-2 text-xs leading-5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Тёмная тема появится в одном из следующих обновлений POTOK.
              </p>
            )}
          </section>
        </div>

        {/* Confirm Button */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            ПОДТВЕРДИТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
