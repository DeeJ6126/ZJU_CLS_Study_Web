import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPER_UNSPECIFIED, filterPapers, paperDownload, paperFilterChoices, paperTeachers, safePaperFileUrl } from '../src/services/paperFilterService.js';

const papers = [
  { id: 'a', year: '2025-2026', teacher: '李老师/赵老师', sourcePublishedDate: '2026-01-01' },
  { id: 'b', year: '2024-2025', teacher: '赵老师、其他讲师' },
  { id: 'c', year: '', teacher: '', sourcePublishedDate: '2020-01-01', title: '2019 年回忆卷' },
];

test('paper choices use actual paper metadata, with descending years and unspecified values', () => {
  assert.deepEqual(paperFilterChoices(papers).years, [
    { value: '2025-2026', label: '2025-2026' }, { value: '2024-2025', label: '2024-2025' },
    { value: PAPER_UNSPECIFIED, label: '未注明' },
  ]);
  assert.deepEqual(new Set(paperFilterChoices(papers).teachers.map(choice => choice.value)), new Set(['李老师', '赵老师', '其他讲师', PAPER_UNSPECIFIED]));
  assert.deepEqual(paperFilterChoices([]), { years: [], teachers: [] });
});

test('paper filters combine year and exact teacher membership without mutating the collection', () => {
  assert.deepEqual(filterPapers(papers, { year: '2025-2026', teacher: '赵老师' }).map(paper => paper.id), ['a']);
  assert.deepEqual(filterPapers(papers, { teacher: '赵老师' }).map(paper => paper.id), ['a', 'b']);
  assert.deepEqual(filterPapers(papers, { year: '2024-2025', teacher: '李老师' }), []);
  assert.deepEqual(filterPapers(papers, { year: PAPER_UNSPECIFIED, teacher: PAPER_UNSPECIFIED }).map(paper => paper.id), ['c']);
  assert.deepEqual(filterPapers(papers, { teacher: '李' }), []);
  assert.equal(filterPapers(papers).length, 3);
  assert.equal(papers.length, 3);
});

test('teacher metadata accepts explicit separators and freely entered names without splitting spaces', () => {
  assert.deepEqual(paperTeachers({ teacher: ' 李老师 / 李老师，Zhang Wei；客座讲师\n赵老师|另一老师' }), ['李老师', 'Zhang Wei', '客座讲师', '赵老师', '另一老师']);
});

test('same-origin content downloads request attachment disposition and preserve filenames', () => {
  assert.deepEqual(paperDownload({ url: '/zjubio/api/content/files/paper-a?x=1#page=2', fileName: '2025 回忆卷.pdf' }), { url: '/zjubio/api/content/files/paper-a?x=1&download=1', fileName: '2025 回忆卷.pdf' });
  assert.deepEqual(paperDownload({ url: 'https://site.test/zjubio/api/content/files/a?download=0', fileName: 'a.pdf' }, 'https://site.test'), { url: 'https://site.test/zjubio/api/content/files/a?download=1', fileName: 'a.pdf' });
  assert.deepEqual(paperDownload({ url: '/zjubio/resource/exam.pdf#view=FitH' }), { url: '/zjubio/resource/exam.pdf', fileName: '试卷.pdf' });
});

test('external HTTP(S) PDFs keep their original address and unsafe URLs provide no action', () => {
  assert.equal(paperDownload({ url: 'https://files.test/api/content/files/a?token=abc', fileName: 'external.pdf' }, 'https://site.test').url, 'https://files.test/api/content/files/a?token=abc');
  for (const url of ['javascript:alert(1)', 'data:application/pdf;base64,AA==', '//files.test/a.pdf', 'https://user:password@files.test/a.pdf', '/\\files.test/a.pdf', 'https://files.test/a\nb.pdf']) {
    assert.equal(paperDownload({ url }), null);
    assert.equal(safePaperFileUrl({ url }), '');
  }
  assert.equal(paperDownload(null), null);
});
