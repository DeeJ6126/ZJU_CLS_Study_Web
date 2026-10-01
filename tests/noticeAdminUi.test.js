import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computed, reactive, ref } from 'vue';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';

import { noticeCategories, noticeCategoryLabel, noticeStatusLabels } from '../src/data/noticeConfig.js';
import { majorOptions } from '../src/data/courses/programCatalog.js';
import { renderCourseMarkdown } from '../src/utils/renderCourseMarkdown.js';

const filename = 'src/components/admin/NoticeAdminPanel.vue';
const source = readFileSync(filename, 'utf8');
const { descriptor } = parse(source, { filename });

// Execute the actual setup script with lifecycle and browser-bound dependencies injected.
const setupSource = descriptor.scriptSetup.content
  .replace(/^import .*?;\s*$/gm, '')
  .replace(/const props = defineProps\([\s\S]*?\n\}\);/, '');
const createSetup = new Function('props', 'window', 'dependencies', `
  const { computed, reactive, ref, noticeCategories, noticeCategoryLabel, noticeStatusLabels,
    majorOptions, renderCourseMarkdown } = dependencies;
  const onMounted = () => {};
  const onBeforeUnmount = () => {};
  const defineExpose = () => {};
  const noticeApiClient = props.apiClient;
  ${setupSource}
  return { form, formElement, editorOpen, currentNotice, setEditor, openEditor, closeEditor,
    inputData, deadlineInput, saveNotice, canLeave, error, feedback, dirty, actionBusy,
    uploadFiles, removeAttachment, archiveNotice, loadItems, beforeUnload, previewBody };
`);

function harness({ isDemo = false, confirm = true, overrides = {} } = {}) {
  const calls = [];
  const confirmations = [];
  let notice = null;
  const apiClient = {
    listAdmin: async () => ({ ok: true, items: notice ? [notice] : [], total: notice ? 1 : 0, page: 1 }),
    create: async (input) => {
      calls.push('create');
      notice = { id: 'n1', status: 'draft', attachments: [], ...input };
      return { ok: true, notice };
    },
    update: async (id, input) => {
      calls.push('update');
      notice = { ...notice, id, ...input };
      return { ok: true, notice };
    },
    publish: async () => {
      calls.push('publish');
      notice = { ...notice, status: 'published' };
      return { ok: true, notice };
    },
    archive: async (id) => {
      calls.push('archive');
      notice = { ...notice, id, status: 'archived' };
      return { ok: true, notice };
    },
    uploadAttachment: async (id, file) => {
      calls.push(`upload:${file.name}`);
      notice = { ...notice, id, attachments: [...notice.attachments, { id: file.name, fileName: file.name }] };
      return { ok: true, notice };
    },
    removeAttachment: async (id, attachmentId) => {
      calls.push('remove');
      notice = { ...notice, id, attachments: notice.attachments.filter((item) => item.id !== attachmentId) };
      return { ok: true, notice };
    },
    ...overrides,
  };
  const panel = createSetup({ apiClient, isDemo }, {
    confirm: (message) => { confirmations.push(message); return confirm; },
  }, { computed, reactive, ref, noticeCategories, noticeCategoryLabel, noticeStatusLabels,
    majorOptions, renderCourseMarkdown });
  panel.formElement.value = { reportValidity: () => true };
  return { panel, calls, confirmations, apiClient };
}

test('notice administrator component compiles and is mounted behind the admin notice navigation', () => {
  compileScript(descriptor, { id: 'notice-admin' });
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'notice-admin' }).errors, []);
  for (const style of descriptor.styles) {
    assert.deepEqual(compileStyle({ source: style.content, filename, id: 'notice-admin', scoped: style.scoped }).errors, []);
  }
  const admin = readFileSync('src/components/admin/AdminPage.vue', 'utf8');
  assert.match(admin, /changeView\('notices'\)/);
  assert.match(admin, /<NoticeAdminPanel v-else-if="selectedView === 'notices'"/);
  assert.match(admin, /noticePanel\.value\?\.canLeave\(\)/);
  assert.match(admin, /'notice\.file\.add': '上传通知附件'/);
  assert.match(source, /ref="fileInput" hidden type="file"/);
});

test('minimal drafts and link-only published notices do not require a markdown body', async () => {
  const { panel, calls } = harness();
  panel.openEditor();
  panel.form.title = 'A notice';
  assert.equal(panel.inputData().body, '');
  await panel.saveNotice();
  assert.equal(panel.currentNotice.value.status, 'draft');
  assert.throws(() => panel.inputData(true), /摘要/);
  panel.form.summary = 'A summary';
  panel.form.sourceUrl = 'https://example.org/notice';
  await panel.saveNotice(true);
  assert.deepEqual(calls, ['create', 'update', 'publish']);
  assert.equal(panel.currentNotice.value.status, 'published');
  assert.equal(panel.dirty.value, false);
});

test('attachment-only notices can save a minimal draft, upload files, and publish', async () => {
  const { panel, calls } = harness();
  panel.openEditor(); panel.form.title = 'Attachment notice'; panel.form.summary = 'Details attached';
  await panel.saveNotice();
  const input = { files: [{ name: 'notice.pdf', size: 120 }], value: 'selected' };
  await panel.uploadFiles({ target: input });
  assert.equal(input.value, '');
  assert.equal(panel.currentNotice.value.attachments.length, 1);
  assert.equal(panel.inputData(true).body, '');
  await panel.saveNotice(true);
  assert.deepEqual(calls, ['create', 'upload:notice.pdf', 'update', 'publish']);
});

test('Shanghai deadline conversion is independent of the host timezone and cohorts are normalized', () => {
  const original = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    const { panel } = harness();
    panel.form.title = 'Notice'; panel.form.deadline = '2026-10-03T18:30';
    panel.form.cohorts = '2024、2025,2024';
    assert.equal(panel.inputData().deadline, '2026-10-03T18:30:00+08:00');
    assert.equal(panel.deadlineInput('2026-10-03T10:30:00.000Z'), '2026-10-03T18:30');
    assert.deepEqual(panel.inputData().cohortYears, [2024, 2025]);
    panel.form.cohorts = '2026年';
    assert.throws(() => panel.inputData(), /四位年份/);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('invalid sources and script-bearing markdown do not become active preview links or HTML', () => {
  const { panel } = harness();
  panel.form.title = 'Notice';
  for (const url of ['javascript:alert(1)', 'https://example.org\\notice', 'https://user:pass@example.org/', 'https://example.org/a b']) {
    panel.form.sourceUrl = url;
    assert.throws(() => panel.inputData(), /原文链接/);
  }
  panel.form.body = '<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))';
  assert.doesNotMatch(panel.previewBody.value, /<script>|href="javascript:/);
  assert.match(panel.previewBody.value, /&lt;script&gt;/);
});

test('publish errors keep the saved record and remain visible after refreshing the list', async () => {
  const { panel, calls } = harness({ overrides: {
    publish: async () => { calls.push('publish'); return { ok: false, message: 'Publish refused' }; },
  } });
  panel.openEditor(); panel.form.title = 'Notice'; panel.form.summary = 'Summary';
  panel.form.body = 'Body';
  await panel.saveNotice(true);
  assert.deepEqual(calls, ['create', 'publish']);
  assert.equal(panel.currentNotice.value.id, 'n1');
  assert.equal(panel.currentNotice.value.status, 'draft');
  assert.equal(panel.error.value, 'Publish refused');
  assert.equal(panel.feedback.value, '通知已保存。');
  assert.equal(panel.dirty.value, false);
});

test('dirty and busy notice editors protect navigation, closing, archiving, and page unload', async () => {
  const { panel, calls } = harness({ confirm: false });
  panel.openEditor(); panel.form.title = 'Unsaved';
  assert.equal(panel.canLeave(), false);
  panel.closeEditor();
  assert.equal(panel.editorOpen.value, true);
  await panel.archiveNotice({ id: 'n1', title: 'Unsaved', status: 'draft' });
  assert.deepEqual(calls, []);
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; } };
  panel.beforeUnload(event);
  assert.equal(prevented, true);
  panel.setEditor({ id: 'n1', title: 'Saved', status: 'draft' });
  panel.actionBusy.value = true;
  assert.equal(panel.canLeave(), false);
  await panel.saveNotice();
  assert.deepEqual(calls, []);
});

test('draft archive and published unpublish use explicit status-appropriate confirmation', async () => {
  const { panel, calls, confirmations } = harness();
  await panel.archiveNotice({ id: 'n1', title: 'Draft', status: 'draft' });
  await panel.archiveNotice({ id: 'n2', title: 'Live', status: 'published' });
  assert.deepEqual(calls, ['archive', 'archive']);
  assert.match(confirmations[0], /归档/);
  assert.match(confirmations[1], /下架/);
});

test('unsupported or oversized attachments do not call the upload API', async () => {
  const { panel, calls } = harness();
  panel.setEditor({ id: 'n1', title: 'Notice', status: 'draft', attachments: [] });
  for (const file of [{ name: 'bad.exe', size: 2 }, { name: 'large.pdf', size: 25 * 1024 * 1024 + 1 }]) {
    await panel.uploadFiles({ target: { files: [file], value: 'selected' } });
    assert.match(panel.error.value, /25 MB/);
  }
  assert.deepEqual(calls, []);
});

test('batch uploads retain successful attachments and report individual failures without losing edits', async () => {
  const { panel, apiClient } = harness();
  panel.openEditor(); panel.form.title = 'Attachments';
  await panel.saveNotice();
  panel.form.body = 'Unsaved body';
  const upload = apiClient.uploadAttachment;
  apiClient.uploadAttachment = async (id, file) => file.name === 'failed.pdf'
    ? { ok: false, message: 'Upload refused' } : upload(id, file);
  await panel.uploadFiles({ target: { files: [
    { name: 'success.pdf', size: 100 }, { name: 'failed.pdf', size: 100 },
  ], value: 'selected' } });
  assert.deepEqual(panel.currentNotice.value.attachments.map((item) => item.fileName), ['success.pdf']);
  assert.match(panel.error.value, /failed\.pdf：Upload refused/);
  assert.equal(panel.feedback.value, '已上传 1 个附件。');
  assert.equal(panel.form.body, 'Unsaved body');
  assert.equal(panel.dirty.value, true);
  assert.equal(panel.actionBusy.value, false);
});

test('confirmed attachment removal updates the live list without resetting unsaved fields', async () => {
  const { panel, calls, confirmations } = harness();
  panel.openEditor(); panel.form.title = 'Attachments';
  await panel.saveNotice();
  await panel.uploadFiles({ target: { files: [{ name: 'notice.pdf', size: 100 }], value: '' } });
  panel.form.body = 'Unsaved body';
  await panel.removeAttachment(panel.currentNotice.value.attachments[0]);
  assert.match(confirmations.at(-1), /notice\.pdf/);
  assert.equal(calls.at(-1), 'remove');
  assert.deepEqual(panel.currentNotice.value.attachments, []);
  assert.equal(panel.form.body, 'Unsaved body');
  assert.equal(panel.dirty.value, true);
});

test('demo administrators cannot read or mutate real notice data', async () => {
  const { panel, calls } = harness({ isDemo: true, overrides: {
    listAdmin: async () => { calls.push('list'); return { ok: true, items: [], total: 0 }; },
  } });
  panel.openEditor();
  assert.equal(panel.editorOpen.value, false);
  panel.setEditor({ id: 'n1', title: 'Notice', status: 'draft', attachments: [] });
  await panel.loadItems(); await panel.saveNotice(true); await panel.archiveNotice(panel.currentNotice.value);
  await panel.uploadFiles({ target: { files: [{ name: 'notice.pdf', size: 100 }], value: '' } });
  await panel.removeAttachment({ id: 'a1', fileName: 'notice.pdf' });
  assert.deepEqual(calls, []);
});
