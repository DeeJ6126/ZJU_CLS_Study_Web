import test from 'node:test';
import assert from 'node:assert/strict';
import { courseTeacherNames, filterTeacherSuggestions, searchTeacherNames } from '../src/services/teacherSuggestionService.js';

test('teacher suggestions match only the prefix and deduplicate names', () => {
  assert.deepEqual(filterTeacherSuggestions(['陈景华', '方陈', '陈璨', '陈璨'], '陈'), ['陈璨', '陈景华']);
  assert.deepEqual(filterTeacherSuggestions(['陈景华', '陈璨'], '陈景'), ['陈景华']);
  assert.deepEqual(filterTeacherSuggestions(['陈景华'], '名单外老师'), []);
});

test('course search limits names to matching courses and leaves unknown courses empty', () => {
  const courses = [{ code: 'BIO2110F', name: '微生物学（甲）' }, { code: 'BIO2113F', name: '微生物学实验' }];
  const names = courseTeacherNames('BIO2110F');
  assert.deepEqual(searchTeacherNames('BIO2110F', courses), names.slice().sort((a, b) => a.localeCompare(b, 'zh-CN')));
  assert.deepEqual(searchTeacherNames('微生物学', courses), searchTeacherNames('ＢＩＯ２１１０Ｆ', courses));
  assert.deepEqual(searchTeacherNames('不存在', courses), []);
  assert.ok(searchTeacherNames('', courses).length > names.length);
  assert.deepEqual(courseTeacherNames('BIO2114M'), []);
});
