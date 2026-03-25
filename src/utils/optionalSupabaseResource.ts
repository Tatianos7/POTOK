type OptionalResourceState = 'present' | 'missing';

const memoryCache = new Map<string, OptionalResourceState>();

function getStorageKey(resource: string): string {
  return `potok_optional_supabase_resource_${resource}`;
}

function getSessionStorage(): Storage | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  return sessionStorage;
}

export function isOptionalSupabaseResourceMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === 'PGRST205' ||
    candidate.code === 'PGRST204' ||
    candidate.message?.includes('404') === true
  );
}

export function getOptionalSupabaseResourceState(resource: string): OptionalResourceState | null {
  if (memoryCache.has(resource)) {
    return memoryCache.get(resource)!;
  }

  const storage = getSessionStorage();
  const stored = storage?.getItem(getStorageKey(resource));
  if (stored === 'present' || stored === 'missing') {
    memoryCache.set(resource, stored);
    return stored;
  }

  return null;
}

export function setOptionalSupabaseResourceState(resource: string, state: OptionalResourceState): void {
  memoryCache.set(resource, state);
  const storage = getSessionStorage();
  storage?.setItem(getStorageKey(resource), state);
}

export function clearOptionalSupabaseResourceState(resource: string): void {
  memoryCache.delete(resource);
  const storage = getSessionStorage();
  storage?.removeItem(getStorageKey(resource));
}

