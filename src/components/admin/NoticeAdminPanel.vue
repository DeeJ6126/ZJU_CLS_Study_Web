<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { noticeCategories, noticeCategoryLabel, noticeStatusLabels } from '../../data/noticeConfig.js';
import { majorOptions } from '../../data/courses/programCatalog.js';
import { noticeApiClient } from '../../services/noticeApiClient.js';
import { renderCourseMarkdown } from '../../utils/renderCourseMarkdown.js';

const props = defineProps({
  apiClient: { type: Object, default: null },
  isDemo: { type: Boolean, default: false },
});
const client = computed(() => props.apiClient ?? noticeApiClient);
const filters = reactive({ query: '', category: '', status: '' });
const items = ref([]);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const listBusy = ref(false);
const actionBusy = ref(false);
const error = ref('');
const feedback = ref('');
const editorOpen = ref(false);
const currentNotice = ref(null);
const previewOpen = ref(false);
const formElement = ref(null);
const fileInput = ref(null);
const baseline = ref('');
const form = reactive(emptyForm());
const dirty = computed(() => editorOpen.value && JSON.stringify(form) !== baseline.value);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const previewBody = computed(() => renderCourseMarkdown(form.body));
const safeSource = computed(() => externalUrl(form.sourceUrl));
const attachments = computed(() => currentNotice.value?.attachments ?? []);
const status = computed(() => currentNotice.value?.status ?? 'draft');
const majorsText = computed(() => form.majorIds.length
  ? majorOptions.filter((major) => form.majorIds.includes(major.id)).map((major) => major.label).join('、')
  : '全部专业');
let listRequest = 0;
let disposed = false;

function shanghaiDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function emptyForm() {
  return {
    title: '', summary: '', body: '', category: 'general', publisher: '',
    sourceUrl: '', audience: '', majorIds: [], cohorts: '',
    publishedDate: shanghaiDate(), deadline: '', pinned: false,
  };
}

function deadlineInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function formatTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function externalUrl(value) {
  try {
    const text = String(value ?? '').trim();
    if (/[\s\u0000-\u001f\u007f\\]/.test(text)) return '';
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function attachmentUrl(value) {
  const url = String(value ?? '').trim();
  return /^\/(?!\/)/.test(url) ? url : externalUrl(url);
}

function fileSize(size) {
  const bytes = Number(size) || 0;
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function canLeave() {
  if (actionBusy.value) {
    error.value = '操作正在进行，请稍候。';
    return false;
  }
  return !dirty.value || window.confirm('当前通知的修改尚未保存，确定放弃吗？');
}

function setEditor(item = null) {
  currentNotice.value = item;
  Object.assign(form, emptyForm(), item ? {
    title: item.title ?? '', summary: item.summary ?? '', body: item.body ?? '',
    category: item.category ?? 'general', publisher: item.publisher ?? '', sourceUrl: item.sourceUrl ?? '',
    audience: item.audience ?? '', majorIds: [...(item.majorIds ?? [])],
    cohorts: (item.cohortYears ?? []).join('、'), publishedDate: item.publishedDate ?? shanghaiDate(),
    deadline: deadlineInput(item.deadline), pinned: Boolean(item.pinned),
  } : {});
  baseline.value = JSON.stringify(form);
}

function openEditor(item = null) {
  if (props.isDemo || !canLeave()) return;
  error.value = '';
  feedback.value = '';
  previewOpen.value = false;
  setEditor(item);
  editorOpen.value = true;
}

function closeEditor() {
  if (!canLeave()) return;
  editorOpen.value = false;
  setEditor();
  error.value = '';
  feedback.value = '';
}

async function loadItems(nextPage = page.value, preserveError = false) {
  if (props.isDemo || actionBusy.value) return;
  const requestId = ++listRequest;
  listBusy.value = true;
  if (!preserveError) error.value = '';
  try {
    const result = await client.value.listAdmin({ ...filters, query: filters.query.trim(), page: nextPage, pageSize });
    if (disposed || requestId !== listRequest) return;
    if (!result.ok) throw new Error(result.message || '通知列表读取失败。');
    items.value = result.items ?? [];
    total.value = result.total ?? 0;
    page.value = result.page ?? nextPage;
    if (page.value > pageCount.value) {
      await loadItems(pageCount.value, preserveError);
    }
  } catch (failure) {
    if (!disposed && requestId === listRequest) error.value = failure.message || '通知列表读取失败。';
  } finally {
    if (requestId === listRequest) listBusy.value = false;
  }
}

function cohortYears() {
  if (!form.cohorts.trim()) return [];
  const entries = form.cohorts.trim().split(/[,，、;；\s]+/).filter(Boolean);
  if (entries.some((entry) => !/^\d{4}$/.test(entry) || Number(entry) < 1900 || Number(entry) > 2200)) {
    throw new Error('入学年级请填写 1900 至 2200 的四位年份，以逗号分隔。');
  }
  return [...new Set(entries.map(Number))].sort((a, b) => a - b);
}

function inputData(publish = false) {
  if (!formElement.value?.reportValidity()) return null;
  if (!form.title.trim()) throw new Error('请填写通知标题。');
  if ((publish || status.value === 'published') && (!form.summary.trim()
    || (!form.body.trim() && !form.sourceUrl.trim() && !attachments.value.length))) {
    throw new Error('发布通知需要摘要，以及正文、原文链接或附件。');
  }
  if (form.sourceUrl.trim() && !safeSource.value) throw new Error('原文链接仅支持不含账号密码的 http 或 https 地址。');
  if (form.deadline && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.deadline)
    || Number.isNaN(Date.parse(`${form.deadline}:00+08:00`)))) throw new Error('请填写有效的截止时间。');
  return {
    title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(),
    category: form.category, publisher: form.publisher.trim(), sourceUrl: safeSource.value,
    audience: form.audience.trim(), majorIds: [...form.majorIds], cohortYears: cohortYears(),
    publishedDate: form.publishedDate, deadline: form.deadline ? `${form.deadline}:00+08:00` : '',
    pinned: form.pinned,
  };
}

async function saveNotice(publish = false) {
  if (props.isDemo || actionBusy.value) return;
  error.value = '';
  feedback.value = '';
  let input;
  try {
    input = inputData(publish);
    if (!input) return;
  } catch (failure) {
    error.value = failure.message;
    return;
  }
  actionBusy.value = true;
  try {
    const result = currentNotice.value?.id
      ? await client.value.update(currentNotice.value.id, input)
      : await client.value.create(input);
    if (!result.ok || !result.notice?.id) throw new Error(result.message || '通知保存失败。');
    setEditor(result.notice);
    feedback.value = '通知已保存。';
    if (publish) {
      const published = await client.value.publish(result.notice.id);
      if (!published.ok || !published.notice) throw new Error(published.message || '内容已保存，但发布失败，请重试。');
      setEditor(published.notice);
      feedback.value = '通知已发布。';
    }
  } catch (failure) {
    error.value = failure.message || '通知保存失败。';
  } finally {
    actionBusy.value = false;
  }
  await loadItems(page.value, true);
}

async function archiveNotice(item) {
  if (props.isDemo || actionBusy.value) return;
  if (editorOpen.value && dirty.value) {
    error.value = '请先保存或放弃修改，再归档或下架通知。';
    return;
  }
  const action = item.status === 'published' ? '下架' : '归档';
  if (!window.confirm(`确定${action}“${item.title}”吗？${action}后读者将无法查看正文和附件。`)) return;
  error.value = '';
  feedback.value = '';
  actionBusy.value = true;
  try {
    const result = await client.value.archive(item.id);
    if (!result.ok) throw new Error(result.message || `通知${action}失败。`);
    if (currentNotice.value?.id === item.id && result.notice) setEditor(result.notice);
    feedback.value = `通知已${action}。`;
  } catch (failure) {
    error.value = failure.message || `通知${action}失败。`;
  } finally {
    actionBusy.value = false;
  }
  await loadItems(page.value, true);
}

async function uploadFiles(event) {
  const files = Array.from(event.target.files ?? []);
  event.target.value = '';
  if (!files.length || props.isDemo || actionBusy.value || !currentNotice.value?.id) return;
  error.value = '';
  feedback.value = '';
  const invalid = files.find((file) => !/\.(pdf|docx|xlsx)$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024);
  if (invalid) {
    error.value = `“${invalid.name}”无法上传：附件须为 PDF、DOCX 或 XLSX，且每个文件不超过 25 MB。`;
    return;
  }
  const failures = [];
  let completed = 0;
  actionBusy.value = true;
  for (const file of files) {
    try {
      const result = await client.value.uploadAttachment(currentNotice.value.id, file);
      if (!result.ok || !result.notice) throw new Error(result.message || '上传失败');
      currentNotice.value = result.notice;
      completed += 1;
    } catch (failure) {
      failures.push(`${file.name}：${failure.message || '上传失败'}`);
    }
  }
  actionBusy.value = false;
  if (completed) feedback.value = `已上传 ${completed} 个附件。`;
  if (failures.length) error.value = failures.join('；');
  await loadItems(page.value, true);
}

async function removeAttachment(attachment) {
  if (props.isDemo || actionBusy.value || !currentNotice.value?.id
    || !window.confirm(`确定移除附件“${attachment.fileName}”吗？`)) return;
  error.value = '';
  feedback.value = '';
  actionBusy.value = true;
  try {
    const result = await client.value.removeAttachment(currentNotice.value.id, attachment.id);
    if (!result.ok || !result.notice) throw new Error(result.message || '附件移除失败。');
    currentNotice.value = result.notice;
    feedback.value = '附件已移除。';
  } catch (failure) {
    error.value = failure.message || '附件移除失败。';
  } finally {
    actionBusy.value = false;
  }
  await loadItems(page.value, true);
}

function beforeUnload(event) {
  if (!dirty.value && !actionBusy.value) return;
  event.preventDefault();
  event.returnValue = '';
}

defineExpose({ canLeave });
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  loadItems();
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <section class="notice-admin" aria-label="通知管理">
    <p v-if="isDemo" class="notice-admin__message">演示管理员不能维护正式通知。请使用正式管理员账号操作。</p>
    <template v-else>
      <p v-if="error" class="notice-admin__message notice-admin__message--error" role="alert">{{ error }}</p>
      <p v-if="feedback" class="notice-admin__message" role="status">{{ feedback }}</p>

      <section v-if="editorOpen" class="notice-admin__editor" aria-label="通知编辑器" :aria-busy="actionBusy">
        <header class="notice-admin__editor-head">
          <div>
            <span>{{ currentNotice ? '编辑通知' : '新建通知' }} · {{ noticeStatusLabels[status] }}</span>
            <strong>{{ form.title || '新建草稿' }}</strong>
          </div>
          <button type="button" :disabled="actionBusy" @click="closeEditor">返回列表</button>
        </header>
        <form ref="formElement" @submit.prevent="saveNotice()">
          <fieldset class="notice-admin__fields" :disabled="actionBusy">
            <legend class="notice-admin__sr-only">通知内容</legend>
            <label class="notice-admin__wide"><span>标题</span><input v-model="form.title" required maxlength="120"></label>
            <label><span>分类</span><select v-model="form.category"><option v-for="category in noticeCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
            <label><span>发布日期</span><input v-model="form.publishedDate" type="date" required></label>
            <label class="notice-admin__wide"><span>摘要</span><textarea v-model="form.summary" rows="2" maxlength="500"></textarea></label>
            <label><span>发布单位</span><input v-model="form.publisher" maxlength="120"></label>
            <label><span>适用对象</span><input v-model="form.audience" maxlength="200"></label>
            <fieldset class="notice-admin__majors notice-admin__wide">
              <legend>适用专业（不选则为全部专业）</legend>
              <label v-for="major in majorOptions" :key="major.id" class="notice-admin__check"><input v-model="form.majorIds" type="checkbox" :value="major.id"><span>{{ major.label }}</span></label>
            </fieldset>
            <label><span>入学年级（留空则为全部年级）</span><input v-model="form.cohorts" inputmode="numeric" maxlength="100" placeholder="2024, 2025, 2026"></label>
            <label><span>截止时间（北京时间，选填）</span><input v-model="form.deadline" type="datetime-local" step="60"></label>
            <label class="notice-admin__wide"><span>原文链接（选填）</span><input v-model="form.sourceUrl" type="url" maxlength="2000" placeholder="https://"></label>
            <label class="notice-admin__check notice-admin__wide"><input v-model="form.pinned" type="checkbox"><span>置顶</span></label>
            <div class="notice-admin__wide notice-admin__body-toolbar">
              <label for="notice-admin-body">正文</label>
              <div class="notice-admin__tabs" role="tablist" aria-label="正文视图">
                <button id="notice-admin-edit-tab" type="button" role="tab" :aria-selected="!previewOpen" aria-controls="notice-admin-edit-view" :class="{ 'is-active': !previewOpen }" @click="previewOpen = false">编辑</button>
                <button id="notice-admin-preview-tab" type="button" role="tab" :aria-selected="previewOpen" aria-controls="notice-admin-preview-view" :class="{ 'is-active': previewOpen }" @click="previewOpen = true">预览</button>
              </div>
            </div>
            <div v-show="!previewOpen" id="notice-admin-edit-view" class="notice-admin__wide" role="tabpanel" aria-labelledby="notice-admin-edit-tab">
              <textarea id="notice-admin-body" v-model="form.body" rows="16" maxlength="100000" class="notice-admin__body" aria-label="通知正文"></textarea>
            </div>
            <article v-if="previewOpen" id="notice-admin-preview-view" class="notice-admin__preview notice-admin__wide" role="tabpanel" aria-labelledby="notice-admin-preview-tab">
              <div class="notice-admin__preview-meta"><span>{{ noticeCategoryLabel(form.category) }}</span><time :datetime="form.publishedDate">{{ form.publishedDate }}</time><span v-if="form.publisher">{{ form.publisher }}</span><span v-if="form.pinned">置顶</span></div>
              <h2>{{ form.title || '未填写标题' }}</h2>
              <p v-if="form.summary" class="notice-admin__preview-summary">{{ form.summary }}</p>
              <dl class="notice-admin__preview-facts">
                <div><dt>适用专业</dt><dd>{{ majorsText }}</dd></div>
                <div><dt>入学年级</dt><dd>{{ form.cohorts || '全部年级' }}</dd></div>
                <div v-if="form.audience"><dt>适用对象</dt><dd>{{ form.audience }}</dd></div>
                <div v-if="form.deadline"><dt>截止时间</dt><dd>{{ form.deadline.replace('T', ' ') }}（北京时间）</dd></div>
              </dl>
              <div class="notice-admin__markdown" v-html="previewBody"></div>
              <a v-if="safeSource" class="notice-admin__source" :href="safeSource" target="_blank" rel="noopener noreferrer">查看原文</a>
              <ul v-if="attachments.length" class="notice-admin__preview-files"><li v-for="attachment in attachments" :key="attachment.id"><a v-if="attachmentUrl(attachment.url)" :href="attachmentUrl(attachment.url)" target="_blank" rel="noopener noreferrer">{{ attachment.fileName }}</a><span v-else>{{ attachment.fileName }}</span><small>{{ fileSize(attachment.size) }}</small></li></ul>
            </article>
          </fieldset>

          <section class="notice-admin__attachments" aria-labelledby="notice-admin-files-title">
            <div class="notice-admin__attachment-head">
              <h2 id="notice-admin-files-title">附件</h2>
              <button type="button" :disabled="actionBusy || !currentNotice?.id" @click="fileInput?.click()">上传附件</button>
              <input ref="fileInput" hidden type="file" multiple accept=".pdf,.docx,.xlsx" :disabled="actionBusy || !currentNotice?.id" aria-label="选择通知附件" @change="uploadFiles">
            </div>
            <p class="notice-admin__hint">{{ currentNotice?.id ? 'PDF、DOCX、XLSX，每个文件不超过 25 MB。' : '保存草稿后可上传 PDF、DOCX、XLSX，每个文件不超过 25 MB。' }}</p>
            <ul v-if="attachments.length" class="notice-admin__file-list">
              <li v-for="attachment in attachments" :key="attachment.id">
                <div><a v-if="attachmentUrl(attachment.url)" :href="attachmentUrl(attachment.url)" target="_blank" rel="noopener noreferrer">{{ attachment.fileName }}</a><strong v-else>{{ attachment.fileName }}</strong><small>{{ fileSize(attachment.size) }}</small></div>
                <button type="button" :disabled="actionBusy" :aria-label="`移除附件 ${attachment.fileName}`" @click="removeAttachment(attachment)">移除</button>
              </li>
            </ul>
            <p v-else class="notice-admin__hint">暂无附件。</p>
          </section>

          <footer class="notice-admin__actions">
            <span class="notice-admin__save-state">{{ actionBusy ? '正在处理...' : dirty ? '有未保存的修改' : currentNotice ? '修改已保存' : '尚未保存' }}</span>
            <button v-if="currentNotice && status !== 'archived'" class="notice-admin__danger" type="button" :disabled="actionBusy || dirty" @click="archiveNotice(currentNotice)">{{ status === 'published' ? '下架' : '归档' }}</button>
            <button type="submit" :disabled="actionBusy">{{ currentNotice ? '保存修改' : '保存草稿' }}</button>
            <button class="notice-admin__primary" type="button" :disabled="actionBusy" @click="saveNotice(true)">{{ status === 'published' ? '保存并更新发布' : '保存并发布' }}</button>
          </footer>
        </form>
      </section>

      <template v-else>
        <div class="notice-admin__list-head"><span>共 {{ total }} 条通知</span><button class="notice-admin__primary" type="button" :disabled="actionBusy" @click="openEditor()">新建通知</button></div>
        <form class="notice-admin__filters" @submit.prevent="loadItems(1)">
          <label><span>通知搜索</span><input v-model="filters.query" type="search" maxlength="200" placeholder="标题、摘要或发布单位"></label>
          <label><span>分类</span><select v-model="filters.category" @change="loadItems(1)"><option value="">全部分类</option><option v-for="category in noticeCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></label>
          <label><span>状态</span><select v-model="filters.status" @change="loadItems(1)"><option value="">全部状态</option><option v-for="(label, value) in noticeStatusLabels" :key="value" :value="value">{{ label }}</option></select></label>
          <button type="submit" :disabled="listBusy">搜索</button>
        </form>
        <p v-if="listBusy" class="notice-admin__empty" role="status">正在读取通知...</p>
        <p v-else-if="!items.length && !error" class="notice-admin__empty">当前筛选条件下暂无通知。</p>
        <div v-else-if="items.length" class="notice-admin__table" role="table" aria-label="通知列表" :aria-busy="listBusy">
          <div class="notice-admin__table-head" role="row"><span role="columnheader">通知</span><span role="columnheader">状态</span><span role="columnheader">更新时间</span><span role="columnheader">操作</span></div>
          <article v-for="item in items" :key="item.id" class="notice-admin__row" role="row">
            <div role="cell"><strong>{{ item.title }}</strong><small>{{ noticeCategoryLabel(item.category) }} · {{ item.publishedDate }}<template v-if="item.pinned"> · 置顶</template></small><p v-if="item.summary">{{ item.summary }}</p></div>
            <span class="notice-admin__status" :data-status="item.status" role="cell">{{ noticeStatusLabels[item.status] }}</span>
            <time :datetime="item.updatedAt" role="cell">{{ formatTime(item.updatedAt) }}</time>
            <div class="notice-admin__row-actions" role="cell"><button type="button" :disabled="actionBusy" @click="openEditor(item)">编辑</button><button v-if="item.status !== 'archived'" type="button" :disabled="actionBusy" @click="archiveNotice(item)">{{ item.status === 'published' ? '下架' : '归档' }}</button></div>
          </article>
        </div>
        <nav v-if="total > pageSize" class="notice-admin__pagination" aria-label="通知分页"><button type="button" :disabled="listBusy || page <= 1" @click="loadItems(page - 1)">上一页</button><span>第 {{ page }} / {{ pageCount }} 页</span><button type="button" :disabled="listBusy || page >= pageCount" @click="loadItems(page + 1)">下一页</button></nav>
      </template>
    </template>
  </section>
</template>

<style scoped>
.notice-admin { min-width: 0; color: var(--color-ink); }
.notice-admin button { min-height: 38px; padding: 7px 14px; border: 1px solid var(--color-line); border-radius: 4px; color: var(--color-ink); background: var(--color-surface); font-weight: 750; cursor: pointer; }
.notice-admin button:hover:not(:disabled) { border-color: var(--admin-primary); background: var(--color-soft); }
.notice-admin button:disabled { opacity: .55; cursor: not-allowed; }
.notice-admin .notice-admin__primary { color: var(--detail-action-text); border-color: var(--admin-primary); background: var(--admin-primary); }
.notice-admin .notice-admin__primary:hover:not(:disabled) { background: var(--color-primary-strong); }
.notice-admin .notice-admin__danger { color: var(--color-negative); border-color: var(--color-negative); }
.notice-admin input:not([type="checkbox"]), .notice-admin select, .notice-admin textarea { width: 100%; min-width: 0; min-height: 42px; padding: 9px 11px; border: 1px solid var(--color-input-border); border-radius: 4px; color: var(--color-ink); background: var(--color-input); box-sizing: border-box; }
.notice-admin input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: var(--admin-primary); flex: 0 0 16px; }
.notice-admin input:focus-visible, .notice-admin select:focus-visible, .notice-admin textarea:focus-visible, .notice-admin button:focus-visible, .notice-admin a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
.notice-admin textarea { resize: vertical; line-height: 1.7; }
.notice-admin label { min-width: 0; display: grid; gap: 7px; font-size: 14px; font-weight: 700; }
.notice-admin a { color: var(--detail-link); overflow-wrap: anywhere; }
.notice-admin__message { margin: 16px 0; padding: 10px 12px; border-left: 3px solid var(--admin-primary); background: var(--admin-primary-soft); overflow-wrap: anywhere; }
.notice-admin__message--error { border-left-color: var(--color-negative); color: var(--color-negative); background: var(--color-negative-soft); }
.notice-admin__list-head, .notice-admin__editor-head, .notice-admin__attachment-head, .notice-admin__body-toolbar, .notice-admin__actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.notice-admin__list-head { margin-top: 20px; }
.notice-admin__list-head > span, .notice-admin__hint, .notice-admin__save-state { color: var(--color-muted); font-size: 13px; }
.notice-admin__filters { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(120px, 165px) minmax(120px, 140px) auto; align-items: end; gap: 14px; padding: 20px 0; }
.notice-admin__filters > button { min-height: 42px; }
.notice-admin__empty { padding: 32px 0; color: var(--color-muted); text-align: center; }
.notice-admin__table { border-top: 2px solid var(--admin-primary); }
.notice-admin__table-head, .notice-admin__row { display: grid; grid-template-columns: minmax(0, 1fr) 76px 104px 140px; align-items: center; gap: 16px; padding: 12px 10px; }
.notice-admin__table-head { color: var(--color-muted); background: var(--color-soft); font-size: 13px; font-weight: 700; }
.notice-admin__row { min-height: 76px; border-bottom: 1px solid var(--color-line); }
.notice-admin__row > div:first-child { min-width: 0; overflow-wrap: anywhere; }
.notice-admin__row strong, .notice-admin__row small { display: block; }
.notice-admin__row small, .notice-admin__row time { color: var(--color-muted); font-size: 12px; }
.notice-admin__row small { margin-top: 5px; }
.notice-admin__row p { margin: 6px 0 0; color: var(--color-muted); font-size: 13px; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.notice-admin__row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.notice-admin__row-actions button { padding-inline: 12px; }
.notice-admin__status { width: fit-content; padding: 4px 7px; border-radius: 2px; font-size: 12px; font-weight: 700; color: var(--color-muted); background: var(--color-soft); }
.notice-admin__status[data-status="published"] { color: var(--color-positive); background: var(--color-positive-soft); }
.notice-admin__pagination { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding-top: 20px; font-size: 13px; }
.notice-admin__editor { padding-top: 20px; }
.notice-admin__editor-head { padding-bottom: 18px; border-bottom: 1px solid var(--color-line); }
.notice-admin__editor-head > div { min-width: 0; }
.notice-admin__editor-head strong { display: block; margin-top: 5px; overflow-wrap: anywhere; font-size: 18px; }
.notice-admin__editor-head span { color: var(--color-muted); font-size: 12px; }
.notice-admin__editor-head > button { flex-shrink: 0; }
.notice-admin__fields { margin: 0; padding: 20px 0; border: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; min-width: 0; }
.notice-admin__wide { grid-column: 1 / -1; min-width: 0; }
.notice-admin__majors { display: flex; flex-wrap: wrap; gap: 14px 22px; padding: 12px 0 0; border: 0; margin: 0; }
.notice-admin__majors legend { padding: 0; font-size: 14px; font-weight: 700; }
.notice-admin .notice-admin__check { display: flex; align-items: center; gap: 8px; font-weight: 400; line-height: 1.5; }
.notice-admin__body-toolbar > label { font-weight: 700; }
.notice-admin__tabs { display: flex; }
.notice-admin__tabs button { border-radius: 0; min-width: 70px; }
.notice-admin__tabs button + button { border-left: 0; }
.notice-admin__tabs button.is-active { background: var(--admin-primary-soft); color: var(--admin-primary); }
.notice-admin__body { min-height: 320px; font-family: var(--font-body); }
.notice-admin__preview { padding: 24px; border: 1px solid var(--color-line); min-height: 320px; background: var(--color-surface); }
.notice-admin__preview-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--color-muted); font-size: 12px; }
.notice-admin__preview h2 { font-size: 24px; font-family: var(--font-heading); line-height: 1.5; margin: 12px 0; overflow-wrap: anywhere; }
.notice-admin__preview-summary { line-height: 1.8; color: var(--color-muted); overflow-wrap: anywhere; }
.notice-admin__preview-facts { margin: 18px 0; padding: 12px 0; border-block: 1px solid var(--color-line); display: grid; gap: 7px; font-size: 13px; }
.notice-admin__preview-facts > div { display: flex; gap: 12px; }
.notice-admin__preview-facts dt { flex: 0 0 56px; color: var(--color-muted); }
.notice-admin__preview-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.notice-admin__markdown { font-size: 15px; line-height: 1.85; overflow-wrap: anywhere; }
.notice-admin__markdown :deep(img) { max-width: 100%; height: auto; }
.notice-admin__markdown :deep(h1), .notice-admin__markdown :deep(h2), .notice-admin__markdown :deep(h3) { font-size: 20px; line-height: 1.6; margin: 18px 0 10px; }
.notice-admin__markdown :deep(pre) { max-width: 100%; overflow: auto; padding: 12px; background: var(--color-soft); font-size: 13px; }
.notice-admin__markdown :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.notice-admin__markdown :deep(th), .notice-admin__markdown :deep(td) { border: 1px solid var(--color-line); padding: 6px 10px; }
.notice-admin__markdown :deep(blockquote) { margin-inline: 0; padding-left: 16px; border-left: 3px solid var(--color-line); color: var(--color-muted); }
.notice-admin__markdown :deep(a) { color: var(--detail-link); }
.notice-admin__source { display: inline-block; margin-top: 12px; }
.notice-admin__preview-files { padding-left: 20px; margin: 16px 0 0; }
.notice-admin__preview-files li { margin-top: 8px; overflow-wrap: anywhere; }
.notice-admin__preview-files small { margin-left: 10px; color: var(--color-muted); }
.notice-admin__attachments { padding: 18px 0; border-top: 1px solid var(--color-line); }
.notice-admin__attachment-head { justify-content: flex-start; }
.notice-admin__attachment-head h2 { margin: 0 auto 0 0; font-size: 16px; }
.notice-admin__hint { margin: 10px 0 0; line-height: 1.7; }
.notice-admin__file-list { list-style: none; padding: 0; margin: 14px 0 0; }
.notice-admin__file-list li { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-line); }
.notice-admin__file-list li > div { min-width: 0; flex: 1; }
.notice-admin__file-list a, .notice-admin__file-list strong { overflow-wrap: anywhere; font-size: 14px; }
.notice-admin__file-list small { display: block; margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.notice-admin__actions { flex-wrap: wrap; justify-content: flex-end; padding: 18px 0; border-top: 1px solid var(--color-line); }
.notice-admin__save-state { margin-right: auto; }
.notice-admin__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 1000px) {
  .notice-admin__filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .notice-admin__row, .notice-admin__table-head { grid-template-columns: minmax(0, 1fr) 76px 124px; }
  .notice-admin__row time, .notice-admin__table-head > span:nth-child(3) { display: none; }
}
@media (max-width: 620px) {
  .notice-admin__fields, .notice-admin__filters { grid-template-columns: minmax(0, 1fr); }
  .notice-admin__wide { grid-column: 1; }
  .notice-admin__table-head { display: none; }
  .notice-admin__row { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding-inline: 0; }
  .notice-admin__row-actions { grid-column: 1 / -1; }
  .notice-admin__preview { padding: 16px; }
  .notice-admin__preview h2 { font-size: 20px; }
  .notice-admin__editor-head { align-items: flex-start; }
  .notice-admin__save-state { flex-basis: 100%; }
  .notice-admin__actions button { flex: 1 1 auto; }
  .notice-admin__pagination { justify-content: center; gap: 8px; }
}
</style>
