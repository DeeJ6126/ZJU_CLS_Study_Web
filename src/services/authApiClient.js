async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
  }
  return { ok: true, status: response.status, ...data };
}

export function fetchCurrentUser() {
  return requestJson('/api/auth/me');
}

export function registerCc98Account({ code, password }) {
  return requestJson('/api/auth/register/cc98', {
    method: 'POST',
    body: JSON.stringify({ code, password }),
  });
}

export function loginCc98Account({ cc98Name, password }) {
  return requestJson('/api/auth/login/cc98', {
    method: 'POST',
    body: JSON.stringify({ cc98Name, password }),
  });
}

export function logoutAccount() {
  return requestJson('/api/auth/logout', { method: 'POST' });
}
