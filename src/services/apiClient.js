// Shared HTTP client factories for the Study_Web frontend. Each factory
// returns a thin wrapper that produces a uniform {ok, status, message, ...data}
// envelope so domain-specific client files (authApiClient, commentApiClient,
// etc.) can stay focused on their endpoint surface and stop re-implementing
// fetch + JSON parsing + error mapping.
//
// Conventions:
//   - All requests include `credentials: 'include'` so the server's session
//     cookie travels with the call.
//   - JSON bodies are auto-stringified and `content-type: application/json`
//     is added. Binary bodies (Blob / ArrayBuffer / FormData) are passed
//     through untouched so the browser can set the correct multipart header.
//   - Network errors and non-OK responses are both returned as
//     `{ok: false, status, message}` with status 0 for true network failures.
//   - Each client can supply its own `networkErrorMessage` so the fallback
//     string reflects the domain ("管理服务", "评论服务", etc.).

const DEFAULT_NETWORK_ERROR_MESSAGE = '认证服务暂时无法连接。';

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildError(status, message, networkErrorMessage) {
  return { ok: false, status: status || 0, message: message || networkErrorMessage };
}

function buildOk(status, data) {
  return { ok: true, status, ...(data ?? {}) };
}

function isBinaryBody(body) {
  return body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData;
}

function joinUrl(basePath, path) {
  const base = String(basePath ?? '').replace(/\/$/, '');
  const tail = String(path ?? '');
  const isAbsolute = tail.startsWith('/');
  const tailClean = isAbsolute ? tail : tail.replace(/^\//, '');
  if (!base) return tailClean;
  if (isAbsolute) return `${base}${tailClean}`;
  return `${base}/${tailClean}`;
}

/**
 * Factory for JSON-only clients. Use this when every call sends and receives
 * a JSON document (the most common case).
 *
 * @param {Object} [options]
 * @param {string} [options.name]      Debug label for logs.
 * @param {string} [options.basePath]  Prefix for every request URL.
 * @param {Function} [options.fetchImpl] Injected for tests.
 * @param {string} [options.networkErrorMessage] Override the default
 *   "认证服务暂时无法连接。" used for transport failures.
 * @returns {{requestJson: Function, name: string}}
 */
export function createJsonClient({
  name = 'json-api',
  basePath = '/',
  fetchImpl = fetch,
  networkErrorMessage = DEFAULT_NETWORK_ERROR_MESSAGE,
} = {}) {
  async function requestJson(path, { method = 'GET', body, headers, signal } = {}) {
    const url = joinUrl(basePath, path);
    try {
      const response = await fetchImpl(url, {
        method,
        credentials: 'include',
        ...(signal ? { signal } : {}),
        ...(body !== undefined ? {
          body: typeof body === 'string' ? body : JSON.stringify(body),
        } : {}),
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(headers ?? {}),
        },
      });
      const data = await safeJson(response);
      if (!response.ok) {
        return buildError(response.status, data?.message, networkErrorMessage);
      }
      return buildOk(response.status, data);
    } catch {
      return buildError(0, undefined, networkErrorMessage);
    }
  }
  return { requestJson, name };
}

/**
 * Factory for clients that mix JSON and binary bodies. Auto-detects the
 * body kind and sets `content-type` only for JSON.
 *
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {string} [options.basePath]
 * @param {Function} [options.fetchImpl]
 * @param {'include'|'omit'|'same-origin'} [options.credentials] Override
 *   the default `include`; use `'omit'` for fully anonymous mode.
 * @param {string} [options.networkErrorMessage] Domain-specific fallback
 *   string used when fetch itself throws.
 * @returns {{request: Function, name: string}}
 */
export function createRequestClient({
  name = 'api',
  basePath = '/',
  fetchImpl = fetch,
  credentials = 'include',
  networkErrorMessage = DEFAULT_NETWORK_ERROR_MESSAGE,
} = {}) {
  async function request(path, { method = 'GET', body, headers, signal } = {}) {
    const url = joinUrl(basePath, path);
    try {
      const isBinary = isBinaryBody(body);
      const response = await fetchImpl(url, {
        method,
        credentials,
        ...(signal ? { signal } : {}),
        ...(body !== undefined ? {
          body: typeof body === 'string' || isBinary ? body : JSON.stringify(body),
        } : {}),
        headers: {
          ...(body !== undefined && !isBinary ? { 'content-type': 'application/json' } : {}),
          ...(headers ?? {}),
        },
      });
      const data = await safeJson(response);
      if (!response.ok) {
        return buildError(response.status, data?.message, networkErrorMessage);
      }
      return buildOk(response.status, data);
    } catch {
      return buildError(0, undefined, networkErrorMessage);
    }
  }
  return { request, name };
}

/**
 * Factory for `multipart/form-data` uploads. Wraps a single file plus an
 * optional fields map into a FormData POST.
 *
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {string} [options.basePath]
 * @param {Function} [options.fetchImpl]
 * @param {string} [options.networkErrorMessage]
 * @returns {{requestFile: Function, name: string}}
 */
export function createFileClient({
  name = 'file-api',
  basePath = '/',
  fetchImpl = fetch,
  networkErrorMessage = DEFAULT_NETWORK_ERROR_MESSAGE,
} = {}) {
  async function requestFile(path, file, fields = {}) {
    const url = joinUrl(basePath, path);
    const formData = new FormData();
    if (file) formData.append('file', file);
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await safeJson(response);
      if (!response.ok) {
        return buildError(response.status, data?.message, networkErrorMessage);
      }
      return buildOk(response.status, data);
    } catch {
      return buildError(0, undefined, networkErrorMessage);
    }
  }
  return { requestFile, name };
}

/**
 * Raw fetch wrapper that returns the raw `Response` so callers can do their
 * own body parsing (e.g. `await response.text()` for markdown). Returns
 * `null` for network failures instead of throwing.
 *
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {string} [options.basePath]
 * @param {Function} [options.fetchImpl]
 * @param {'include'|'omit'|'same-origin'} [options.credentials]
 * @returns {{fetchRaw: Function, name: string}}
 */
export function createRawClient({ name = 'raw-api', basePath = '/', fetchImpl = fetch, credentials = 'include' } = {}) {
  async function fetchRaw(path, options = {}) {
    const url = joinUrl(basePath, path);
    try {
      return await fetchImpl(url, {
        credentials,
        ...options,
      });
    } catch {
      return null;
    }
  }
  return { fetchRaw, name };
}
