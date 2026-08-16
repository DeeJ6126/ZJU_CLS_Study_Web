import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCourseCsv } from '../../src/data/courses/resourceCatalog.js';

const catalogFile = fileURLToPath(new URL('../../public/resource/summary/introduction.csv', import.meta.url));

export function loadServerCourseCatalog(filename = catalogFile) {
  const courses = parseCourseCsv(readFileSync(filename, 'utf8'));
  return {
    courses,
    codes: new Set(courses.map((course) => course.code)),
    byCode: new Map(courses.map((course) => [course.code, course])),
  };
}
