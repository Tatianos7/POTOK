import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasEffectivePremiumAccess, type PremiumAccessUser } from '../utils/premiumAccess';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

export type PremiumRouteResolution = 'loading' | 'auth' | 'paywall' | 'allow';

export function resolvePremiumRouteAccess(
  authStatus: AuthStatus,
  user: PremiumAccessUser | null,
  hasPremiumAccess: boolean,
): PremiumRouteResolution {
  if (authStatus === 'booting' || (authStatus === 'authenticated' && !user)) {
    return 'loading';
  }

  if (authStatus === 'unauthenticated') {
    return 'auth';
  }

  return hasPremiumAccess ? 'allow' : 'paywall';
}

interface PremiumRouteProps {
  children: ReactNode;
}

const PremiumRoute = ({ children }: PremiumRouteProps) => {
  const { authStatus, user } = useAuth();
  const resolution = resolvePremiumRouteAccess(authStatus, user, hasEffectivePremiumAccess(user));

  if (resolution === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (resolution === 'auth') {
    return <Navigate to="/auth" replace />;
  }

  if (resolution === 'paywall') {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
};

export default PremiumRoute;
