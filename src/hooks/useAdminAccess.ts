import { useEffect, useState } from 'react';
import type { User } from '../types';
import type { UserProfile } from '../services/profileService';
import { adminAccessService } from '../services/adminAccessService';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

export type AdminAccessStatus = 'checking' | 'allowed' | 'denied';

export const useAdminAccess = ({
  authStatus,
  user,
  profile,
}: {
  authStatus: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
}): AdminAccessStatus => {
  const [status, setStatus] = useState<AdminAccessStatus>('checking');
  const contextAllowsAdmin = Boolean(user?.isAdmin || profile?.is_admin);

  useEffect(() => {
    let isActive = true;

    if (authStatus === 'booting') {
      setStatus('checking');
      return () => {
        isActive = false;
      };
    }

    if (authStatus === 'unauthenticated') {
      setStatus('denied');
      return () => {
        isActive = false;
      };
    }

    if (contextAllowsAdmin) {
      setStatus('allowed');
      return () => {
        isActive = false;
      };
    }

    if (!user?.id) {
      setStatus('checking');
      return () => {
        isActive = false;
      };
    }

    setStatus('checking');
    void adminAccessService.verifyCurrentUserIsAdmin(user.id).then((isAdmin) => {
      if (!isActive) return;
      setStatus(isAdmin ? 'allowed' : 'denied');
    });

    return () => {
      isActive = false;
    };
  }, [authStatus, contextAllowsAdmin, user?.id]);

  return status;
};
