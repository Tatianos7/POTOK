import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import SettingsModal from './SettingsModal';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userEmail?: string;
}

const SUPPORT_EMAIL = 'potok_sup@mail.ru';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('POTOK — обращение в поддержку')}`;

const Menu: React.FC<MenuProps> = ({ isOpen, onClose, onLogout }) => {
  const navigate = useNavigate();
  const [isSupportEmailOpen, setIsSupportEmailOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);


  const handleMenuItemClick = (itemId: string) => {
    if (itemId === 'profile') {
      onClose();
      navigate('/profile');
    } else if (itemId === 'support') {
      onClose();
      setIsSupportEmailOpen(true);
    } else if (itemId === 'settings') {
      onClose();
      setIsSettingsOpen(true);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'ПРОФИЛЬ', isActive: true },
    { id: 'settings', label: 'ОБЩИЕ НАСТРОЙКИ' },
    { id: 'support', label: 'ПОДДЕРЖКА' },
  ];

  return (
    <>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {isSupportEmailOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setIsSupportEmailOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Поддержка
              </h2>
              <button
                onClick={() => setIsSupportEmailOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              Если у вас возник вопрос, ошибка или предложение по улучшению POTOK, напишите нам на:
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-900">
              {SUPPORT_EMAIL}
            </p>
            <a
              href={SUPPORT_MAILTO}
              className="mt-5 block w-full rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold uppercase text-white transition-colors hover:bg-gray-800"
            >
              Написать письмо
            </a>
          </div>
        </div>
      )}
      
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Menu Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-full mobile-lg:max-w-sm bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex-1"></div>
          <h2 className="text-xl font-bold text-gray-900 flex-1 text-center">ПОТОК</h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-4 py-4 space-y-2 pb-24">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.id)}
              className={`w-full min-h-[44px] py-3 px-4 rounded-lg text-center font-semibold text-sm uppercase transition-colors ${
                item.isActive
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{item.label}</span>
              </div>
            </button>
          ))}

          {/* Share Link */}
          <div className="pt-2">
            <button className="w-full text-center text-blue-600 text-sm font-medium hover:underline">
              Поделиться с друзьями
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <button
            onClick={onLogout}
            className="w-full py-3 px-4 rounded-lg text-center font-semibold text-sm uppercase bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            ВЫХОД
          </button>
        </div>
      </div>
    </>
  );
};

export default Menu;
