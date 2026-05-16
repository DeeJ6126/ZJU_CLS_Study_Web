import { buildResourceSections, getCourseByCode, parseCourseCsv } from './resourceCatalog.js';
import { publicAssetPath } from '../utils/publicPath.js';
export { programOptions, resourceProgramMeta } from './resourceCatalog.js';

const resourceSummaryUrl = '/resource/summary/introduction.csv';
let catalogCache = null;

export async function loadResourceCatalog() {
  if (catalogCache) {
    return catalogCache;
  }

  const response = await fetch(publicAssetPath(resourceSummaryUrl));

  if (!response.ok) {
    throw new Error(`Failed to load resource catalog: ${resourceSummaryUrl}`);
  }

  const csvText = await response.text();
  const courses = parseCourseCsv(csvText);
  const sections = buildResourceSections(courses);
  catalogCache = { courses, sections };
  return catalogCache;
}

export async function getResourceCourseByCode(courseCode) {
  const catalog = await loadResourceCatalog();
  return getCourseByCode(catalog.courses, courseCode);
}
