import { publicApiPath } from './apiClient.js';
import { activityProgramIds } from '../data/activityConfig.js';

const fallbackCatalogPath = 'content/activities/catalog.json';

export function createActivityApiClient(fetchImpl = fetch) {
  async function readFallback() {
    try {
      const response = await fetchImpl(fallbackCatalogPath);
      if (!response.ok) return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
      const data = await response.json();
      const activities = (data.articles ?? [])
        .filter((item) => item.status === 'published' && item.externalUrl && activityProgramIds.has(item.programId))
        .map((item) => ({ ...item, featured: false }))
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      return { ok: true, fallback: true, activities };
    } catch {
      return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
    }
  }

  return {
    async fetchActivities() {
      try {
        const response = await fetchImpl(publicApiPath('/api/activities'), {
          credentials: 'include',
        });
        if (!response.ok) return readFallback();
        const data = await response.json();
        return { ok: true, activities: (data.activities ?? []).filter((item) => activityProgramIds.has(item.programId)) };
      } catch {
        return readFallback();
      }
    },
  };
}

export const activityApiClient = createActivityApiClient();
