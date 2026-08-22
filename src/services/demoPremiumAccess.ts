export const DEMO_PREMIUM_ACCESS_KEY = 'potok_premium_demo_access';

export function hasDemoPremiumAccess(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(DEMO_PREMIUM_ACCESS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enableDemoPremiumAccess(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(DEMO_PREMIUM_ACCESS_KEY, 'true');
  } catch {
    // Demo access stays unavailable if localStorage is blocked.
  }
}

export function clearDemoPremiumAccess(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(DEMO_PREMIUM_ACCESS_KEY);
  } catch {
    // Nothing to clear if localStorage is blocked.
  }
}
