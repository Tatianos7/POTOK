const PIN_LOCK_STORAGE_KEY = 'pin_lock_v1';
const PIN_UNLOCKED_SESSION_KEY = 'pin_lock_unlocked_v1';
const PIN_OFFER_SKIPPED_KEY = 'pin_offer_skipped_v1';

type StoredPin = {
  salt: string;
  hash: string;
  createdAt: string;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const hashPinWithSalt = async (pin: string, salt: string): Promise<string> => {
  const payload = new TextEncoder().encode(`${pin}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(new Uint8Array(digest));
};

const readStoredPin = (): StoredPin | null => {
  try {
    const raw = localStorage.getItem(PIN_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPin>;
    if (!parsed.salt || !parsed.hash) return null;
    return {
      salt: parsed.salt,
      hash: parsed.hash,
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const isPinLockEnabled = (): boolean => Boolean(readStoredPin());

export const isPinSessionUnlocked = (): boolean =>
  sessionStorage.getItem(PIN_UNLOCKED_SESSION_KEY) === '1';

export const markPinSessionUnlocked = (): void => {
  sessionStorage.setItem(PIN_UNLOCKED_SESSION_KEY, '1');
};

export const clearPinSessionUnlocked = (): void => {
  sessionStorage.removeItem(PIN_UNLOCKED_SESSION_KEY);
};

export const setupPinLock = async (pin: string): Promise<void> => {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('invalid_pin');
  }
  const salt = randomSalt();
  const hash = await hashPinWithSalt(pin, salt);
  const payload: StoredPin = {
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(PIN_LOCK_STORAGE_KEY, JSON.stringify(payload));
  markPinSessionUnlocked();
};

export const verifyPinLock = async (pin: string): Promise<boolean> => {
  const stored = readStoredPin();
  if (!stored) return false;
  const hash = await hashPinWithSalt(pin, stored.salt);
  return hash === stored.hash;
};

export const clearPinLock = (): void => {
  localStorage.removeItem(PIN_LOCK_STORAGE_KEY);
  clearPinSessionUnlocked();
};

export const isPinOfferSkipped = (): boolean =>
  localStorage.getItem(PIN_OFFER_SKIPPED_KEY) === 'true';

export const markPinOfferSkipped = (): void => {
  localStorage.setItem(PIN_OFFER_SKIPPED_KEY, 'true');
};

export const clearPinOfferSkipped = (): void => {
  localStorage.removeItem(PIN_OFFER_SKIPPED_KEY);
};

export const getPostLoginRoute = (): '/pin/offer' | '/' => {
  if (isPinLockEnabled()) return '/';
  if (isPinOfferSkipped()) return '/';
  return '/pin/offer';
};
