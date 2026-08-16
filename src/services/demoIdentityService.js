import { demoIdentities } from '../data/config/demoUsers.js';

export const demoIdentityStorageKey = 'study-platform-demo-identity';

// Empty id means "use the real signed-in user".
export const realIdentityId = '';

function getStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export function getDemoIdentityOptions() {
  return demoIdentities.map(({ id, label, description }) => ({ id, label, description }));
}

export function buildDemoUser(identityId) {
  const identity = demoIdentities.find((item) => item.id === identityId);
  if (!identity) {
    return null;
  }
  return { ...identity.user, isDemo: true };
}

export function loadDemoIdentityId() {
  const storage = getStorage();
  if (!storage) {
    return realIdentityId;
  }
  try {
    const stored = storage.getItem(demoIdentityStorageKey);
    if (!stored) {
      return realIdentityId;
    }
    return demoIdentities.some((item) => item.id === stored) ? stored : realIdentityId;
  } catch {
    return realIdentityId;
  }
}

export function saveDemoIdentityId(identityId) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    if (!identityId) {
      storage.removeItem(demoIdentityStorageKey);
    } else {
      storage.setItem(demoIdentityStorageKey, identityId);
    }
  } catch {
    // Storage unavailable: switching still works for the current session.
  }
}
