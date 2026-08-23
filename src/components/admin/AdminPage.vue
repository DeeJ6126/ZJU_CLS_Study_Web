<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

import {
  fetchCurrentUser,
  loginCc98Account,
  logoutAccount,
  registerCc98Account,
} from '../../services/authApiClient.js';
import { adminApiClient as defaultAdminApiClient } from '../../services/adminApiClient.js';
import { isAdministrator } from '../../services/authService.js';
import { loadResourceCatalog } from '../../data/courses/resourceData.js';

const props = defineProps({
  initialUser: { type: Object, default: null },
  apiClient: { type: Object, default: null },
  isDemo: { type: Boolean, default: false },
});
const activeApiClient = computed(() => props.apiClient ?? defaultAdminApiClient);

const contentTypes = [
  { id: 'experience', label: '学习心得' },
  { id: 'material', label: '复习资料' },
  { id: 'paper', label: '历年试卷' },
];
const statusOptions = [
  { id: '', label: '全部状态' },
  { id: 'draft', label: '草稿' },
  { id: 'published', label: '已发布' },
  { id: 'archived', label: '已下架' },
];
const statusLabels = { draft: '草稿', published: '已发布', archived: '已下架' };
const submissionStatusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
const auditActionLabels = {
  'content.create': '新建内容', 'content.update': '编辑内容', 'content.publish': '发布内容',
  'content.archive': '下架内容', 'content.file.upload': '上传文件', 'content.file.remove': '移除文件',
  'submission.update': '编辑投稿', 'submission.approve': '通过投稿', 'submission.reject': '拒绝投稿',
};

const currentUser = ref(null);
const authMode = ref('login');
const authBusy = ref(false);
const authNotice = ref('');
const credentials = reactive({ code: '', cc98Name: '', password: '' });
const courses = ref([]);
const selectedCourseCode = ref('BIO2110F');
const selectedType = ref('experience');
const selectedStatus = ref('');
const selectedView = ref('content');
const contentQuery = ref('');
const items = ref([]);
const submissions = ref([]);
const pendingCount = ref(0);
const submissionStatus = ref('pending');
const submissionQuery = ref('');
const submissionEditorOpen = ref(false);
const editingSubmissionId = ref('');
const submissionForm = reactive(emptyForm());
const rejectionNote = ref('');
const auditLogs = ref([]);
const auditAction = ref('');
const auditQuery = ref('');
const listBusy = ref(false);
const actionBusy = ref(false);
const notice = ref('');
const editorOpen = ref(false);
const editingId = ref('');
const dirty = ref(false);
const pendingFile = ref(null);
const fileInput = ref(null);
const form = reactive(emptyForm());

const isAdmin = computed(() => isAdministrator(currentUser.value));
const editingItem = computed(() => items.value.find((item) => item.id === editingId.value) ?? null);
const selectedTypeLabel = computed(() => contentTypes.find((type) => type.id === selectedType.value)?.label ?? '内容');
const filteredItems = computed(() => {
  const query = contentQuery.value.trim().toLowerCase();
  if (!query) return items.value;
  return items.value.filter((item) => [item.title, item.summary, item.author]
    .some((value) => String(value ?? '').toLowerCase().includes(query)));
});
const pageTitle = computed(() => {
  if (selectedView.value === 'submissions') return '投稿审核';
  if (selectedView.value === 'logs') return '操作日志';
  return selectedTypeLabel.value;
});

function mutationNotice(result, successMessage) {
  return result.ok ? (result.persistenceWarning || successMessage) : result.message;
}

function emptyForm() {
  return {
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '',
    summary: '',
    author: '',
    body: '',
    externalUrl: '',
    cc98Url: '',
    gpa: '',
    year: '',
    teacher: '',
  };
}

function setForm(input = {}) {
  Object.assign(form, emptyForm(), input, {
    courseCode: input.courseCode ?? selectedCourseCode.value,
    type: input.type ?? selectedType.value,
  });
  pendingFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  dirty.value = false;
}

async function loadCourses() {
  try {
    const catalog = await loadResourceCatalog();
    courses.value = catalog.courses;
    if (!catalog.courses.some((course) => course.code === selectedCourseCode.value)) {
      selectedCourseCode.value = catalog.courses[0]?.code ?? '';
    }
  } catch {
    notice.value = '课程目录加载失败。';
  }
}

async function refreshItems() {
  if (!isAdmin.value || !selectedCourseCode.value) {
    return;
  }
  listBusy.value = true;
  const result = await activeApiClient.value.fetchContent({
    courseCode: selectedCourseCode.value,
    type: selectedType.value,
    status: selectedStatus.value,
  });
  if (result.ok) {
    items.value = result.items ?? [];
  } else {
    notice.value = result.message;
  }
  listBusy.value = false;
}

async function refreshSubmissions() {
  if (!isAdmin.value) return;
  listBusy.value = true;
  const result = await activeApiClient.value.fetchSubmissions({
    courseCode: selectedCourseCode.value,
    status: submissionStatus.value,
    query: submissionQuery.value,
  });
  if (result.ok) {
    submissions.value = result.submissions ?? [];
    pendingCount.value = result.pendingCount ?? 0;
  }
  else notice.value = result.message;
  listBusy.value = false;
}

async function refreshAuditLogs() {
  if (!isAdmin.value) return;
  listBusy.value = true;
  const result = await activeApiClient.value.fetchAuditLogs({
    courseCode: selectedCourseCode.value,
    action: auditAction.value,
    query: auditQuery.value,
  });
  if (result.ok) auditLogs.value = result.logs ?? [];
  else notice.value = result.message;
  listBusy.value = false;
}

async function initialize() {
  await loadCourses();
  if (props.initialUser) {
    currentUser.value = props.initialUser;
    await Promise.all([refreshItems(), refreshSubmissions()]);
    return;
  }
  try {
    const result = await fetchCurrentUser();
    currentUser.value = result.ok ? result.user : null;
    if (isAdmin.value) {
      await Promise.all([refreshItems(), refreshSubmissions()]);
    }
  } catch {
    currentUser.value = null;
    authNotice.value = '管理服务暂时无法连接。';
  }
}

async function submitAuth() {
  authBusy.value = true;
  authNotice.value = '';
  try {
    let result;
    if (authMode.value === 'register') {
      result = await registerCc98Account({ code: credentials.code, password: credentials.password });
      if (result.ok) {
        result = await loginCc98Account({
          cc98Name: result.user.cc98Nickname,
          password: credentials.password,
        });
      }
    } else {
      result = await loginCc98Account({
        cc98Name: credentials.cc98Name,
        password: credentials.password,
      });
    }

    if (!result.ok) {
      authNotice.value = result.message;
    } else {
      currentUser.value = result.user;
      if (!isAdministrator(result.user)) {
        authNotice.value = '该账号已登录，但没有管理权限。';
      } else {
        credentials.password = '';
        await refreshItems();
        await refreshSubmissions();
      }
    }
  } catch {
    authNotice.value = '管理服务暂时无法连接。';
  } finally {
    authBusy.value = false;
  }
}

function changeView(view, type = '') {
  if (dirty.value && !window.confirm('当前修改尚未保存，确定放弃吗？')) return;
  selectedView.value = view;
  editorOpen.value = false;
  submissionEditorOpen.value = false;
  if (type) selectedType.value = type;
  if (view === 'content' && !selectedCourseCode.value) {
    selectedCourseCode.value = courses.value[0]?.code ?? 'BIO2110F';
  }
  notice.value = '';
  if (view === 'content') refreshItems();
  if (view === 'submissions') refreshSubmissions();
  if (view === 'logs') refreshAuditLogs();
}

async function logout() {
  if (props.initialUser) {
    authNotice.value = '请从右上角身份菜单切换演示身份。';
    return;
  }
  await logoutAccount();
  currentUser.value = null;
  items.value = [];
  editorOpen.value = false;
  authNotice.value = '';
}

function changeType(type) {
  if (dirty.value && !window.confirm('当前修改尚未保存，确定放弃吗？')) {
    return;
  }
  selectedType.value = type;
  selectedView.value = 'content';
  editorOpen.value = false;
  editingId.value = '';
  refreshItems();
}

function changeFilters() {
  editorOpen.value = false;
  editingId.value = '';
  refreshItems();
}

function startNew() {
  editingId.value = '';
  setForm({ courseCode: selectedCourseCode.value, type: selectedType.value });
  editorOpen.value = true;
  notice.value = '';
}

function editItem(item) {
  editingId.value = item.id;
  setForm(item);
  editorOpen.value = true;
  notice.value = '';
}

function closeEditor() {
  if (dirty.value && !window.confirm('当前修改尚未保存，确定放弃吗？')) {
    return;
  }
  editorOpen.value = false;
  editingId.value = '';
  dirty.value = false;
}

function selectPdf(event) {
  pendingFile.value = event.target.files?.[0] ?? null;
  dirty.value = true;
}

async function saveDraft() {
  actionBusy.value = true;
  notice.value = editingId.value ? '正在保存修改...' : '正在保存草稿...';
  let result = editingId.value
    ? await activeApiClient.value.updateContent(editingId.value, { ...form })
    : await activeApiClient.value.createContent({ ...form });

  if (result.ok && pendingFile.value) {
    notice.value = '正在上传 PDF...';
    result = await activeApiClient.value.uploadPdf(result.item.id, pendingFile.value);
  }

  if (!result.ok) {
    notice.value = result.message;
    actionBusy.value = false;
    return;
  }

  editingId.value = result.item.id;
  pendingFile.value = null;
  dirty.value = false;
  notice.value = result.persistenceWarning || (result.item.status === 'draft' ? '草稿已保存。' : '修改已保存。');
  await refreshItems();
  editorOpen.value = false;
  editingId.value = '';
  actionBusy.value = false;
}

function editSubmission(item) {
  editingSubmissionId.value = item.id;
  Object.assign(submissionForm, emptyForm(), item);
  rejectionNote.value = item.reviewNote ?? '';
  submissionEditorOpen.value = true;
  notice.value = '';
}

async function saveSubmission() {
  actionBusy.value = true;
  const result = await activeApiClient.value.updateSubmission(editingSubmissionId.value, { ...submissionForm });
  notice.value = mutationNotice(result, '投稿修改已保存。');
  if (result.ok) {
    submissionEditorOpen.value = false;
    await refreshSubmissions();
  }
  actionBusy.value = false;
}

async function approveCurrentSubmission(item = null) {
  const target = item ?? submissions.value.find((entry) => entry.id === editingSubmissionId.value);
  if (!target || !window.confirm(`通过“${target.title}”并立即发布吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.approveSubmission(target.id);
  notice.value = mutationNotice(result, '投稿已通过并发布。');
  if (result.ok) submissionEditorOpen.value = false;
  await refreshSubmissions();
  actionBusy.value = false;
}

async function rejectCurrentSubmission(item = null) {
  const target = item ?? submissions.value.find((entry) => entry.id === editingSubmissionId.value);
  if (!target || !window.confirm(`拒绝“${target.title}”吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.rejectSubmission(target.id, rejectionNote.value);
  notice.value = mutationNotice(result, '投稿已拒绝。');
  if (result.ok) submissionEditorOpen.value = false;
  await refreshSubmissions();
  actionBusy.value = false;
}

async function publishItem() {
  if (!editingId.value || dirty.value) {
    notice.value = '请先保存当前修改，再发布内容。';
    return;
  }
  actionBusy.value = true;
  const result = await activeApiClient.value.publishContent(editingId.value);
  notice.value = mutationNotice(result, '内容已发布，课程详情页会立即显示。');
  await refreshItems();
  actionBusy.value = false;
}

async function archiveItem(item = editingItem.value) {
  if (!item || !window.confirm(`确定下架“${item.title}”吗？`)) {
    return;
  }
  actionBusy.value = true;
  const result = await activeApiClient.value.archiveContent(item.id);
  notice.value = mutationNotice(result, '内容已下架。');
  await refreshItems();
  if (editorOpen.value && editingId.value === item.id) {
    const refreshed = items.value.find((entry) => entry.id === item.id);
    if (refreshed) {
      setForm(refreshed);
      editingId.value = refreshed.id;
    }
  }
  actionBusy.value = false;
}

async function removePdf() {
  if (!editingId.value || !window.confirm('确定移除当前 PDF 吗？')) {
    return;
  }
  actionBusy.value = true;
  const result = await activeApiClient.value.removePdf(editingId.value);
  notice.value = mutationNotice(result, 'PDF 已移除。');
  await refreshItems();
  const refreshed = items.value.find((item) => item.id === editingId.value);
  if (refreshed) {
    setForm(refreshed);
    editingId.value = refreshed.id;
  }
  actionBusy.value = false;
}

function formattedTime(value) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

onMounted(initialize);
</script>

<template>
  <article class="admin-page" aria-labelledby="admin-title">
    <aside class="admin-page__nav" aria-label="资源管理分类">
      <span class="admin-page__eyebrow">内容管理</span>
      <strong>课程资源</strong>
      <nav v-if="isAdmin">
        <button
          v-for="type in contentTypes"
          :key="type.id"
          type="button"
          :class="{ 'is-active': selectedView === 'content' && selectedType === type.id }"
          @click="changeView('content', type.id)"
        >
          {{ type.label }}
        </button>
        <button type="button" :class="{ 'is-active': selectedView === 'submissions' }" @click="changeView('submissions')">
          投稿审核 <span v-if="pendingCount" class="admin-nav-count">{{ pendingCount }}</span>
        </button>
        <button type="button" :class="{ 'is-active': selectedView === 'logs' }" @click="changeView('logs')">操作日志</button>
      </nav>
      <button v-if="currentUser" class="admin-page__logout" type="button" @click="logout">退出登录</button>
    </aside>

    <main class="admin-page__content">
      <section v-if="!isAdmin" class="admin-auth" aria-labelledby="admin-title">
        <div>
          <p class="admin-page__eyebrow">生科智学管理端</p>
          <h1 id="admin-title">{{ authMode === 'login' ? '管理员登录' : '首次注册' }}</h1>
          <p>使用已加入管理员白名单的 CC98 账号进入资源维护平台。</p>
        </div>
        <div class="admin-auth__modes" role="tablist" aria-label="登录方式">
          <button type="button" :class="{ 'is-active': authMode === 'login' }" @click="authMode = 'login'">管理员登录</button>
          <button type="button" :class="{ 'is-active': authMode === 'register' }" @click="authMode = 'register'">首次注册</button>
        </div>
        <form class="admin-auth__form" @submit.prevent="submitAuth">
          <label v-if="authMode === 'register'">
            <span>CC98 验证码</span>
            <input v-model.trim="credentials.code" required autocomplete="one-time-code">
          </label>
          <label v-else>
            <span>CC98 名字</span>
            <input v-model.trim="credentials.cc98Name" required autocomplete="username">
          </label>
          <label>
            <span>密码</span>
            <input v-model="credentials.password" type="password" required :minlength="authMode === 'register' ? 10 : 4" autocomplete="current-password">
          </label>
          <p v-if="authNotice" class="admin-notice" role="status">{{ authNotice }}</p>
          <button class="admin-primary-action" type="submit" :disabled="authBusy">
            {{ authBusy ? '正在验证...' : authMode === 'login' ? '登录管理平台' : '注册并登录' }}
          </button>
        </form>
      </section>

      <template v-else>
        <p v-if="isDemo" class="admin-notice" role="status">演示数据仅保存在当前浏览器，不会提交到服务器。</p>
        <header class="admin-page__head">
          <div>
            <p class="admin-page__eyebrow">课程内容运营</p>
            <h1 id="admin-title">{{ pageTitle }}</h1>
          </div>
          <button v-if="selectedView === 'content' && !editorOpen" class="admin-primary-action" type="button" @click="startNew">新增内容</button>
        </header>

        <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

        <section v-if="selectedView === 'content' && editorOpen" class="admin-editor" aria-label="内容编辑器">
          <header class="admin-editor__head">
            <div>
              <span>{{ editingId ? '编辑内容' : '新建草稿' }}</span>
              <strong>{{ form.title || selectedTypeLabel }}</strong>
            </div>
            <button type="button" @click="closeEditor">关闭</button>
          </header>

          <form class="admin-editor__form" @input="dirty = true" @submit.prevent="saveDraft">
            <label>
              <span>课程</span>
              <select v-model="form.courseCode" required :disabled="Boolean(editingId)">
                <option v-for="course in courses" :key="course.code" :value="course.code">
                  {{ course.code }} · {{ course.name }}
                </option>
              </select>
            </label>
            <label>
              <span>内容类型</span>
              <select v-model="form.type" required :disabled="Boolean(editingId)">
                <option v-for="type in contentTypes" :key="type.id" :value="type.id">{{ type.label }}</option>
              </select>
            </label>
            <label class="admin-editor__wide">
              <span>标题</span>
              <input v-model.trim="form.title" required maxlength="80">
            </label>
            <label class="admin-editor__wide">
              <span>摘要</span>
              <textarea v-model.trim="form.summary" rows="2" maxlength="200"></textarea>
            </label>
            <label v-if="form.type !== 'paper'">
              <span>作者或整理者</span>
              <input v-model.trim="form.author" maxlength="40">
            </label>
            <label v-if="form.type === 'experience'">
              <span>CC98 链接（选填）</span>
              <input v-model.trim="form.cc98Url" type="url" placeholder="https://www.cc98.org/">
            </label>
            <label v-if="form.type === 'experience'">
              <span>绩点（选填）</span>
              <input v-model.trim="form.gpa" inputmode="decimal" placeholder="0.00 - 5.00">
            </label>
            <label v-if="form.type === 'material'">
              <span>外部链接</span>
              <input v-model.trim="form.externalUrl" type="url" placeholder="https://">
            </label>
            <label v-if="form.type === 'paper'">
              <span>学年</span>
              <input v-model.trim="form.year" maxlength="20" placeholder="2025-2026">
            </label>
            <label v-if="form.type === 'paper'">
              <span>教师</span>
              <input v-model.trim="form.teacher" maxlength="40">
            </label>
            <label class="admin-editor__wide">
              <span>正文</span>
              <textarea v-model="form.body" rows="10" maxlength="100000"></textarea>
            </label>
            <label v-if="['material', 'paper'].includes(form.type)" class="admin-editor__wide admin-file-field">
              <span>PDF 文件</span>
              <input ref="fileInput" type="file" accept="application/pdf,.pdf" @change="selectPdf">
              <small v-if="pendingFile">待上传：{{ pendingFile.name }}</small>
              <span v-else-if="editingItem?.file" class="admin-file-field__current">
                <a :href="editingItem.file.url" target="_blank" rel="noreferrer">{{ editingItem.file.fileName }}</a>
                <button type="button" :disabled="actionBusy" @click="removePdf">移除 PDF</button>
              </span>
            </label>

            <footer class="admin-editor__actions">
              <button type="button" @click="closeEditor">放弃修改</button>
              <button class="admin-primary-action" type="submit" :disabled="actionBusy">{{ editingId ? '保存修改' : '保存草稿' }}</button>
              <button
                v-if="editingId && editingItem?.status !== 'published'"
                type="button"
                :disabled="actionBusy || dirty"
                @click="publishItem"
              >
                发布
              </button>
              <button
                v-if="editingId && editingItem?.status === 'published'"
                class="admin-danger-action"
                type="button"
                :disabled="actionBusy"
                @click="archiveItem()"
              >
                下架
              </button>
            </footer>
          </form>
        </section>

        <section v-else-if="selectedView === 'content'" class="admin-list" aria-label="课程内容列表">
          <div class="admin-list__filters">
            <label>
              <span>课程</span>
              <select v-model="selectedCourseCode" @change="changeFilters">
                <option v-for="course in courses" :key="course.code" :value="course.code">
                  {{ course.code }} · {{ course.name }}
                </option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select v-model="selectedStatus" @change="changeFilters">
                <option v-for="status in statusOptions" :key="status.id" :value="status.id">{{ status.label }}</option>
              </select>
            </label>
            <label>
              <span>内容搜索</span>
              <input v-model.trim="contentQuery" type="search" placeholder="标题、摘要或作者">
            </label>
          </div>

          <p v-if="listBusy" class="admin-list__empty">正在读取内容...</p>
          <p v-else-if="!filteredItems.length" class="admin-list__empty">当前筛选条件下暂无内容。</p>
          <div v-else class="admin-content-table" role="table" aria-label="课程内容">
            <div class="admin-content-table__head" role="row">
              <span>标题</span><span>状态</span><span>更新时间</span><span>操作</span>
            </div>
            <article v-for="item in filteredItems" :key="item.id" class="admin-content-table__row" role="row">
              <div>
                <strong>{{ item.title }}</strong>
                <small>{{ item.summary || '暂无摘要' }}</small>
              </div>
              <span class="admin-status" :data-status="item.status">{{ statusLabels[item.status] }}</span>
              <time :datetime="item.updatedAt">{{ formattedTime(item.updatedAt) }}</time>
              <div class="admin-content-table__actions">
                <button type="button" @click="editItem(item)">编辑</button>
                <button v-if="item.status === 'published'" type="button" @click="archiveItem(item)">下架</button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="selectedView === 'submissions'" class="admin-list" aria-label="投稿审核列表">
          <div class="admin-list__filters admin-list__filters--wide">
            <label>
              <span>课程</span>
              <select v-model="selectedCourseCode" @change="refreshSubmissions">
                <option value="">全部课程</option>
                <option v-for="course in courses" :key="course.code" :value="course.code">{{ course.code }} · {{ course.name }}</option>
              </select>
            </label>
            <label>
              <span>审核状态</span>
              <select v-model="submissionStatus" @change="refreshSubmissions">
                <option value="">全部状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
            </label>
            <label>
              <span>投稿搜索</span>
              <input v-model.trim="submissionQuery" type="search" placeholder="标题、作者或投稿人" @change="refreshSubmissions">
            </label>
          </div>

          <section v-if="submissionEditorOpen" class="admin-editor admin-submission-editor">
            <header class="admin-editor__head">
              <div><span>审核投稿</span><strong>{{ submissionForm.title }}</strong></div>
              <button type="button" @click="submissionEditorOpen = false">关闭</button>
            </header>
            <form class="admin-editor__form" @submit.prevent="saveSubmission">
              <label class="admin-editor__wide"><span>标题</span><input v-model.trim="submissionForm.title" required maxlength="80"></label>
              <label class="admin-editor__wide"><span>摘要</span><textarea v-model.trim="submissionForm.summary" rows="2" maxlength="200"></textarea></label>
              <label><span>作者</span><input v-model.trim="submissionForm.author" maxlength="40"></label>
              <label><span>CC98 链接（选填）</span><input v-model.trim="submissionForm.cc98Url" type="url"></label>
              <label><span>绩点（选填）</span><input v-model.trim="submissionForm.gpa" inputmode="decimal"></label>
              <label v-if="submissionForm.type === 'material'"><span>资料链接</span><input v-model.trim="submissionForm.externalUrl" type="url"></label>
              <label class="admin-editor__wide"><span>正文</span><textarea v-model="submissionForm.body" rows="10"></textarea></label>
              <label class="admin-editor__wide"><span>拒绝原因（选填）</span><input v-model.trim="rejectionNote" maxlength="500"></label>
              <footer class="admin-editor__actions">
                <button type="button" @click="submissionEditorOpen = false">关闭</button>
                <button v-if="submissionForm.status === 'pending'" type="submit" :disabled="actionBusy">保存修改</button>
                <button v-if="submissionForm.status === 'pending'" class="admin-danger-action" type="button" :disabled="actionBusy" @click="rejectCurrentSubmission()">拒绝</button>
                <button v-if="submissionForm.status === 'pending'" class="admin-primary-action" type="button" :disabled="actionBusy" @click="approveCurrentSubmission()">通过并发布</button>
              </footer>
            </form>
          </section>

          <p v-if="listBusy" class="admin-list__empty">正在读取投稿...</p>
          <p v-else-if="!submissions.length" class="admin-list__empty">当前筛选条件下暂无投稿。</p>
          <div v-else class="admin-content-table admin-content-table--submission" role="table" aria-label="投稿审核">
            <div class="admin-content-table__head" role="row"><span>投稿</span><span>状态</span><span>时间</span><span>操作</span></div>
            <article v-for="item in submissions" :key="item.id" class="admin-content-table__row" role="row">
              <div><strong>{{ item.title }}</strong><small>{{ item.author || item.submitterName }} · {{ item.courseCode }}</small></div>
              <span class="admin-status" :data-status="item.status">{{ submissionStatusLabels[item.status] }}</span>
              <time :datetime="item.createdAt">{{ formattedTime(item.createdAt) }}</time>
              <div class="admin-content-table__actions">
                <button type="button" @click="editSubmission(item)">{{ item.status === 'pending' ? '审核' : '查看' }}</button>
                <button v-if="item.status === 'pending'" type="button" @click="approveCurrentSubmission(item)">通过</button>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="admin-list" aria-label="操作日志">
          <div class="admin-list__filters admin-list__filters--wide">
            <label><span>课程</span><select v-model="selectedCourseCode" @change="refreshAuditLogs"><option value="">全部课程</option><option v-for="course in courses" :key="course.code" :value="course.code">{{ course.code }} · {{ course.name }}</option></select></label>
            <label><span>操作类型</span><select v-model="auditAction" @change="refreshAuditLogs"><option value="">全部操作</option><option v-for="(label, action) in auditActionLabels" :key="action" :value="action">{{ label }}</option></select></label>
            <label><span>日志搜索</span><input v-model.trim="auditQuery" type="search" placeholder="内容标题、管理员或说明" @change="refreshAuditLogs"></label>
          </div>
          <p v-if="listBusy" class="admin-list__empty">正在读取日志...</p>
          <p v-else-if="!auditLogs.length" class="admin-list__empty">当前筛选条件下暂无操作记录。</p>
          <div v-else class="admin-audit-list">
            <article v-for="entry in auditLogs" :key="entry.id" class="admin-audit-row">
              <span class="admin-status">{{ auditActionLabels[entry.action] || entry.action }}</span>
              <div><strong>{{ entry.targetTitle || '未命名内容' }}</strong><small>{{ entry.courseCode }} · {{ entry.actorName || '系统' }}<template v-if="entry.detail"> · {{ entry.detail }}</template></small></div>
              <time :datetime="entry.createdAt">{{ formattedTime(entry.createdAt) }}</time>
            </article>
          </div>
        </section>
      </template>
    </main>
  </article>
</template>
