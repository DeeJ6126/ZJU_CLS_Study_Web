import { createRequestClient } from './apiClient.js';

export function createFeedbackApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({ name: 'feedback', fetchImpl, networkErrorMessage: '意见发送失败，请稍后重试。' });
  return { submit: (body) => request('/api/feedback', { method: 'POST', body: { body } }) };
}
export const feedbackApiClient = createFeedbackApiClient();
