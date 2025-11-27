import { X, Circle, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SupportForm from './SupportForm';
import { notificationService } from '../services/notificationService';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userEmail?: string;
}

const Menu: React.FC<MenuProps> = ({ isOpen, onClose, onLogout }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const refreshNotificationsIndicator = () => {
    if (!user?.id) {
      setHasUnreadNotifications(false);
      return;
    }
    
    // Дополнительная проверка userId
    if (user.id === 'undefined' || user.id === 'null' || user.id.trim() === '') {
      setHasUnreadNotifications(false);
      return;
    }
    
    const notifications = notificationService.getNotifications(user.id);
    setHasUnreadNotifications(
      notifications.some((item) => !item.isRead && !item.isDeleted && !item.isArchived)
    );
  };

  useEffect(() => {
    refreshNotificationsIndicator();
  }, [user?.id]);

  // Обновляем индикатор при открытии меню
  useEffect(() => {
    if (isOpen) {
      refreshNotificationsIndicator();
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      // Обновляем индикатор если событие для текущего пользователя или userId не указан (глобальное обновление)
      if (!customEvent.detail?.userId || customEvent.detail.userId === user.id) {
        refreshNotificationsIndicator();
      }
    };
    window.addEventListener('notifications-updated', handler as EventListener);
    return () => window.removeEventListener('notifications-updated', handler as EventListener);
  }, [user?.id]);


  const handleMenuItemClick = (itemId: string) => {
    if (itemId === 'profile') {
      onClose();
      navigate('/profile');
    } else if (itemId === 'support') {
      onClose();
      setIsSupportFormOpen(true);
    } else if (itemId === 'notifications') {
      onClose();
      navigate('/notifications');
    }
  };

  const menuItems = [
    { id: 'profile', label: 'ПРОФИЛЬ', isActive: true },
    {
      id: 'notifications',
      label: 'УВЕДОМЛЕНИЯ',
      indicator: hasUnreadNotifications ? 'unread' : 'read',
    },
    { id: 'settings', label: 'ОБЩИЕ НАСТРОЙКИ' },
    { id: 'support', label: 'ПОДДЕРЖКА' },
  ];

  return (
    <>
      <SupportForm isOpen={isSupportFormOpen} onClose={() => setIsSupportFormOpen(false)} />
      
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Menu Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
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
              className={`w-full py-3 px-4 rounded-lg text-center font-semibold text-sm uppercase transition-colors ${
                item.isActive
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{item.label}</span>
                {item.indicator && (
                  item.indicator === 'unread' ? (
                    <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                  ) : (
                    <Check className="w-3 h-3 text-green-500" />
                  )
                )}
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

