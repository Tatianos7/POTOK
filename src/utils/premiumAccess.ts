import { hasDemoPremiumAccess } from '../services/demoPremiumAccess';

export interface PremiumAccessUser {
  hasPremium?: boolean | null;
}

export function hasEffectivePremiumAccess(
  user: PremiumAccessUser | null | undefined,
  demoPremiumAccess = hasDemoPremiumAccess(),
): boolean {
  return user?.hasPremium === true || demoPremiumAccess;
}
