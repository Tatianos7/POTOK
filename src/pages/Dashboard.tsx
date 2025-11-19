import { useAuth } from '../context/AuthContext';
import { FEATURE_CARDS, ICON_MAP } from '../utils/constants';
import { Menu as MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FeatureCard from '../components/FeatureCard';
import Menu from '../components/Menu';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto relative">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-center relative border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">
            Привет, {user?.name || 'Пользователь'}
          </h1>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="absolute right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Меню"
          >
            <MenuIcon className="w-6 h-6 text-gray-700" />
          </button>
        </header>

        {/* Menu Popup */}
        <Menu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onLogout={handleLogout}
          userEmail={user?.email}
        />

        {/* Main Content */}
        <main className="px-4 py-6">
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
