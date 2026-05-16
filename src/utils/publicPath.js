const externalUrlPattern = /^(https?:)?\/\//i;

export function normalizePublicPath(path, base = '/') {
  if (!path || externalUrlPattern.test(path)) {
    return path;
  }

  const cleanPath = String(path).replace(/^\/+/, '');

  if (!base || base === './') {
    return `./${cleanPath}`;
  }

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
}

export function publicAssetPath(path) {
  return normalizePublicPath(path, import.meta.env?.BASE_URL ?? '/');
}
