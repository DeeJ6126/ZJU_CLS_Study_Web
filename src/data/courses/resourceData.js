import { buildResourceSections, filterSiteCourses, getCourseByCode, parseCourseCsv } from './resourceCatalog.js';
import { publicAssetPath } from '../../utils/publicPath.js';
export { programOptions, resourceProgramMeta } from './resourceCatalog.js';

const resourceSummaryUrl = '/resource/summary/introduction.csv';
let catalogCache = null;
let fullCatalogCache = null;

export async function loadResourceCatalog() {
  if (catalogCache) {
    return catalogCache;
  }

  const response = await fetch(publicAssetPath(resourceSummaryUrl));

  if (!response.ok) {
    throw new Error(`Failed to load resource catalog: ${resourceSummaryUrl}`);
  }

  const csvText = await response.text();
  fullCatalogCache = parseCourseCsv(csvText);
  const courses = filterSiteCourses(fullCatalogCache);
  const sections = buildResourceSections(courses);
  catalogCache = { courses, sections };
  return catalogCache;
}

export async function loadCoursePickerCatalog() {
  if (!fullCatalogCache) await loadResourceCatalog();
  return fullCatalogCache;
}

export async function getResourceCourseByCode(courseCode) {
  const catalog = await loadResourceCatalog();
  return getCourseByCode(catalog.courses, courseCode);
}
