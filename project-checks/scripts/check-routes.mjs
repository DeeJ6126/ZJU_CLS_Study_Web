import { parseCourseCsv } from '../../src/data/courses/resourceCatalog.js';
import { buildCourseRoute, parseResourceHash } from '../../src/data/courses/resourcePaths.js';
import { createResult, isDirectRun, printCliResult, readJson, readText } from './lib.mjs';

export async function checkRoutes({ rootDir = process.cwd() } = {}) {
  const policy = await readJson(rootDir, 'project-checks/policies/route-contracts.json');
  const csvText = await readText(rootDir, policy.courseCodeSource);
  const courses = parseCourseCsv(csvText).filter((course) => course.code);
  const failures = [];
  const seenCodes = new Set();

  for (const course of courses) {
    if (seenCodes.has(course.code)) {
      failures.push({
        file: policy.courseCodeSource,
        message: `Duplicate course code: ${course.code}`,
        suggestion: 'Course code is the route identity and must be unique.',
      });
      continue;
    }

    seenCodes.add(course.code);
    const route = buildCourseRoute(course.code);
    const expectedRoute = policy.courseRoutePattern.replace('{courseCode}', course.code);
    const parsed = parseResourceHash(route);

    if (route !== expectedRoute) {
      failures.push({
        file: 'src/data/courses/resourcePaths.js',
        message: `Route for ${course.code} is ${route}, expected ${expectedRoute}.`,
        suggestion: policy.suggestion,
      });
    }

    if (parsed.section !== policy.resourceRoot || parsed.courseCode !== course.code) {
      failures.push({
        file: 'src/data/courses/resourcePaths.js',
        message: `Route parser failed for ${route}.`,
        suggestion: 'Keep parseResourceHash aligned with buildCourseRoute.',
      });
    }
  }

  return createResult({
    name: 'routes',
    command: 'npm run check:routes',
    ok: failures.length === 0,
    checked: {
      courseCount: courses.length,
      sampleRoute: courses[0] ? buildCourseRoute(courses[0].code) : '',
    },
    failures,
    suggestions: failures.length ? [policy.suggestion] : [],
  });
}

if (isDirectRun(import.meta.url)) {
  checkRoutes().then(printCliResult).catch((error) => {
    printCliResult(createResult({
      name: 'routes',
      command: 'npm run check:routes',
      ok: false,
      failures: [{ message: error.message }],
      suggestions: ['Check route policy and course CSV availability.'],
    }));
  });
}

