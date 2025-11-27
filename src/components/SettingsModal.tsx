import { useState, useEffect } from 'react';
import { X, Check, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Settings {
  cameraAccess: boolean;
  microphoneAccess: boolean;
  emailNewsletter: boolean;
  autopayment: boolean;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    cameraAccess: false,
    microphoneAccess: true,
    emailNewsletter: false,
    autopayment: true,
  });

  // Загружаем настройки из localStorage при открытии
  useEffect(() => {
    if (isOpen && user?.id) {
      const savedSettings = localStorage.getItem(`settings_${user.id}`);
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch (error) {
          console.error('Ошибка загрузки настроек:', error);
        }
      }
    }
  }, [isOpen, user?.id]);

  const handleToggle = (key: keyof Settings) => {
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

  const settingsList = [
    {
      key: 'cameraAccess' as keyof Settings,
      label: 'Доступ к камере',
      value: settings.cameraAccess,
    },
    {
      key: 'microphoneAccess' as keyof Settings,
      label: 'Доступ к микрофону',
      value: settings.microphoneAccess,
    },
    {
      key: 'emailNewsletter' as keyof Settings,
      label: 'Email-рассылка',
      value: settings.emailNewsletter,
    },
    {
      key: 'autopayment' as keyof Settings,
      label: 'Автоплатеж',
      value: settings.autopayment,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white uppercase">
            ОБЩИЕ НАСТРОЙКИ
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        {/* Settings List */}
        <div className="p-6 space-y-4">
          {settingsList.map((setting) => (
            <div
              key={setting.key}
              className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                setting.value
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-red-500 bg-red-50 dark:bg-red-900/20'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {setting.value ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : null}
                <span className="text-base font-medium text-gray-900 dark:text-white">
                  {setting.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                onClick={() => handleToggle(setting.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  setting.value
                    ? 'bg-green-500 focus:ring-green-500'
                    : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-500'
                }`}
                role="switch"
                aria-checked={setting.value}
              >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      setting.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                {!setting.value ? (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : null}
              </div>
            </div>
          ))}
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

