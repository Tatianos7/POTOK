export const AUTH_CALLBACK_ROUTE = 'auth/callback';

type AuthRedirectOptions = {
  origin?: string;
  baseUrl?: string;
};

const getDefaultOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
};

const getDefaultBaseUrl = (): string => {
  const env = typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: { BASE_URL?: string } }).env
    : undefined;
  return env?.BASE_URL || '/';
};

export function getAuthCallbackRedirectUrl(options: AuthRedirectOptions = {}): string {
  const origin = options.origin ?? getDefaultOrigin();
  const rawBaseUrl = (options.baseUrl ?? getDefaultBaseUrl()).trim() || '/';
  const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

  return new URL(`${normalizedBaseUrl}${AUTH_CALLBACK_ROUTE}`, origin).toString();
}
