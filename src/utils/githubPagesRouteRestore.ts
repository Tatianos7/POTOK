const SPA_FALLBACK_MARKER = 'spa';
const SPA_FALLBACK_PATH = 'p';

export function resolveGithubPagesFallbackRoute(search: string, baseUrl: string): string | null {
  const searchParams = new URLSearchParams(search);
  if (searchParams.get(SPA_FALLBACK_MARKER) !== '1') {
    return null;
  }

  const restoredPath = searchParams.get(SPA_FALLBACK_PATH);
  if (!restoredPath) {
    return null;
  }

  const normalizedPath = restoredPath.startsWith('/') ? restoredPath : `/${restoredPath}`;
  return `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
}
