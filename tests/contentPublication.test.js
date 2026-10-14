import test from 'node:test';
import assert from 'node:assert/strict';
import { formatContentPublicationDate } from '../src/utils/contentPublicationDate.js';
import { renderCourseMarkdown } from '../src/utils/renderCourseMarkdown.js';
import { ubbToHtml } from '../src/utils/ubbParser.js';
import { createContentStore } from '../server/content/contentStore.js';
import { validateContentInput, toPublicContentItem } from '../server/content/contentService.js';
import { exportContentBatch, importContentBatch, previewContentBatch } from '../server/content/contentBatchService.js';

test('publication date uses original source date and Shanghai site creation fallback', () => {
  assert.equal(formatContentPublicationDate({ sourcePublishedDate: '2024-11-06', createdAt: '2026-10-14T00:00:00Z' }), '2024-11-06');
  assert.equal(formatContentPublicationDate({ createdAt: '2026-10-13T20:00:00Z' }), '2026-10-14');
  assert.equal(formatContentPublicationDate({}), '未注明');
});

test('original publication date persists through admin creation updates batch import and export', () => {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  try {
    const input = { courseCode: 'BIO2019F', type: 'material', title: '原帖', body: '正文', sourcePublishedDate: '2024-11-06' };
    assert.equal(validateContentInput({ ...input, sourcePublishedDate: '2024-02-30' }).ok, false);
    const validated = validateContentInput(input);
    assert.equal(validated.ok, true);
    const row = store.createItem(validated.value);
    store.updateItem(row.id, { title: '修改标题' });
    assert.equal(toPublicContentItem(store.findById(row.id)).sourcePublishedDate, '2024-11-06');
    assert.ok(toPublicContentItem(store.findById(row.id)).createdAt);
    const document = { version: 1, items: [input] };
    const preview = previewContentBatch(store, document);
    assert.equal(preview.preview.invalidCount, 0);
    const imported = importContentBatch(store, { document, fingerprint: preview.preview.fingerprint,
      requestId: 'ab52dcbe-5460-4b84-8c69-f2c8e11f9a73' }, { id: 1, role: 'admin', nickname: '测试' });
    assert.equal(imported.ok, true);
    store.setStatus(imported.result.items[0].id, 'published', 1);
    const result = exportContentBatch(store, { courseCodes: ['BIO2019F'], type: 'material' });
    assert.equal(result.document.items[0].sourcePublishedDate, '2024-11-06');
  } finally { store.close(); }
});

test('CC98 forum links get the existing logo while other hosts and code examples do not', () => {
  for (const html of [renderCourseMarkdown('[原帖补充：作者 · 2L](https://www.cc98.org/topic/6028874/1#2)'),
    ubbToHtml('[url=https://www.cc98.org/topic/6028874/1#2][b]原帖补充：作者 · 2L[/b][/url]')]) {
    assert.match(html, /content-cc98-icon/);
    assert.match(html, /6028874\/1#2/);
  }
  assert.doesNotMatch(renderCourseMarkdown('[其他](https://www.cc98.org.evil.test/)'), /content-cc98-icon/);
  assert.doesNotMatch(ubbToHtml('[code][url=https://www.cc98.org/topic/1]原帖[/url][/code]'), /content-cc98-icon/);
  const bare = ubbToHtml('原帖：https://www.cc98.org/topic/123?a=1&b=2');
  assert.match(bare, /content-cc98-icon/);
  assert.match(bare, /href="https:\/\/www.cc98.org\/topic\/123\?a=1&amp;b=2"/);
  assert.equal((ubbToHtml('[url=https://www.cc98.org/topic/123]https://www.cc98.org/topic/123[/url]').match(/<a /g) ?? []).length, 1);
  const legacy = ubbToHtml('[upload=docx,1]http://file.cc98.org/uploadfile/2014/1/4/2052944522.docx[/upload]');
  assert.match(legacy, /点击下载文件/);
  assert.match(legacy, /2052944522.docx/);
});
