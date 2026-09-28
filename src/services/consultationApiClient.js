import { createJsonClient } from './apiClient.js';

export function createConsultationApiClient(fetchImpl = fetch) {
  const { requestJson } = createJsonClient({
    name: 'consultation',
    fetchImpl,
    networkErrorMessage: '咨询服务暂时无法连接。',
  });
  const base = 'api/consultation';
  const conversationPath = (id) => `${base}/conversations/${encodeURIComponent(id)}`;

  return {
    getStatus: () => requestJson(`${base}/status`),
    createConversation: ({ guestName } = {}) => requestJson(`${base}/conversations`, {
      method: 'POST',
      body: guestName?.trim() ? { guestName: guestName.trim() } : {},
    }),
    getCurrentConversation: () => requestJson(`${base}/conversations/current`),
    listConversations: () => requestJson(`${base}/conversations`),
    listMessages: (id) => requestJson(`${conversationPath(id)}/messages`),
    sendMessage: (id, text) => requestJson(`${conversationPath(id)}/messages`, {
      method: 'POST',
      body: { text },
    }),
    listCandidates: (query = '') => requestJson(`api/admin/consultation/candidates?${new URLSearchParams({ q: query })}`),
    setSession: ({ mentorUserId, startsAt, endsAt }) => requestJson('api/admin/consultation/session', {
      method: 'PUT',
      body: { mentorUserId, startsAt, endsAt },
    }),
    closeSession: () => requestJson('api/admin/consultation/session', { method: 'DELETE' }),
  };
}

export const consultationApiClient = createConsultationApiClient();
