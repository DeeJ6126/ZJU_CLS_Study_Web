async function requestJson(path, options = {}) {
  try {
    const response = await fetch(path, { credentials: 'include', ...options });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, status: response.status, message: data.message ?? '请求失败。' };
    }
    return { ok: true, status: response.status, ...data };
  } catch {
    return { ok: false, status: 0, message: '账号服务暂时无法连接。' };
  }
}

function jsonOptions(method, body = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function searchProfiles(query) {
  return requestJson(`api/profiles?query=${encodeURIComponent(query)}`);
}

export function fetchPublicProfile(publicId) {
  return requestJson(`api/profiles/${encodeURIComponent(publicId)}`);
}

export function fetchMyProfile() {
  return requestJson('api/account/profile');
}

export function updateMyNickname(nickname) {
  return requestJson('api/account/profile', jsonOptions('PATCH', { nickname }));
}

export function uploadMyAvatar(file) {
  return requestJson('api/account/profile/avatar', {
    method: 'PUT',
    headers: {
      'content-type': file.type,
      'x-profile-upload': 'avatar',
    },
    body: file,
  });
}

export function removeMyAvatar() {
  return requestJson('api/account/profile/avatar', { method: 'DELETE' });
}

export function bindMyCc98(input) {
  return requestJson('api/account/cc98', jsonOptions('PUT', input));
}

export function submitPostRevision(contentId, changes) {
  return requestJson(
    `api/account/posts/${encodeURIComponent(contentId)}/revisions`,
    jsonOptions('POST', changes),
  );
}

export function archiveMyPost(contentId) {
  return requestJson(
    `api/account/posts/${encodeURIComponent(contentId)}/archive`,
    jsonOptions('POST'),
  );
}

export function resubmitMySubmission(submissionId, changes = {}) {
  return requestJson(
    `api/account/submissions/${encodeURIComponent(submissionId)}/resubmit`,
    jsonOptions('POST', changes),
  );
}

export function updateMySubmission(submissionId, changes) {
  return requestJson(`api/account/submissions/${encodeURIComponent(submissionId)}`, jsonOptions('PATCH', changes));
}

export function withdrawMySubmission(submissionId) {
  return requestJson(`api/account/submissions/${encodeURIComponent(submissionId)}/withdraw`, jsonOptions('POST'));
}

export function deleteMySubmission(submissionId) {
  return requestJson(`api/account/submissions/${encodeURIComponent(submissionId)}`, { method: 'DELETE' });
}
