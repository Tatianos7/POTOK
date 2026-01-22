import { useAuth } from '../context/AuthContext';
import { FEATURE_CARDS, ICON_MAP } from '../utils/constants';
import { Menu as MenuIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FeatureCard from '../components/FeatureCard';
import Menu from '../components/Menu';
import { activityService } from '../services/activityService';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Перенаправляем админов в админ-панель
  useEffect(() => {
    if (user?.isAdmin) {
      navigate('/admin');
    }
  }, [user, navigate]);

  // Обновляем активность пользователя
  useEffect(() => {
    if (user?.id) {
      activityService.updateActivity(user.id);
      
      // Обновляем активность каждую минуту
      const interval = setInterval(() => {
        if (user?.id) {
          activityService.updateActivity(user.id);
        }
      }, 60000); // Каждую минуту

      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.profile?.firstName || user?.name || 'Пользователь';

  return (
    <div className="min-h-screen bg-white w-full min-w-[320px]">
      <div className="container-responsive">
        {/* Header */}
        <header className="py-4 flex items-center justify-center relative border-b border-gray-200">
          <h1 className="text-base mobile-lg:text-lg font-semibold text-gray-900">
            Привет, {displayName}
          </h1>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="absolute right-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Меню"
          >
            <MenuIcon className="w-5 h-5 mobile-lg:w-6 mobile-lg:h-6 text-gray-700" />
          </button>
        </header>

        {/* Menu Popup */}
        <Menu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onLogout={handleLogout}
          userEmail={user?.profile?.email || user?.email}
        />

        {/* Main Content */}
        <main className="py-4 tablet:py-6">
          <div className="space-y-3">
            {FEATURE_CARDS.map((card) => {
              const IconComponent = ICON_MAP[card.icon];
              return (
                <FeatureCard
                  key={card.id}
                  card={card}
                  icon={IconComponent}
                  hasPremium={user?.hasPremium || false}
                />
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
