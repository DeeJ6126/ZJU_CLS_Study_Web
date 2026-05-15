import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCourseRoute,
  buildResourceRoute,
  courseMaterialPaths,
  parseResourceHash,
} from '../src/data/resourcePaths.js';

test('resource route helpers keep course URLs under the resources route', () => {
  assert.equal(buildResourceRoute(), '#resources');
  assert.equal(buildCourseRoute('BIO2110F'), '#resources/#BIO2110F');
  assert.equal(buildCourseRoute('BIO2110F', 'materials', '1'), '#resources/#BIO2110F/#materials/#1');
});

test('resource hash parser reads course, tab, and item route parts', () => {
  assert.deepEqual(parseResourceHash('#resources/#BIO2110F/#papers/#1'), {
    section: 'resources',
    courseCode: 'BIO2110F',
    tabId: 'papers',
    itemId: '1',
  });
});

test('course material paths are centralized for migration', () => {
  assert.equal(
    courseMaterialPaths.BIO2110F.papers,
    '/resource/courses/basic/BIO2110F_microbiology-a/papers',
  );
  assert.equal(courseMaterialPaths.BIO2110F.paperFiles.midtermLu.fileName, '25-26-midterm-lv.pdf');
});
