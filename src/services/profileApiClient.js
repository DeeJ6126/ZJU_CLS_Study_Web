import { createRequestClient } from './apiClient.js';

export function createProfileApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({ name: 'profile', fetchImpl, networkErrorMessage: '账号服务暂时无法连接。' });

  const json = (method, body) => (body === undefined ? { method } : { method, body });

  return {
    searchProfiles(query) {
      return request(`api/profiles?query=${encodeURIComponent(query)}`);
    },
    fetchPublicProfile(publicId) {
      return request(`api/profiles/${encodeURIComponent(publicId)}`);
    },
    fetchMyProfile() {
      return request('api/account/profile');
    },
    updateMyNickname(nickname) {
      return request('api/account/profile', json('PATCH', { nickname }));
    },
    updateMyGrade(grade) {
      return request('api/account/profile/grade', json('PATCH', { grade }));
    },
    uploadMyAvatar(file) {
      return request('api/account/profile/avatar', {
        method: 'PUT',
        headers: {
          'content-type': file.type,
          'x-profile-upload': 'avatar',
        },
        body: file,
      });
    },
    removeMyAvatar() {
      return request('api/account/profile/avatar', { method: 'DELETE' });
    },
    bindMyCc98(input) {
      return request('api/account/cc98', json('PUT', input));
    },
    submitPostRevision(contentId, changes) {
      return request(
        `api/account/posts/${encodeURIComponent(contentId)}/revisions`,
        json('POST', changes),
      );
    },
    archiveMyPost(contentId) {
      return request(
        `api/account/posts/${encodeURIComponent(contentId)}/archive`,
        json('POST'),
      );
    },
    resubmitMySubmission(submissionId, changes = {}) {
      return request(
        `api/account/submissions/${encodeURIComponent(submissionId)}/resubmit`,
        json('POST', changes),
      );
    },
    updateMySubmission(submissionId, changes) {
      return request(`api/account/submissions/${encodeURIComponent(submissionId)}`, json('PATCH', changes));
    },
    withdrawMySubmission(submissionId) {
      return request(`api/account/submissions/${encodeURIComponent(submissionId)}/withdraw`, json('POST'));
    },
    deleteMySubmission(submissionId) {
      return request(`api/account/submissions/${encodeURIComponent(submissionId)}`, { method: 'DELETE' });
    },
  };
}

export const profileApiClient = createProfileApiClient();

export const searchProfiles = (...args) => profileApiClient.searchProfiles(...args);
export const fetchPublicProfile = (...args) => profileApiClient.fetchPublicProfile(...args);
export const fetchMyProfile = (...args) => profileApiClient.fetchMyProfile(...args);
export const updateMyNickname = (...args) => profileApiClient.updateMyNickname(...args);
export const updateMyGrade = (...args) => profileApiClient.updateMyGrade(...args);
export const uploadMyAvatar = (...args) => profileApiClient.uploadMyAvatar(...args);
export const removeMyAvatar = (...args) => profileApiClient.removeMyAvatar(...args);
export const bindMyCc98 = (...args) => profileApiClient.bindMyCc98(...args);
export const submitPostRevision = (...args) => profileApiClient.submitPostRevision(...args);
export const archiveMyPost = (...args) => profileApiClient.archiveMyPost(...args);
export const resubmitMySubmission = (...args) => profileApiClient.resubmitMySubmission(...args);
export const updateMySubmission = (...args) => profileApiClient.updateMySubmission(...args);
export const withdrawMySubmission = (...args) => profileApiClient.withdrawMySubmission(...args);
export const deleteMySubmission = (...args) => profileApiClient.deleteMySubmission(...args);
