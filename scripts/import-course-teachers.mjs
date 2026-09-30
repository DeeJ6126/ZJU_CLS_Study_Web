import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { filterSiteCourses, parseCourseCsv } from '../src/data/courses/resourceCatalog.js';

const courseAliases = {
  BIO2110F: '微生物学及实验（甲）',
  BIO2113F: '微生物学及实验（甲）',
  CAB2001F: '生物统计学与试验设计',
};

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
}

export function buildCourseTeacherCatalog(rows, courses, source) {
  const sourceByName = new Map();
  for (const row of rows) {
    const courseName = String(row.courseName ?? '').trim();
    const teacher = String(row.teacherName ?? '').trim();
    if (!courseName || !teacher) continue;
    const key = normalizeName(courseName);
    const entry = sourceByName.get(key) ?? { names: new Set(), teachers: new Set() };
    entry.names.add(courseName);
    entry.teachers.add(teacher);
    sourceByName.set(key, entry);
  }

  const teachersByCourse = {};
  const matchedSourceNames = {};
  const unmatchedCourses = [];
  for (const course of courses) {
    const name = courseAliases[course.code] ?? course.name;
    const match = sourceByName.get(normalizeName(name));
    if (!match) {
      unmatchedCourses.push({ code: course.code, name: course.name });
      continue;
    }
    teachersByCourse[course.code] = [...match.teachers].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    matchedSourceNames[course.code] = [...match.names].sort();
  }
  return {
    version: 1,
    source,
    totalCourses: courses.length,
    matchedCourses: Object.keys(teachersByCourse).length,
    teachersByCourse,
    matchedSourceNames,
    unmatchedCourses,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const argument = (name) => args[args.indexOf(name) + 1];
  if (!args.includes('--database') || !args.includes('--output')) {
    throw new Error('Usage: node scripts/import-course-teachers.mjs --database SOURCE.db --output CATALOG.json');
  }
  const db = new DatabaseSync(argument('--database'), { readOnly: true });
  try {
    const rows = db.prepare('select course_name as courseName, teacher_name as teacherName from courses').all();
    const csvPath = fileURLToPath(new URL('../public/resource/summary/introduction.csv', import.meta.url));
    const courses = filterSiteCourses(parseCourseCsv(readFileSync(csvPath, 'utf8')));
    const catalog = buildCourseTeacherCatalog(rows, courses, {
      repository: 'https://github.com/Lvshujun0918/chalaoshi',
      revision: '9a1d3be5136fa86d298baee6b19599c429a1eea7',
      dataReleaseDate: '2026-01-11',
      path: 'backend/data/chalaoshi.db',
    });
    writeFileSync(argument('--output'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ matched: catalog.matchedCourses, total: catalog.totalCourses, unmatched: catalog.unmatchedCourses }));
  } finally {
    db.close();
  }
}
