import { buildCourseRoute } from '../data/courses/resourcePaths.js';
import { bodyToParagraphs, parseMarkdownDocument } from '../utils/markdownContent.js';
import { publicAssetPath } from '../utils/publicPath.js';
import { createRawClient } from './apiClient.js';

const tabByType = {
  experience: 'experiences',
  material: 'materials',
  paper: 'papers',
};

function emptyCollections(source) {
  return { source, experiences: [], materials: [], papers: [] };
}

function normalizeItem(item, courseCode, tabId) {
  const routeId = String(item.routeId || item.id);
  return {
    ...item,
    contentId: String(item.id),
    id: routeId,
    href: buildCourseRoute(courseCode, tabId, routeId),
    paragraphs: bodyToParagraphs(item.body),
    file: item.file ? {
      ...item.file,
      url: publicAssetPath(item.file.url),
    } : null,
  };
}

async function loadFromApi(courseCode, fetchRaw) {
  const response = await fetchRaw(`api/content/courses/${encodeURIComponent(courseCode)}`);
  if (!response || !response.ok) {
    throw new Error('Course content API unavailable');
  }
  const data = await response.json();
  const collections = emptyCollections('api');
  for (const item of data.items ?? []) {
    const tabId = tabByType[item.type];
    if (tabId) {
      collections[tabId].push(normalizeItem(item, courseCode, tabId));
    }
  }
  return collections;
}

async function loadStaticCollection(course, tabId, fetchRaw) {
  return Promise.all((course[tabId] ?? []).map(async (sourceItem) => {
    const response = await fetchRaw(publicAssetPath(sourceItem.url));
    if (!response || !response.ok) {
      throw new Error(`Static content unavailable: ${sourceItem.url}`);
    }
    const document = parseMarkdownDocument(await response.text());
    const item = {
      ...sourceItem,
      ...document.frontmatter,
      id: String(document.frontmatter.id || sourceItem.id),
      body: document.body,
      file: document.frontmatter.fileUrl ? {
        url: document.frontmatter.fileUrl,
        fileName: document.frontmatter.fileName,
      } : null,
    };
    return normalizeItem(item, course.code, tabId);
  }));
}

export async function loadCourseContent(course, { fetchImpl = fetch } = {}) {
  const { fetchRaw } = createRawClient({ name: 'course-content', fetchImpl });
  try {
    return await loadFromApi(course.code, fetchRaw);
  } catch {
    const collections = emptyCollections('static');
    for (const tabId of ['experiences', 'materials', 'papers']) {
      collections[tabId] = await loadStaticCollection(course, tabId, fetchRaw);
    }
    return collections;
  }
}
