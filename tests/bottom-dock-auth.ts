const syntheticUser = {
  id: 'bottom-dock-synthetic-user',
  name: 'Тестовый пользователь',
  hasPremium: false,
  createdAt: '2025-01-01T00:00:00.000Z',
};

export function useAuth() {
  return {
    user: syntheticUser,
    authStatus: 'authenticated' as const,
    isAuthenticated: true,
    isLoading: false,
    profile: null,
  };
}
