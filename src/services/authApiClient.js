export function createAuthApiClient(fetchImpl = fetch) {
  async function requestJson(path, options = {}) {
    try {
      const response = await fetchImpl(path, {
        credentials: 'include',
        ...options,
        headers: {
          'content-type': 'application/json',
          ...(options.headers ?? {}),
        },
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
      }
      return { ok: true, status: response.status, ...data };
    } catch {
      return { ok: false, status: 0, message: '账号服务暂时无法连接。' };
    }
  }

  return {
    fetchCurrentUser() {
      return requestJson('api/auth/me');
    },
    registerCc98({ code, password }) {
      return requestJson('api/auth/register/cc98', { method: 'POST', body: JSON.stringify({ code, password }) });
    },
    loginCc98({ cc98Name, password }) {
      return requestJson('api/auth/login/cc98', { method: 'POST', body: JSON.stringify({ cc98Name, password }) });
    },
    requestEmailCode({ studentId, purpose }) {
      return requestJson('api/auth/email/code', { method: 'POST', body: JSON.stringify({ studentId, purpose }) });
    },
    registerEmail({ studentId, nickname, code, password }) {
      return requestJson('api/auth/register/email', {
        method: 'POST', body: JSON.stringify({ studentId, nickname, code, password }),
      });
    },
    loginEmail({ studentId, password }) {
      return requestJson('api/auth/login/email', { method: 'POST', body: JSON.stringify({ studentId, password }) });
    },
    bindEmail({ studentId, code }) {
      return requestJson('api/auth/bind/email', { method: 'POST', body: JSON.stringify({ studentId, code }) });
    },
    resetEmailPassword({ studentId, code, password }) {
      return requestJson('api/auth/password/reset/email', {
        method: 'POST', body: JSON.stringify({ studentId, code, password }),
      });
    },
    logout() {
      return requestJson('api/auth/logout', { method: 'POST' });
    },
  };
}

const client = createAuthApiClient();

export const fetchCurrentUser = () => client.fetchCurrentUser();
export const registerCc98Account = (input) => client.registerCc98(input);
export const loginCc98Account = (input) => client.loginCc98(input);
export const requestEmailVerificationCode = (input) => client.requestEmailCode(input);
export const registerEmailAccount = (input) => client.registerEmail(input);
export const loginEmailAccount = (input) => client.loginEmail(input);
export const bindEmailAccount = (input) => client.bindEmail(input);
export const resetEmailAccountPassword = (input) => client.resetEmailPassword(input);
export const logoutAccount = () => client.logout();
