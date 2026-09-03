import { createJsonClient } from './apiClient.js';

export function createAuthApiClient(fetchImpl = fetch) {
  const { requestJson } = createJsonClient({ name: 'auth', fetchImpl, networkErrorMessage: '账号服务暂时无法连接。' });

  return {
    fetchCurrentUser() {
      return requestJson('api/auth/me');
    },
    registerCc98({ code, password }) {
      return requestJson('api/auth/register/cc98', { method: 'POST', body: { code, password } });
    },
    loginCc98({ cc98Name, password }) {
      return requestJson('api/auth/login/cc98', { method: 'POST', body: { cc98Name, password } });
    },
    requestEmailCode({ studentId, purpose }) {
      return requestJson('api/auth/email/code', { method: 'POST', body: { studentId, purpose } });
    },
    registerEmail({ studentId, nickname, code, password }) {
      return requestJson('api/auth/register/email', {
        method: 'POST', body: { studentId, nickname, code, password },
      });
    },
    loginEmail({ studentId, password }) {
      return requestJson('api/auth/login/email', { method: 'POST', body: { studentId, password } });
    },
    bindEmail({ studentId, code }) {
      return requestJson('api/auth/bind/email', { method: 'POST', body: { studentId, code } });
    },
    resetEmailPassword({ studentId, code, password }) {
      return requestJson('api/auth/password/reset/email', {
        method: 'POST', body: { studentId, code, password },
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
