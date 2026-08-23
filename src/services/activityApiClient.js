const fallbackCatalogPath = 'content/activities/catalog.json';

export function createActivityApiClient(fetchImpl = fetch) {
  async function readFallback(featured = false) {
    try {
      const response = await fetchImpl(fallbackCatalogPath);
      if (!response.ok) return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
      const data = await response.json();
      const activities = (data.activities ?? [])
        .filter((item) => item.status === 'published' && (!featured || item.featured))
        .sort((a, b) => a.displayOrder - b.displayOrder);
      return { ok: true, fallback: true, activities };
    } catch {
      return { ok: false, activities: [], message: '活动内容暂时无法读取。' };
    }
  }

  return {
    async fetchActivities({ featured = false } = {}) {
      try {
        const response = await fetchImpl(`api/activities${featured ? '?featured=1' : ''}`, {
          credentials: 'include',
        });
        if (!response.ok) return readFallback(featured);
        const data = await response.json();
        return { ok: true, activities: data.activities ?? [] };
      } catch {
        return readFallback(featured);
      }
    },
  };
}

export const activityApiClient = createActivityApiClient();
