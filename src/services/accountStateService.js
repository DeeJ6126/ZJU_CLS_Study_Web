export const authOverridesStorageKey = 'study-platform-auth-overrides';

function createCc98Override(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const hasCc98 = Boolean(value.verifications?.cc98);
  const cc98Nickname = typeof value.cc98Nickname === 'string' ? value.cc98Nickname.trim() : '';

  if (!hasCc98 && !cc98Nickname) {
    return null;
  }

  return {
    verifications: {
      cc98: hasCc98,
    },
    ...(cc98Nickname ? { cc98Nickname } : {}),
  };
}

export function sanitizeAuthOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([userId, override]) => [userId, createCc98Override(override)])
      .filter(([, override]) => override),
  );
}

export function mergeUserAuthOverride(user, overrides) {
  const sanitizedOverrides = sanitizeAuthOverrides(overrides);
  const override = sanitizedOverrides[user?.id];

  if (!user || !override) {
    return user;
  }

  return {
    ...user,
    cc98Nickname: override.cc98Nickname ?? user.cc98Nickname,
    verifications: {
      ...user.verifications,
      cc98: Boolean(override.verifications?.cc98),
    },
  };
}

export function applyCc98Verification(user, verificationResult) {
  if (!user || !verificationResult?.ok || verificationResult.provider !== 'cc98') {
    return null;
  }

  return {
    verifications: {
      cc98: true,
    },
    ...(verificationResult.cc98Nickname ? { cc98Nickname: verificationResult.cc98Nickname } : {}),
  };
}
