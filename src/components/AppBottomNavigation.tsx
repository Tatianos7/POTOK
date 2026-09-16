import {
  BarChart3,
  BookOpen,
  Dumbbell,
  Home,
  MoreHorizontal,
  Ruler,
  Sparkles,
  Target,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

export type BottomNavSection = 'home' | 'goal' | 'nutrition' | 'workouts' | 'more';

const AUTH_SHELL_EXCLUDED_PATHS = [
  '/auth',
  '/auth/callback',
  '/login',
  '/register',
  '/forgot-password',
  '/pin/unlock',
  '/pin/offer',
  '/pin/setup',
];

const primaryItems: Array<{
  id: Exclude<BottomNavSection, 'more'>;
  label: string;
  to: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Главная', to: '/', icon: Home },
  { id: 'goal', label: 'Цель', to: '/goals', icon: Target },
  { id: 'nutrition', label: 'Питание', to: '/nutrition', icon: UtensilsCrossed },
  { id: 'workouts', label: 'Тренировки', to: '/workouts', icon: Dumbbell },
];

const overflowItems = [
  { label: 'Замеры', to: '/measurements', icon: Ruler },
  { label: 'Прогресс', to: '/progress', icon: BarChart3 },
  { label: 'Профиль', to: '/profile', icon: User },
];

const premiumOverflowItems = [
  { label: 'Сборник рецептов', to: '/premium-recipes', icon: BookOpen },
  ...overflowItems,
];

const freeOverflowItems = [
  { label: 'Premium', to: '/paywall', icon: Sparkles },
  ...overflowItems,
];

export function getBottomNavOverflowItems(hasPremiumAccess: boolean) {
  return hasPremiumAccess ? premiumOverflowItems : freeOverflowItems;
}

export function shouldShowBottomNavigation(authStatus: AuthStatus, pathname: string): boolean {
  if (authStatus !== 'authenticated') return false;
  return !AUTH_SHELL_EXCLUDED_PATHS.some((excludedPath) => pathname === excludedPath);
}

export function getActiveBottomNavSection(pathname: string): BottomNavSection {
  if (pathname === '/') return 'home';
  if (pathname === '/goals' || pathname === '/goal' || pathname.startsWith('/goal/')) return 'goal';
  if (pathname.startsWith('/nutrition')) return 'nutrition';
  if (pathname.startsWith('/workouts')) return 'workouts';
  if (pathname.startsWith('/measurements') || pathname.startsWith('/progress') || pathname.startsWith('/profile')) {
    return 'more';
  }
  return 'more';
}

const navItemBaseClass =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors';

function getNavItemClass(isActive: boolean): string {
  return `${navItemBaseClass} ${
    isActive
      ? 'bg-emerald-50 text-emerald-700'
      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
  }`;
}

interface AppBottomNavigationProps {
  hasPremiumAccess?: boolean;
}

const AppBottomNavigation = ({ hasPremiumAccess = false }: AppBottomNavigationProps) => {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const activeSection = getActiveBottomNavSection(location.pathname);
  const visibleOverflowItems = getBottomNavOverflowItems(hasPremiumAccess);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  return (
    <>
      {isMoreOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20"
          aria-label="Закрыть меню Ещё"
          onClick={() => setIsMoreOpen(false)}
        />
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[768px] border-t border-gray-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Основная навигация"
      >
        {isMoreOpen ? (
          <div className="absolute bottom-[calc(100%+0.35rem)] left-3 right-3 z-50 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
            <div className="grid grid-cols-4 gap-1.5" aria-label="Ещё">
              {visibleOverflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-100 bg-gray-50 px-1.5 py-1.5 text-center text-[10px] font-semibold leading-3 text-gray-800 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="line-clamp-2">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-stretch gap-1 pb-2">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={getNavItemClass(isActive)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className={getNavItemClass(activeSection === 'more' || isMoreOpen)}
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            onClick={() => setIsMoreOpen((current) => !current)}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">Ещё</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default AppBottomNavigation;
