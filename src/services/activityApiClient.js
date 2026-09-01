const fallbackCatalogPath = 'content/activities/catalog.json';

export function createActivityApiClient(fetchImpl = fetch) {
  async function readFallback() {
    try {
      const response = await fetchImpl(fallbackCatalogPath);
      if (!response.ok) return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
      const data = await response.json();
      const activities = (data.activities ?? [])
        .filter((item) => item.status === 'published' && item.externalUrl)
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      return { ok: true, fallback: true, activities };
    } catch {
      return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
    }
  }

  return {
    async fetchActivities() {
      try {
        const response = await fetchImpl('api/activities', {
          credentials: 'include',
        });
        if (!response.ok) return readFallback();
        const data = await response.json();
        return { ok: true, activities: data.activities ?? [] };
      } catch {
        return readFallback();
      }
    },
  };
}

export const activityApiClient = createActivityApiClient();
