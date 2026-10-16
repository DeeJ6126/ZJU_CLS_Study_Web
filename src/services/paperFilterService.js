export const PAPER_UNSPECIFIED = '__unspecified__';

const metadataValue = (value) => String(value ?? '').trim();
const uniqueValues = (values) => [...new Set(values)];

export function paperTeachers(paper) {
  return uniqueValues(metadataValue(paper?.teacher).split(/[/、,，;；|\n\r]+/).map(value => value.trim()).filter(Boolean));
}

export function paperFilterChoices(papers = []) {
  const years = uniqueValues(papers.map(paper => metadataValue(paper.year)).filter(Boolean))
    .sort((a, b) => b.localeCompare(a, 'zh-CN', { numeric: true }));
  const teachers = uniqueValues(papers.flatMap(paperTeachers)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const choices = values => values.map(value => ({ value, label: value }));
  return {
    years: [...choices(years), ...(papers.some(paper => !metadataValue(paper.year)) ? [{ value: PAPER_UNSPECIFIED, label: '未注明' }] : [])],
    teachers: [...choices(teachers), ...(papers.some(paper => !paperTeachers(paper).length) ? [{ value: PAPER_UNSPECIFIED, label: '未注明' }] : [])],
  };
}

export function filterPapers(papers = [], { year = '', teacher = '' } = {}) {
  return papers.filter(paper => {
    const paperYear = metadataValue(paper.year) || PAPER_UNSPECIFIED;
    const teachers = paperTeachers(paper);
    return (!year || year === paperYear)
      && (!teacher || (teacher === PAPER_UNSPECIFIED ? !teachers.length : teachers.includes(teacher)));
  });
}

export function safePaperFileUrl(file) {
  const raw = metadataValue(file?.url);
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    return !url.username && !url.password ? raw : '';
  } catch { return ''; }
}

export function paperDownload(file, origin = globalThis.location?.origin) {
  const safeUrl = safePaperFileUrl(file);
  if (!safeUrl) return null;
  let url = safeUrl.split('#')[0];
  const parsed = new URL(url, origin || 'https://paper.invalid');
  const sameOrigin = url.startsWith('/') || (origin && parsed.origin === origin);
  if (sameOrigin && /^\/(?:zjubio\/)?api\/content\/files\/[^/]+\/?$/.test(parsed.pathname)) {
    parsed.searchParams.set('download', '1');
    url = url.startsWith('/') ? `${parsed.pathname}${parsed.search}` : parsed.href;
  }
  return { url, fileName: metadataValue(file.fileName) || '试卷.pdf' };
}
