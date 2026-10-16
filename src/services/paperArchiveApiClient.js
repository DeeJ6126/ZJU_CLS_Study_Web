import { createRawClient } from './apiClient.js';

export function createPaperArchiveApiClient({ fetchImpl = fetch } = {}) {
  const { fetchRaw } = createRawClient({ name: 'paper-archive', fetchImpl });
  return {
    async download(courseCode, { year = '', teacher = '' } = {}, { signal } = {}) {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (teacher) params.set('teacher', teacher);
      const response = await fetchRaw(`api/content/courses/${encodeURIComponent(courseCode)}/papers/download?${params}`, { signal });
      if (!response) return { ok: false, message: '下载服务暂时无法连接，请稍后重试。' };
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        return { ok: false, message: error?.message || '试卷下载失败，请稍后重试。' };
      }
      if (!(response.headers.get('content-type') || '').startsWith('application/zip')) {
        return { ok: false, message: '试卷文件格式异常，请稍后重试。' };
      }
      const match = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i);
      let filename = `${courseCode}-历年试卷.zip`;
      try { if (match) filename = decodeURIComponent(match[1]); } catch { /* Keep the fallback name. */ }
      try { return { ok: true, blob: await response.blob(), filename }; }
      catch { return { ok: false, message: '试卷下载中断，请重试。' }; }
    },
  };
}

export function savePaperArchive({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
