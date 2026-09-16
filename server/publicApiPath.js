export const PUBLIC_API_PREFIX = '/zjubio/api';

/**
 * Convert an internal Node route to the public same-origin route exposed by
 * Apache. Node continues to serve /api/* on loopback; browsers only receive
 * URLs below /zjubio/api/* on the shared bis.zju.edu.cn host.
 */
export function publicApiPath(path) {
  const raw = String(path ?? '');
  if (raw === PUBLIC_API_PREFIX || raw.startsWith(`${PUBLIC_API_PREFIX}/`)) return raw;
  if (raw === '/api' || raw === 'api') return PUBLIC_API_PREFIX;
  if (raw.startsWith('/api/')) return `${PUBLIC_API_PREFIX}/${raw.slice(5)}`;
  if (raw.startsWith('api/')) return `${PUBLIC_API_PREFIX}/${raw.slice(4)}`;
  throw new TypeError(`Expected an API path, received: ${raw}`);
}
