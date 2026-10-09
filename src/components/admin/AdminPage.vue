<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import {
  fetchCurrentUser,
  loginEmailAccount,
  logoutAccount,
  registerEmailAccount,
  requestEmailVerificationCode,
} from '../../services/authApiClient.js';
import { adminApiClient as defaultAdminApiClient } from '../../services/adminApiClient.js';
import { consultationApiClient } from '../../services/consultationApiClient.js';
import { isAdministrator } from '../../services/authService.js';
import { loadResourceCatalog } from '../../data/courses/resourceData.js';
import TeacherNameInput from '../TeacherNameInput.vue';
import { courseTeacherNames } from '../../services/teacherSuggestionService.js';
import { majorOptions } from '../../data/courses/programCatalog.js';
import { filterAdminCoursesToOverview, pendingCourseOrder } from '../../services/adminCourseService.js';
import { publicApiPath } from '../../services/apiClient.js';
import { activityImageOptions, activityPrograms, activityProgramLabel } from '../../data/activityConfig.js';
import { publicAssetPath } from '../../utils/publicPath.js';
import { imageFileToAvatarDataUrl } from '../../services/studentHomepageApiClient.js';
import AdminCourseCombobox from './AdminCourseCombobox.vue';
import NoticeAdminPanel from './NoticeAdminPanel.vue';
import { readAdminDrafts, saveAdminDraft, removeAdminDraft, hasAdminDraftContent } from '../../services/adminDraftService.js';
import { normalizeContentSource } from '../../services/contentSourceService.js';

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
  { id: 'pending', label: '待审核' },
  { id: 'rejected', label: '已拒绝' },
];
const statusLabels = { draft: '草稿', published: '已发布', archived: '已下架' };
const submissionStatusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
const auditActionLabels = {
  'content.create': '新建内容', 'content.update': '编辑内容', 'content.publish': '发布内容',
  'content.archive': '下架内容', 'content.file.upload': '上传文件', 'content.file.remove': '移除文件',
  'submission.update': '编辑投稿', 'submission.approve': '通过投稿', 'submission.reject': '拒绝投稿',
  'activity.create': '新建活动', 'activity.update': '编辑活动',
  'activity.publish': '发布活动', 'activity.archive': '下架活动',
  'notice.create': '新建通知', 'notice.update': '编辑通知',
  'notice.publish': '发布通知', 'notice.archive': '下架通知',
  'notice.file.add': '上传通知附件', 'notice.file.upload': '上传通知附件', 'notice.file.remove': '移除通知附件',
  'student_homepage.create': '新增同学主页', 'student_homepage.update': '编辑同学主页', 'student_homepage.delete': '移除同学主页',
  'student_homepage_application.create': '投稿同学主页', 'student_homepage_application.approve': '通过主页投稿', 'student_homepage_application.reject': '拒绝主页投稿',
};

const currentUser = ref(null);
const authMode = ref('login');
const authBusy = ref(false);
const authNotice = ref('');
const credentials = reactive({ code: '', studentId: '', nickname: '', password: '' });
const courses = ref([]);
const selectedMajorId = ref(majorOptions[0]?.id ?? '');
const selectedCourseCode = ref('');
const selectedType = ref('experience');
const selectedStatus = ref('');
const selectedView = ref('content');
const noticePanel = ref(null);
const contentQuery = ref('');
const items = ref([]);
const submissions = ref([]);
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
const editorItemSnapshot = ref(null);
const activeDraftKey = ref('');
const activeDraftRevision = ref('');
const editorRequestId = ref('');
const editorBaseUpdatedAt = ref('');
const rememberedFileName = ref('');
const localDrafts = ref([]);
const draftStatus = ref('');
let draftTimer, hydratingForm = false, disposed = false;
const homepages = ref([]);
const homepageApplications = ref([]);
const homepageEditorOpen = ref(false);
const editingHomepageId = ref('');
const homepageForm = reactive({ name: '', href: '', avatarUrl: '', sortOrder: 0, status: 'approved' });
const feedbackItems = ref([]), feedbackUnread = ref(0), feedbackTotal = ref(0), feedbackPage = ref(1), feedbackBusy = ref(false);
const pendingHomepages = computed(() => homepageApplications.value.some((item) => item.status === 'pending'));
let badgeTimer, badgeSequence = 0, feedbackSequence = 0, feedbackCountSequence = 0;
const activities = ref([]);
const activityProgramId = ref(activityPrograms[0].id);
const activityCurrentProgram = computed(() => activityPrograms.find((program) => program.id === activityProgramId.value));
const activityQuery = ref('');
const activityEditorOpen = ref(false);
const editingActivityId = ref('');
const activityForm = reactive(emptyActivityForm());
const consultationStatus = ref(null);
const consultationBusy = ref(false);
const consultationNotice = ref('');
const candidateQuery = ref('');
const candidates = ref([]);
const candidateBusy = ref(false);
const selectedMentor = ref(null);
const consultationForm = reactive({ startsAt: '', endsAt: '' });

const isAdmin = computed(() => isAdministrator(currentUser.value));
const majorCourses = computed(() => filterAdminCoursesToOverview(courses.value, selectedMajorId.value));
const editingItem = computed(() => editorItemSnapshot.value?.id === editingId.value
  ? editorItemSnapshot.value : items.value.find((item) => item.id === editingId.value) ?? null);
const draftScope = computed(() => isAdmin.value && (currentUser.value?.publicId || currentUser.value?.id)
  ? `${props.isDemo ? 'demo' : 'real'}:${currentUser.value.publicId || currentUser.value.id}` : '');
const selectedTypeLabel = computed(() => contentTypes.find((type) => type.id === selectedType.value)?.label ?? '内容');
const pendingCourseCodes = computed(() => pendingCourseOrder(submissions.value, selectedType.value));
const allPendingCourseCodes = computed(() => [...new Set(submissions.value.filter((item) => item.status === 'pending' && !item.withdrawnAt).map((item) => item.courseCode))]);
const visiblePendingCourseCodes = computed(() => pendingCourseCodes.value.filter((code) => majorCourses.value.some((course) => course.code === code)));
const pendingTypes = computed(() => new Set(submissions.value.filter((item) => item.status === 'pending' && !item.withdrawnAt).map((item) => item.type)));
const filteredRows = computed(() => {
  const query = contentQuery.value.trim().toLowerCase();
  const matches = (item) => !query || [item.title, item.summary, item.author, item.submitterName, item.year, item.teacher]
    .some((value) => String(value ?? '').toLowerCase().includes(query));
  const content = ['pending', 'rejected'].includes(selectedStatus.value) ? [] : items.value.filter(matches).map((item) => ({ ...item, rowKind: 'content' }));
  const reviews = submissions.value.filter((item) => item.courseCode === selectedCourseCode.value
    && item.type === selectedType.value && ['pending', 'rejected'].includes(item.status)
    && !item.withdrawnAt && (!selectedStatus.value || selectedStatus.value === item.status) && matches(item))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((item) => ({ ...item, rowKind: 'submission' }));
  return [...reviews, ...content];
});
const pageTitle = computed(() => {
  if (selectedView.value === 'notices') return '通知管理';
  if (selectedView.value === 'activities') return '活动管理';
  if (selectedView.value === 'more') return '更多';
  if (selectedView.value === 'feedback') return '意见反馈';
  if (selectedView.value === 'consultation') return '咨询室';
  if (selectedView.value === 'logs') return '操作日志';
  return selectedTypeLabel.value;
});

const consultationScheduled = computed(() => Boolean(
  consultationStatus.value?.mentor && !consultationStatus.value?.closed
    && Date.parse(consultationStatus.value.endsAt) > Date.now(),
));

function localDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

function consultationDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

async function refreshConsultation() {
  if (!isAdmin.value || props.isDemo) return;
  consultationBusy.value = true;
  const result = await consultationApiClient.getStatus();
  if (result.ok) {
    consultationStatus.value = result;
    selectedMentor.value = result.mentor && result.mentorUserId
      ? { ...result.mentor, id: result.mentorUserId } : null;
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    consultationForm.startsAt = localDateTime(consultationScheduled.value ? result.startsAt : now);
    consultationForm.endsAt = localDateTime(consultationScheduled.value ? result.endsAt : end);
  } else {
    consultationNotice.value = result.message || '咨询室状态读取失败。';
  }
  consultationBusy.value = false;
}

async function searchMentorCandidates() {
  if (!isAdmin.value || props.isDemo) return;
  candidateBusy.value = true;
  const result = await consultationApiClient.listCandidates(candidateQuery.value.trim());
  if (result.ok) candidates.value = result.users ?? [];
  else consultationNotice.value = result.message || '用户列表读取失败。';
  candidateBusy.value = false;
}

async function saveConsultation() {
  if (props.isDemo || consultationBusy.value) return;
  consultationNotice.value = '';
  const startsAt = new Date(consultationForm.startsAt);
  const endsAt = new Date(consultationForm.endsAt);
  if (!selectedMentor.value?.id) {
    consultationNotice.value = '请先选择一位指导学长。';
    return;
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())
    || startsAt >= endsAt || endsAt <= new Date()) {
    consultationNotice.value = '请填写有效时间，并确保结束时间晚于开始时间和当前时间。';
    return;
  }
  consultationBusy.value = true;
  const result = await consultationApiClient.setSession({
    mentorUserId: selectedMentor.value.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });
  consultationBusy.value = false;
  consultationNotice.value = result.ok ? '咨询室安排已保存。' : result.message || '保存失败。';
  if (result.ok) await refreshConsultation();
}

async function closeConsultation() {
  if (props.isDemo || consultationBusy.value || !window.confirm('确定现在关闭咨询室吗？')) return;
  consultationBusy.value = true;
  const result = await consultationApiClient.closeSession();
  consultationBusy.value = false;
  consultationNotice.value = result.ok ? '咨询室已关闭。' : result.message || '关闭失败。';
  if (result.ok) await refreshConsultation();
}

function emptyActivityForm() {
  return {
    title: '', programId: activityProgramId.value, imageUrl: '', externalUrl: '', featured: false,
  };
}

function setActivityForm(input = {}) {
  Object.assign(activityForm, emptyActivityForm(), input);
  dirty.value = false;
}

function mutationNotice(result, successMessage) {
  return result.ok ? (result.persistenceWarning || successMessage) : result.message;
}

function activityImage(path) {
  return path ? publicAssetPath(path) : '';
}

function emptyForm() {
  return {
    courseCode: '',
    type: 'experience',
    title: '',
    summary: '',
    author: '',
    body: '',
    bodyFormat: 'markdown',
    externalUrl: '',
    cc98Url: '',
    sourcePlatform: 'cc98',
    sourceUrl: '',
    gpa: '',
    year: '',
    teacher: '',
  };
}

function setForm(input = {}) {
  hydratingForm = true;
  clearTimeout(draftTimer);
  const next = { ...emptyForm(), ...input, ...normalizeContentSource(input),
    courseCode: input.courseCode ?? selectedCourseCode.value,
    type: input.type ?? selectedType.value,
  };
  for (const key of Object.keys(emptyForm())) form[key] = next[key];
  editorItemSnapshot.value = input.id ? { ...input } : null;
  editorBaseUpdatedAt.value = input.updatedAt ?? '';
  pendingFile.value = null;
  rememberedFileName.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  dirty.value = false;
  hydratingForm = false;
}

function draftSnapshot() {
  return {
    key: activeDraftKey.value, majorId: selectedMajorId.value, editingId: editingId.value,
    requestId: editorRequestId.value, baseUpdatedAt: editorBaseUpdatedAt.value,
    form: { ...form }, pendingFileName: pendingFile.value?.name || rememberedFileName.value,
    savedFile: editingItem.value?.file ?? null,
  };
}

function refreshLocalDrafts() {
  const result = readAdminDrafts(draftScope.value);
  localDrafts.value = result.drafts;
  if (!result.ok) draftStatus.value = result.message;
}

function persistDraft() {
  clearTimeout(draftTimer);
  if (!draftScope.value || !editorOpen.value || !activeDraftKey.value || !dirty.value || hydratingForm) return true;
  const snapshot = draftSnapshot();
  if (!hasAdminDraftContent(snapshot.form, snapshot.pendingFileName)) {
    const removed = removeAdminDraft(draftScope.value, snapshot.key, undefined, activeDraftRevision.value);
    if (removed.ok && !removed.skipped) {
      activeDraftRevision.value = '';
      localDrafts.value = removed.drafts;
      draftStatus.value = '';
      return true;
    }
    draftStatus.value = removed.message || '此草稿已在另一窗口修改，请重新恢复草稿。';
    return false;
  }
  const result = saveAdminDraft(draftScope.value, snapshot, undefined, activeDraftRevision.value);
  if (result.ok) {
    activeDraftRevision.value = result.draft.revision;
    localDrafts.value = result.drafts;
    draftStatus.value = '草稿已自动保存';
  } else draftStatus.value = result.message;
  return result.ok;
}

function beginDraftContext() {
  activeDraftKey.value = `editor:${crypto.randomUUID()}`;
  activeDraftRevision.value = '';
  editorRequestId.value = crypto.randomUUID();
  draftStatus.value = '';
}

function preserveEditorBeforeLeaving() {
  if (actionBusy.value) return false;
  if (!editorOpen.value || !dirty.value || persistDraft()) return true;
  return window.confirm('草稿尚未保存，确定离开编辑器吗？');
}

async function restoreLocalDraft(draft) {
  if (actionBusy.value || !preserveEditorBeforeLeaving()) return;
  const latest = readAdminDrafts(draftScope.value);
  if (!latest.ok) { notice.value = latest.message; return; }
  localDrafts.value = latest.drafts;
  draft = latest.drafts.find((entry) => entry.key === draft.key);
  if (!draft) { notice.value = '这份本机草稿已被移除。'; return; }
  if (!majorOptions.some((major) => major.id === draft.majorId)) {
    notice.value = '草稿的专业信息无效。'; return;
  }
  const scope = draftScope.value;
  actionBusy.value = true;
  try {
    let item = null;
    if (draft.editingId) {
      const result = await activeApiClient.value.fetchContent({ courseCode: draft.form.courseCode, type: draft.form.type, status: '' });
      if (disposed || draftScope.value !== scope) return;
      if (!result.ok) { notice.value = result.message; return; }
      item = result.items?.find((entry) => entry.id === draft.editingId);
      if (!item) { notice.value = '原内容已不存在，请核对后再恢复。'; return; }
      if (draft.baseUpdatedAt && item.updatedAt !== draft.baseUpdatedAt
        && !window.confirm('服务器内容已更新。确定载入本机草稿继续编辑吗？')) return;
    }
    selectedMajorId.value = draft.majorId;
    selectedCourseCode.value = draft.form.courseCode;
    selectedType.value = draft.form.type;
    selectedStatus.value = '';
    setForm(draft.form);
    editingId.value = draft.editingId;
    editorItemSnapshot.value = item;
    editorBaseUpdatedAt.value = item?.updatedAt ?? '';
    activeDraftKey.value = draft.key;
    activeDraftRevision.value = draft.revision;
    editorRequestId.value = draft.requestId || crypto.randomUUID();
    rememberedFileName.value = draft.pendingFileName;
    editorOpen.value = true;
    submissionEditorOpen.value = false;
    dirty.value = true;
    draftStatus.value = '已恢复本机草稿';
    notice.value = '';
  } catch (error) {
    if (!disposed && draftScope.value === scope) notice.value = error.message || '草稿恢复失败，请重试。';
  } finally {
    if (!disposed && draftScope.value === scope) actionBusy.value = false;
  }
}

function discardLocalDraft(draft) {
  if (actionBusy.value || !window.confirm(`删除本机草稿“${draft.form.title || '未命名'}”吗？`)) return;
  const result = removeAdminDraft(draftScope.value, draft.key, undefined, draft.revision);
  if (result.ok) localDrafts.value = result.drafts;
  else notice.value = result.message;
}

watch(draftScope, () => {
  clearTimeout(draftTimer);
  editorOpen.value = false;
  editingId.value = '';
  activeDraftKey.value = '';
  activeDraftRevision.value = '';
  editorRequestId.value = '';
  setForm();
  actionBusy.value = false;
  localDrafts.value = [];
  draftStatus.value = '';
  refreshLocalDrafts();
}, { flush: 'sync' });
watch(() => form.type, (type) => {
  if (hydratingForm || type !== 'experience') return;
  pendingFile.value = null;
  rememberedFileName.value = '';
  if (fileInput.value) fileInput.value.value = '';
}, { flush: 'sync' });
watch([form, pendingFile], () => {
  if (hydratingForm || !editorOpen.value || selectedView.value !== 'content' || !draftScope.value) return;
  dirty.value = true;
  draftStatus.value = '正在自动保存...';
  clearTimeout(draftTimer);
  draftTimer = setTimeout(persistDraft, 300);
}, { deep: true, flush: 'sync' });

function onPageHide() { persistDraft(); }
function onBeforeUnload(event) {
  if (actionBusy.value || (editorOpen.value && dirty.value && !persistDraft())) {
    event.preventDefault(); event.returnValue = '';
  }
}

async function loadCourses() {
  try {
    const catalog = await loadResourceCatalog();
    courses.value = filterAdminCoursesToOverview(catalog.courses);
  } catch {
    notice.value = '课程目录加载失败。';
  }
}

async function refreshItems() {
  if (!isAdmin.value || !selectedCourseCode.value) {
    items.value = [];
    return;
  }
  listBusy.value = true;
  const result = await activeApiClient.value.fetchContent({
    courseCode: selectedCourseCode.value,
    type: selectedType.value,
    status: ['pending', 'rejected'].includes(selectedStatus.value) ? '' : selectedStatus.value,
  });
  if (result.ok) {
    items.value = result.items ?? [];
  } else {
    notice.value = result.message;
  }
  listBusy.value = false;
}

async function refreshSubmissions() {
  ++badgeSequence;
  if (!isAdmin.value) return;
  listBusy.value = true;
  const result = await activeApiClient.value.fetchSubmissions({});
  if (result.ok) {
    submissions.value = result.submissions ?? [];
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

async function refreshHomepages() {
  ++badgeSequence;
  if (!isAdmin.value) return;
  const [directory, applications] = await Promise.all([
    activeApiClient.value.fetchHomepages(),
    activeApiClient.value.fetchHomepageApplications(),
  ]);
  if (directory.ok) homepages.value = directory.homepages ?? [];
  else notice.value = directory.message;
  if (applications.ok) homepageApplications.value = applications.applications ?? [];
  else notice.value = applications.message;
}

function startHomepage(item = null) {
  editingHomepageId.value = item?.id ?? '';
  Object.assign(homepageForm, {
    name: item?.name ?? '', href: item?.href ?? '',
    avatarUrl: item?.avatarUrl ?? '', sortOrder: item?.sortOrder ?? homepages.value.length,
    status: item?.status ?? 'approved',
  });
  homepageEditorOpen.value = true;
  notice.value = '';
}

async function selectAdminHomepageAvatar(event) {
  try {
    homepageForm.avatarUrl = await imageFileToAvatarDataUrl(event.target.files?.[0]);
    notice.value = '';
  } catch (error) {
    notice.value = error.message;
  }
}

async function saveHomepage() {
  actionBusy.value = true;
  const result = editingHomepageId.value
    ? await activeApiClient.value.updateHomepage(editingHomepageId.value, { ...homepageForm })
    : await activeApiClient.value.createHomepage({ ...homepageForm });
  notice.value = mutationNotice(result, '同学主页已保存。');
  if (result.ok) {
    homepageEditorOpen.value = false;
    await refreshHomepages();
  }
  actionBusy.value = false;
}

async function removeHomepage(item) {
  if (!window.confirm(`确定移除“${item.name}”吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.deleteHomepage(item.id);
  notice.value = mutationNotice(result, '同学主页已移除。');
  await refreshHomepages();
  actionBusy.value = false;
}

async function decideHomepageApplication(item, decision) {
  if (!window.confirm(`${decision === 'approve' ? '通过' : '拒绝'}“${item.name}”的主页投稿吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.decideHomepageApplication(item.id, decision);
  notice.value = mutationNotice(result, decision === 'approve' ? '投稿已通过。' : '投稿已拒绝。');
  await refreshHomepages();
  actionBusy.value = false;
}

async function refreshActivities() {
  if (!isAdmin.value) return;
  listBusy.value = true;
  const result = await activeApiClient.value.fetchActivities({
    programId: activityProgramId.value,
    query: activityQuery.value,
  });
  if (result.ok) activities.value = result.activities ?? [];
  else notice.value = result.message;
  listBusy.value = false;
}

async function refreshFeedbackCount() {
  if (!isAdmin.value || !activeApiClient.value.fetchFeedbackCount) return;
  const token = ++feedbackCountSequence;
  const result = await activeApiClient.value.fetchFeedbackCount();
  if (token === feedbackCountSequence && result.ok) feedbackUnread.value = Number(result.unreadCount) || 0;
}

async function refreshFeedback(page = 1) {
  if (!isAdmin.value) return;
  const token = ++feedbackSequence;
  feedbackBusy.value = true; feedbackItems.value = []; feedbackPage.value = page;
  try {
    const result = await activeApiClient.value.fetchFeedback(page);
    if (token !== feedbackSequence) return;
    if (!result.ok) { notice.value = result.message; return; }
    feedbackItems.value = result.items ?? []; feedbackTotal.value = Number(result.total) || 0;
    feedbackUnread.value = Number(result.unreadCount) || 0;
    const unread = feedbackItems.value.filter((item) => !item.readAt).map((item) => item.id);
    if (unread.length && selectedView.value === 'feedback') {
      ++feedbackCountSequence;
      const read = await activeApiClient.value.markFeedbackRead(unread);
      if (token !== feedbackSequence) return;
      if (read.ok) {
        ++feedbackCountSequence;
        feedbackUnread.value = Number(read.unreadCount) || 0;
        feedbackItems.value = feedbackItems.value.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }));
      } else notice.value = read.message;
    }
  } catch { if (token === feedbackSequence) notice.value = '意见反馈暂时无法读取，请稍后重试。'; }
  finally { if (token === feedbackSequence) feedbackBusy.value = false; }
}

async function refreshPendingBadges() {
  if (!isAdmin.value || document.hidden) return;
  const token = ++badgeSequence;
  const [reviews, homepagesResult] = await Promise.all([
    activeApiClient.value.fetchSubmissions({}), activeApiClient.value.fetchHomepageApplications(), refreshFeedbackCount(),
  ]);
  if (token !== badgeSequence) return;
  if (reviews.ok) submissions.value = reviews.submissions ?? [];
  if (homepagesResult.ok) homepageApplications.value = homepagesResult.applications ?? [];
}

async function initialize() {
  await loadCourses();
  if (props.initialUser) {
    currentUser.value = props.initialUser;
    await Promise.all([refreshItems(), refreshSubmissions(), refreshActivities(), refreshHomepages(), refreshFeedbackCount()]);
    return;
  }
  try {
    const result = await fetchCurrentUser();
    currentUser.value = result.ok ? result.user : null;
    if (isAdmin.value) {
      await Promise.all([refreshItems(), refreshSubmissions(), refreshActivities(), refreshHomepages(), refreshFeedbackCount()]);
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
      result = await registerEmailAccount({
        studentId: credentials.studentId,
        nickname: credentials.nickname,
        code: credentials.code,
        password: credentials.password,
      });
      if (result.ok) {
        result = await loginEmailAccount({ studentId: credentials.studentId, password: credentials.password });
      }
    } else {
      result = await loginEmailAccount({ studentId: credentials.studentId, password: credentials.password });
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
        await Promise.all([refreshSubmissions(), refreshActivities(), refreshHomepages(), refreshFeedbackCount()]);
      }
    }
  } catch {
    authNotice.value = '管理服务暂时无法连接。';
  } finally {
    authBusy.value = false;
  }
}

async function requestAdminEmailCode() {
  authBusy.value = true;
  authNotice.value = '正在发送验证码...';
  const result = await requestEmailVerificationCode({
    studentId: credentials.studentId,
    purpose: 'register',
  });
  authBusy.value = false;
  authNotice.value = result.message;
}

function changeView(view, type = '') {
  if (actionBusy.value) return;
  if (view === 'notices' && selectedView.value === 'notices') return;
  if (selectedView.value === 'notices' && !noticePanel.value?.canLeave()) return;
  if (editorOpen.value ? !preserveEditorBeforeLeaving() : dirty.value && !window.confirm('当前修改尚未保存，确定放弃吗？')) return;
  if (view !== 'feedback') { ++feedbackSequence; feedbackBusy.value = false; }
  selectedView.value = view;
  editorOpen.value = false;
  submissionEditorOpen.value = false;
  activityEditorOpen.value = false;
  homepageEditorOpen.value = false;
  if (type) selectedType.value = type;
  notice.value = '';
  if (view === 'notices') dirty.value = false;
  if (view === 'content') {
    selectedStatus.value = '';
    refreshItems();
    refreshSubmissions();
  }
  if (view === 'activities') refreshActivities();
  if (view === 'more') refreshHomepages();
  if (view === 'feedback') refreshFeedback(1);
  if (view === 'consultation') {
    refreshConsultation();
    searchMentorCandidates();
  }
  if (view === 'logs') refreshAuditLogs();
}

function startActivity(programId = activityProgramId.value) {
  editingActivityId.value = '';
  setActivityForm({ programId });
  activityEditorOpen.value = true;
  notice.value = '';
}

function editActivity(activity) {
  editingActivityId.value = activity.id;
  setActivityForm(activity);
  activityEditorOpen.value = true;
  notice.value = '';
}

function closeActivityEditor() {
  if (dirty.value && !window.confirm('当前修改尚未保存，确定放弃吗？')) return;
  activityEditorOpen.value = false;
  editingActivityId.value = '';
  dirty.value = false;
}

async function saveActivity() {
  actionBusy.value = true;
  const input = {
    title: activityForm.title,
    programId: activityForm.programId,
    imageUrl: activityForm.imageUrl,
    externalUrl: activityForm.externalUrl,
    featured: activityForm.featured,
  };
  const result = editingActivityId.value
    ? await activeApiClient.value.updateActivity(editingActivityId.value, input)
    : await activeApiClient.value.createActivity(input);
  notice.value = mutationNotice(result, editingActivityId.value ? '推文修改已保存。' : '推文已加入活动目录。');
  if (result.ok) {
    editingActivityId.value = result.activity.id;
    dirty.value = false;
    await refreshActivities();
    activityEditorOpen.value = false;
    editingActivityId.value = '';
  }
  actionBusy.value = false;
}

async function archiveManagedActivity(activity) {
  if (!activity || !window.confirm(`确定从活动目录移除“${activity.title}”吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.archiveActivity(activity.id);
  notice.value = mutationNotice(result, '推文已从活动目录移除。');
  await refreshActivities();
  actionBusy.value = false;
}

async function logout() {
  if (!preserveEditorBeforeLeaving()) return;
  if (selectedView.value === 'notices' && !noticePanel.value?.canLeave()) return;
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

function changeMajor() {
  const availableCodes = new Set(majorCourses.value.map((course) => course.code));
  if (!availableCodes.has(selectedCourseCode.value)) selectedCourseCode.value = '';
  if (editorOpen.value && !editingId.value && form.courseCode && !availableCodes.has(form.courseCode)) {
    form.courseCode = '';
    dirty.value = true;
  }
  if (selectedView.value === 'content') refreshItems();
  if (selectedView.value === 'logs') refreshAuditLogs();
}

function changeFilters() {
  if (actionBusy.value || !preserveEditorBeforeLeaving()) return;
  editorOpen.value = false;
  submissionEditorOpen.value = false;
  editingId.value = '';
  refreshItems();
}

function selectCourseForReview(code) {
  selectedStatus.value = pendingCourseCodes.value.includes(code) ? 'pending' : '';
  changeFilters();
}

function startNew(defaults = {}) {
  if (actionBusy.value || !preserveEditorBeforeLeaving()) return;
  submissionEditorOpen.value = false;
  editingId.value = '';
  setForm({ courseCode: selectedCourseCode.value, type: selectedType.value, ...defaults });
  beginDraftContext();
  editorOpen.value = true;
  notice.value = '';
}

function editItem(item) {
  if (actionBusy.value || !preserveEditorBeforeLeaving()) return;
  submissionEditorOpen.value = false;
  editingId.value = item.id;
  setForm(item);
  beginDraftContext();
  editorOpen.value = true;
  notice.value = '';
}

function closeEditor() {
  if (!preserveEditorBeforeLeaving()) return;
  editorOpen.value = false;
  editingId.value = '';
  dirty.value = false;
  clearTimeout(draftTimer);
}

function selectPdf(event) {
  pendingFile.value = event.target.files?.[0] ?? null;
  dirty.value = true;
}

async function saveContent(mode = 'draft') {
  if (actionBusy.value || !isAdmin.value) return;
  if (!form.courseCode) {
    notice.value = '请先从搜索结果中选择课程。';
    return;
  }
  if (!form.title.trim() || (mode !== 'draft' && form.type === 'experience' && !form.body.trim())) {
    notice.value = '请填写标题和心得正文。'; return;
  }
  if (rememberedFileName.value && !pendingFile.value) {
    notice.value = `请重新选择 PDF：${rememberedFileName.value}`; return;
  }
  persistDraft();
  const scope = draftScope.value;
  const snapshot = draftSnapshot();
  const file = pendingFile.value;
  const input = { ...snapshot.form, cc98Url: snapshot.form.sourcePlatform === 'cc98' ? snapshot.form.sourceUrl : '' };
  const stillCurrent = () => !disposed && draftScope.value === scope && activeDraftKey.value === snapshot.key;
  actionBusy.value = true;
  notice.value = editingId.value ? '正在保存修改...' : '正在保存草稿...';
  try {
    let result = snapshot.editingId
      ? await activeApiClient.value.updateContent(snapshot.editingId, { ...input, expectedUpdatedAt: snapshot.baseUpdatedAt })
      : await activeApiClient.value.createContent({ ...input, requestId: snapshot.requestId });
    if (!result.ok) throw new Error(result.message || '保存失败，请重试。');
    if (result.replayed && (result.item.status !== 'draft' || result.item.updatedAt !== result.item.createdAt)
      && !window.confirm('此前录入已保存，且服务器内容已有后续更新。确定用当前输入继续更新吗？')) {
      throw new Error('已保留当前输入，请核对服务器内容后再继续。');
    }
    // Retain the server identity before upload/publish can fail.
    snapshot.editingId = result.item.id;
    snapshot.baseUpdatedAt = result.item.updatedAt ?? '';
    snapshot.savedFile = result.item.file ?? null;
    let revision = activeDraftRevision.value;
    const saveProgress = () => {
      const cached = saveAdminDraft(scope, snapshot, undefined, revision);
      if (cached.ok) {
        revision = cached.draft.revision;
        if (stillCurrent()) { activeDraftRevision.value = revision; localDrafts.value = cached.drafts; }
      } else if (stillCurrent()) draftStatus.value = cached.message;
    };
    saveProgress();
    if (stillCurrent()) {
      editingId.value = result.item.id;
      editorItemSnapshot.value = result.item;
      editorBaseUpdatedAt.value = snapshot.baseUpdatedAt;
    }
    if (result.replayed) {
      result = await activeApiClient.value.updateContent(snapshot.editingId, { ...input, expectedUpdatedAt: snapshot.baseUpdatedAt });
      if (!result.ok) throw new Error(result.message || '保存失败，请重试。');
      snapshot.baseUpdatedAt = result.item.updatedAt ?? '';
      saveProgress();
      if (stillCurrent()) { editorItemSnapshot.value = result.item; editorBaseUpdatedAt.value = snapshot.baseUpdatedAt; }
    }
    if (file) {
      if (stillCurrent()) notice.value = '正在上传 PDF...';
      result = await activeApiClient.value.uploadPdf(snapshot.editingId, file);
      if (!result.ok) throw new Error(result.message || 'PDF 上传失败，请重试。');
      snapshot.pendingFileName = '';
      snapshot.savedFile = result.item.file ?? null;
      snapshot.baseUpdatedAt = result.item.updatedAt ?? snapshot.baseUpdatedAt;
      if (stillCurrent()) {
        hydratingForm = true; pendingFile.value = null; hydratingForm = false;
        rememberedFileName.value = '';
        editorItemSnapshot.value = result.item;
        editorBaseUpdatedAt.value = snapshot.baseUpdatedAt;
      }
      saveProgress();
    }
    if (mode !== 'draft') {
      if (stillCurrent()) notice.value = '正在发布...';
      result = await activeApiClient.value.publishContent(snapshot.editingId);
      if (!result.ok) throw new Error(result.message || '发布失败，请重试。');
    }
    clearTimeout(draftTimer);
    const removed = removeAdminDraft(scope, snapshot.key, undefined, revision);
    if (!stillCurrent()) return;
    if (removed.ok) localDrafts.value = removed.drafts;
    draftStatus.value = removed.ok ? '' : removed.message;
    dirty.value = false;
    activeDraftKey.value = '';
    if (mode === 'publish-next') {
      selectedCourseCode.value = snapshot.form.courseCode;
      selectedType.value = snapshot.form.type;
      setForm({ courseCode: snapshot.form.courseCode, type: snapshot.form.type,
        sourcePlatform: snapshot.form.sourcePlatform, bodyFormat: snapshot.form.bodyFormat });
      editingId.value = '';
      beginDraftContext();
      editorOpen.value = true;
      notice.value = result.persistenceWarning || '已发布，可以录入下一条。';
    } else {
      editorOpen.value = false;
      editingId.value = '';
      notice.value = result.persistenceWarning || (mode === 'draft' ? '内容已保存。' : '内容已发布。');
    }
    // A refresh error must not undo a completed publication or reset the next entry.
    const refreshed = await activeApiClient.value.fetchContent({ courseCode: snapshot.form.courseCode, type: snapshot.form.type, status: '' });
    if (refreshed.ok && !disposed && draftScope.value === scope) items.value = refreshed.items ?? [];
  } catch (error) {
    if (stillCurrent()) { notice.value = error.message || '处理失败，请重试。'; dirty.value = true; persistDraft(); }
  } finally { if (!disposed && draftScope.value === scope) actionBusy.value = false; }
}

async function saveDraft() { return saveContent('draft'); }

function editSubmission(item) {
  if (actionBusy.value || !preserveEditorBeforeLeaving()) return;
  editorOpen.value = false;
  editingSubmissionId.value = item.id;
  Object.assign(submissionForm, emptyForm(), item, normalizeContentSource(item));
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
    await refreshItems();
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
  if (result.ok) await refreshItems();
  actionBusy.value = false;
}

async function rejectCurrentSubmission(item = null) {
  const target = item ?? submissions.value.find((entry) => entry.id === editingSubmissionId.value);
  if (!rejectionNote.value.trim()) {
    notice.value = '请先填写拒绝原因。';
    return;
  }
  if (!target || !window.confirm(`拒绝“${target.title}”吗？`)) return;
  actionBusy.value = true;
  const result = await activeApiClient.value.rejectSubmission(target.id, rejectionNote.value);
  notice.value = mutationNotice(result, '投稿已拒绝。');
  if (result.ok) submissionEditorOpen.value = false;
  await refreshSubmissions();
  if (result.ok) await refreshItems();
  actionBusy.value = false;
}

function submissionFileUrl(item) {
  return publicApiPath(`/api/admin/submissions/${encodeURIComponent(item.id)}/file`);
}

async function publishItem() {
  return saveContent('publish');
}

async function archiveItem(item = editingItem.value) {
  if (actionBusy.value || !item || !preserveEditorBeforeLeaving() || !window.confirm(`确定下架“${item.title}”吗？`)) {
    return;
  }
  actionBusy.value = true;
  const result = await activeApiClient.value.archiveContent(item.id);
  notice.value = mutationNotice(result, '内容已下架。');
  if (result.ok && editorOpen.value && editingId.value === item.id) {
    editorItemSnapshot.value = result.item;
    editorBaseUpdatedAt.value = result.item.updatedAt ?? '';
    persistDraft();
  }
  await refreshItems();
  actionBusy.value = false;
}

async function removePdf() {
  if (actionBusy.value || !editingId.value || !window.confirm('确定移除当前 PDF 吗？')) {
    return;
  }
  actionBusy.value = true;
  const result = await activeApiClient.value.removePdf(editingId.value);
  notice.value = mutationNotice(result, 'PDF 已移除。');
  if (result.ok) {
    editorItemSnapshot.value = result.item;
    editorBaseUpdatedAt.value = result.item.updatedAt ?? '';
    persistDraft();
  }
  await refreshItems();
  actionBusy.value = false;
}

function formattedTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

defineExpose({ canLeave: () => actionBusy.value ? false : selectedView.value === 'notices' ? (noticePanel.value?.canLeave() ?? true) : preserveEditorBeforeLeaving() });
onMounted(() => { initialize(); badgeTimer = setInterval(refreshPendingBadges, 30000); document.addEventListener('visibilitychange', refreshPendingBadges); window.addEventListener('pagehide', onPageHide); window.addEventListener('beforeunload', onBeforeUnload); });
onBeforeUnmount(() => { persistDraft(); disposed = true; clearTimeout(draftTimer); clearInterval(badgeTimer); ++badgeSequence; ++feedbackSequence; ++feedbackCountSequence; document.removeEventListener('visibilitychange', refreshPendingBadges); window.removeEventListener('pagehide', onPageHide); window.removeEventListener('beforeunload', onBeforeUnload); });
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
          {{ type.label }} <span v-if="pendingTypes.has(type.id)" class="admin-pending-dot admin-sidebar-dot" title="有待审核投稿" aria-hidden="true"></span>
        </button>
        <button type="button" :class="{ 'is-active': selectedView === 'activities' }" @click="changeView('activities')">
          活动管理
        </button>
        <button type="button" :class="{ 'is-active': selectedView === 'notices' }" @click="changeView('notices')">通知</button>
        <button type="button" :class="{ 'is-active': selectedView === 'more' }" @click="changeView('more')">更多<span v-if="pendingHomepages" class="admin-pending-dot admin-sidebar-dot" title="有待审核主页投稿" aria-hidden="true"></span></button>
        <button type="button" :class="{ 'is-active': selectedView === 'feedback' }" @click="changeView('feedback')">意见反馈<span v-if="feedbackUnread" class="admin-pending-dot admin-sidebar-dot" title="有未读意见反馈" aria-hidden="true"></span></button>
        <button type="button" :class="{ 'is-active': selectedView === 'consultation' }" @click="changeView('consultation')">咨询室</button>
        <button type="button" :class="{ 'is-active': selectedView === 'logs' }" @click="changeView('logs')">操作日志</button>
      </nav>
      <button v-if="currentUser" class="admin-page__logout" type="button" @click="logout">退出登录</button>
    </aside>

    <main class="admin-page__content">
      <section v-if="!isAdmin" class="admin-auth" aria-labelledby="admin-title">
        <div>
          <p class="admin-page__eyebrow">生科智学管理端</p>
          <h1 id="admin-title">{{ authMode === 'login' ? '管理员登录' : '首次注册' }}</h1>
          <p>使用已加入管理员学号白名单的浙大邮箱账号进入资源维护平台。</p>
        </div>
        <div class="admin-auth__modes" role="tablist" aria-label="登录方式">
          <button type="button" :class="{ 'is-active': authMode === 'login' }" @click="authMode = 'login'">管理员登录</button>
          <button type="button" :class="{ 'is-active': authMode === 'register' }" @click="authMode = 'register'">首次注册</button>
        </div>
        <form class="admin-auth__form" @submit.prevent="submitAuth">
          <label v-if="authMode === 'register'">
            <span>昵称</span>
            <input v-model.trim="credentials.nickname" required minlength="2" maxlength="20" autocomplete="nickname">
          </label>
          <label>
            <span>管理员学号</span>
            <span class="admin-auth__student-id">
              <input v-model.trim="credentials.studentId" required inputmode="numeric" pattern="[0-9]+" autocomplete="username">
              <strong>@zju.edu.cn</strong>
            </span>
          </label>
          <label v-if="authMode === 'register'">
            <span>邮箱验证码</span>
            <span class="admin-auth__code">
              <input v-model.trim="credentials.code" required inputmode="numeric" maxlength="6" autocomplete="one-time-code">
              <button type="button" :disabled="authBusy || !credentials.studentId" @click="requestAdminEmailCode">发送验证码</button>
            </span>
          </label>
          <label>
            <span>密码</span>
            <input v-model="credentials.password" type="password" required minlength="8" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'">
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
            <p class="admin-page__eyebrow">{{ selectedView === 'notices' ? '通知内容运营' : selectedView === 'more' ? '更多内容' : '课程内容运营' }}</p>
            <h1 id="admin-title">{{ pageTitle }}</h1>
          </div>
          <button v-if="selectedView === 'content' && !editorOpen && !submissionEditorOpen" class="admin-primary-action" type="button" @click="startNew">新增内容</button>
          <button v-if="selectedView === 'activities' && !activityEditorOpen" class="admin-primary-action" type="button" @click="startActivity()">新增推文</button>
          <button v-if="selectedView === 'more' && !homepageEditorOpen" class="admin-primary-action" type="button" @click="startHomepage()">新增主页</button>
        </header>

        <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

        <section v-if="selectedView === 'content' && editorOpen" class="admin-editor admin-course-editor" aria-label="内容编辑器">
          <header class="admin-editor__head">
            <div>
              <span>{{ editingId ? '编辑内容' : '新建草稿' }}</span>
              <strong>{{ form.title || selectedTypeLabel }}</strong>
              <small>操作管理员：{{ currentUser.nickname }}</small>
            </div>
            <button type="button" :disabled="actionBusy" @click="closeEditor">关闭</button>
          </header>

          <form class="admin-editor__form" @submit.prevent="saveContent($event.submitter?.value || 'draft')">
            <fieldset class="admin-entry-fields" :disabled="actionBusy">
            <label>
              <span>专业</span>
              <select v-model="selectedMajorId" :disabled="Boolean(editingId)" @change="changeMajor">
                <option v-for="major in majorOptions" :key="major.id" :value="major.id">{{ major.label }}</option>
              </select>
            </label>
            <label>
              <span>课程</span>
              <AdminCourseCombobox
                v-model="form.courseCode"
                :courses="majorCourses"
                :pending-course-codes="allPendingCourseCodes"
                :disabled="Boolean(editingId)"
                required
                @change="dirty = true"
              />
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
            <label>
              <span>作者或整理者</span>
              <input v-model.trim="form.author" maxlength="40">
            </label>
            <label>
              <span>来源平台</span>
              <select v-model="form.sourcePlatform"><option value="cc98">CC98</option><option value="duoduo">朵朵</option><option value="other">其他</option></select>
            </label>
            <label>
              <span>原帖链接（选填）</span>
              <input v-model.trim="form.sourceUrl" type="url" placeholder="https://">
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
            <label>
              <span>老师姓名（选填）</span>
              <TeacherNameInput v-model="form.teacher" :names="courseTeacherNames(form.courseCode)" />
            </label>
            <label class="admin-editor__wide">
              <span>正文</span>
              <select v-model="form.bodyFormat" aria-label="内容格式"><option value="markdown">Markdown</option><option value="ubb">UBB</option></select>
              <textarea v-model="form.body" aria-label="正文" rows="10" maxlength="100000"></textarea>
            </label>
            <label v-if="['material', 'paper'].includes(form.type)" class="admin-editor__wide admin-file-field">
              <span>PDF 文件</span>
              <input ref="fileInput" type="file" accept="application/pdf,.pdf" @change="selectPdf">
              <small v-if="pendingFile">待上传：{{ pendingFile.name }}</small>
              <small v-else-if="rememberedFileName">请重新选择：{{ rememberedFileName }}</small>
              <span v-else-if="editingItem?.file" class="admin-file-field__current">
                <a :href="editingItem.file.url" target="_blank" rel="noreferrer">{{ editingItem.file.fileName }}</a>
                <button type="button" :disabled="actionBusy" @click="removePdf">移除 PDF</button>
              </span>
            </label>

            </fieldset>
            <footer class="admin-editor__actions">
              <span v-if="draftStatus" class="admin-draft-status" role="status">{{ draftStatus }}</span>
              <button type="button" :disabled="actionBusy" @click="closeEditor">返回列表</button>
              <button type="submit" value="draft" :disabled="actionBusy">{{ editingId ? '保存修改' : '保存草稿' }}</button>
              <button
                v-if="editingItem?.status !== 'published'"
                class="admin-primary-action" type="submit" value="publish" :disabled="actionBusy"
              >
                发布
              </button>
              <button type="submit" value="publish-next" class="admin-primary-action" :disabled="actionBusy">发布并录入下一条</button>
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

        <section v-else-if="selectedView === 'content' && submissionEditorOpen" class="admin-editor admin-submission-editor" aria-label="审核课程投稿">
          <header class="admin-editor__head">
            <div>
              <span>{{ selectedTypeLabel }} · {{ submissionForm.courseCode }} · {{ submissionForm.submitterName }} · {{ formattedTime(submissionForm.createdAt) }}</span>
              <strong>{{ submissionForm.title || submissionForm.year || '审核投稿' }}</strong>
            </div>
            <button type="button" @click="submissionEditorOpen = false">关闭</button>
          </header>
          <form class="admin-editor__form" @submit.prevent="saveSubmission">
            <label v-if="submissionForm.type !== 'paper'" class="admin-editor__wide"><span>标题</span><input v-model.trim="submissionForm.title" required maxlength="80" :readonly="submissionForm.status !== 'pending'"></label>
            <label v-if="submissionForm.type !== 'paper'" class="admin-editor__wide"><span>副标题（选填）</span><input v-model.trim="submissionForm.summary" maxlength="200" :readonly="submissionForm.status !== 'pending'"></label>
            <template v-if="submissionForm.type === 'paper'">
              <label><span>年份</span><input v-model.trim="submissionForm.year" required maxlength="20" :readonly="submissionForm.status !== 'pending'"></label>
            </template>
            <label><span>老师姓名（选填）</span><TeacherNameInput v-model="submissionForm.teacher" :names="courseTeacherNames(submissionForm.courseCode)" :readonly="submissionForm.status !== 'pending'" /></label>
            <label><span>名称（选填）</span><input v-model.trim="submissionForm.author" maxlength="40" :readonly="submissionForm.status !== 'pending'"></label>
            <label><span>来源平台</span><select v-model="submissionForm.sourcePlatform" :disabled="submissionForm.status !== 'pending'"><option value="cc98">CC98</option><option value="duoduo">朵朵</option><option value="other">其他</option></select></label>
            <label><span>原帖链接（选填）</span><input v-model.trim="submissionForm.sourceUrl" type="url" :readonly="submissionForm.status !== 'pending'"></label>
            <label v-if="submissionForm.type === 'experience'"><span>成绩百分制（选填）</span><input v-model.trim="submissionForm.gradePercentage" type="number" min="0" max="100" :readonly="submissionForm.status !== 'pending'"></label>
            <label v-if="submissionForm.type === 'material'"><span>资料链接（选填）</span><input v-model.trim="submissionForm.externalUrl" type="url" :readonly="submissionForm.status !== 'pending'"></label>
            <template v-if="submissionForm.type !== 'paper'">
              <label><span>内容格式</span><select v-model="submissionForm.bodyFormat" :disabled="submissionForm.status !== 'pending'"><option value="markdown">Markdown</option><option value="ubb">UBB</option></select></label>
              <label class="admin-editor__wide"><span>内容</span><textarea v-model="submissionForm.body" rows="10" :readonly="submissionForm.status !== 'pending'"></textarea></label>
            </template>
            <p v-if="submissionForm.file" class="admin-editor__wide admin-submission-file"><span>PDF 文件</span><a :href="submissionFileUrl(submissionForm)" target="_blank" rel="noopener noreferrer">{{ submissionForm.file.fileName }} · 打开预览</a></p>
            <p v-else-if="submissionForm.type === 'paper'" class="admin-editor__wide admin-list__empty">这份试卷投稿没有 PDF，不能通过审核。</p>
            <label v-if="submissionForm.status === 'pending'" class="admin-editor__wide"><span>拒绝原因</span><textarea v-model.trim="rejectionNote" rows="3" maxlength="500" placeholder="拒绝时必须填写，作者将看到这条说明。"></textarea></label>
            <p v-else-if="submissionForm.reviewNote" class="admin-editor__wide">审核备注：{{ submissionForm.reviewNote }}</p>
            <footer class="admin-editor__actions">
              <button type="button" @click="submissionEditorOpen = false">返回列表</button>
              <button v-if="submissionForm.status === 'pending'" type="submit" :disabled="actionBusy">保存修改</button>
              <button v-if="submissionForm.status === 'pending'" class="admin-danger-action" type="button" :disabled="actionBusy" @click="rejectCurrentSubmission()">拒绝并说明理由</button>
              <button v-if="submissionForm.status === 'pending'" class="admin-primary-action" type="button" :disabled="actionBusy || (submissionForm.type === 'paper' && !submissionForm.file)" @click="approveCurrentSubmission()">通过并发布</button>
            </footer>
          </form>
        </section>

        <section v-else-if="selectedView === 'content'" class="admin-list" aria-label="课程内容列表">
          <section v-if="localDrafts.length" class="admin-local-drafts" aria-label="本机未完成草稿">
            <h2>未完成草稿 <span>{{ localDrafts.length }}</span></h2>
            <div v-for="draft in localDrafts" :key="draft.key" class="admin-local-draft-row">
              <div><strong>{{ draft.form.title || '未命名内容' }}</strong><small>{{ draft.form.courseCode }} · {{ contentTypes.find((type) => type.id === draft.form.type)?.label }} · {{ formattedTime(draft.updatedAt) }}</small></div>
              <button type="button" :disabled="actionBusy" @click="restoreLocalDraft(draft)">继续录入</button>
              <button type="button" :disabled="actionBusy" @click="discardLocalDraft(draft)">删除草稿</button>
            </div>
          </section>
          <div class="admin-list__filters admin-list__filters--course">
            <label>
              <span>专业</span>
              <select v-model="selectedMajorId" @change="changeMajor">
                <option v-for="major in majorOptions" :key="major.id" :value="major.id">{{ major.label }}</option>
              </select>
            </label>
            <label>
              <span>课程 <span v-if="visiblePendingCourseCodes.length" class="admin-pending-dot" title="有待审核投稿" aria-label="有待审核投稿"></span></span>
              <AdminCourseCombobox
                v-model="selectedCourseCode"
                :courses="majorCourses"
                :pending-course-codes="pendingCourseCodes"
                :pending-course-order="pendingCourseCodes"
                @change="selectCourseForReview"
              />
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

          <p v-if="!selectedCourseCode" class="admin-list__empty">请先输入课程代码或名称并选择课程。</p>
          <p v-else-if="listBusy" class="admin-list__empty">正在读取内容...</p>
          <p v-else-if="!filteredRows.length" class="admin-list__empty">当前筛选条件下暂无内容。</p>
          <div v-else class="admin-content-table" role="table" aria-label="课程内容">
            <div class="admin-content-table__head" role="row">
              <span>标题</span><span>状态</span><span>更新时间</span><span>操作</span>
            </div>
            <article v-for="item in filteredRows" :key="`${item.rowKind}-${item.id}`" class="admin-content-table__row" role="row">
              <div>
                <strong>{{ item.title || item.year }}</strong>
                <small>{{ item.rowKind === 'submission' ? `投稿人：${item.submitterName || '未知'} · ${item.summary || item.year || '待审核资料'}` : (item.summary || '暂无摘要') }}</small>
              </div>
              <span class="admin-status" :data-status="item.status">{{ item.rowKind === 'submission' ? submissionStatusLabels[item.status] : statusLabels[item.status] }}</span>
              <time :datetime="item.rowKind === 'submission' ? item.createdAt : item.updatedAt">{{ formattedTime(item.rowKind === 'submission' ? item.createdAt : item.updatedAt) }}</time>
              <div class="admin-content-table__actions">
                <button type="button" @click="item.rowKind === 'submission' ? editSubmission(item) : editItem(item)">{{ item.rowKind === 'submission' ? (item.status === 'pending' ? '审核' : '查看') : '编辑' }}</button>
                <button v-if="item.rowKind === 'content' && item.status === 'published'" type="button" @click="archiveItem(item)">下架</button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="selectedView === 'activities' && activityEditorOpen" class="admin-editor" aria-label="活动编辑器">
          <header class="admin-editor__head">
            <div>
              <span>{{ activityProgramLabel(activityForm.programId) }}</span>
              <strong>{{ activityForm.title || '新推文' }}</strong>
            </div>
            <button type="button" @click="closeActivityEditor">关闭</button>
          </header>
          <form class="admin-editor__form" @input="dirty = true" @submit.prevent="saveActivity">
            <label class="admin-editor__wide">
              <span>标题</span>
              <input v-model.trim="activityForm.title" required maxlength="120" placeholder="粘贴公众号推文标题">
            </label>
            <label class="admin-editor__wide">
              <span>封面</span>
              <input v-model.trim="activityForm.imageUrl" required type="text" list="activity-image-options" placeholder="填写 https:// 图片地址或选择已有封面">
              <datalist id="activity-image-options">
                <option v-for="image in activityImageOptions" :key="image.value" :value="image.value">{{ image.label }}</option>
              </datalist>
            </label>
            <label class="admin-editor__wide">
              <span>推文链接</span>
              <input v-model.trim="activityForm.externalUrl" required type="url" placeholder="https://mp.weixin.qq.com/s/...">
            </label>
            <label class="admin-editor__wide admin-activity-featured">
              <input v-model="activityForm.featured" type="checkbox">
              <span>在首页“近期活动”展示</span>
            </label>
            <footer class="admin-editor__actions">
              <button type="button" @click="closeActivityEditor">放弃修改</button>
              <button class="admin-primary-action" type="submit" :disabled="actionBusy">
                {{ editingActivityId ? '保存修改' : '添加到目录' }}
              </button>
            </footer>
          </form>
        </section>

        <section v-else-if="selectedView === 'activities'" class="admin-list" aria-label="活动管理列表">
          <div class="admin-activity-programs" aria-label="活动板块">
            <button
              v-for="program in activityPrograms"
              :key="program.id"
              type="button"
              :class="{ 'is-active': activityProgramId === program.id }"
              @click="activityProgramId = program.id; refreshActivities()"
            >
              {{ program.label }}
            </button>
          </div>
          <div class="admin-list__filters admin-list__filters--wide">
            <label>
              <span>搜索推文</span>
              <input v-model.trim="activityQuery" type="search" placeholder="输入标题" @change="refreshActivities">
            </label>
          </div>
          <p v-if="listBusy" class="admin-list__empty">正在读取推文...</p>
          <p v-else-if="!activities.length && !activityQuery && activityCurrentProgram?.placeholder" class="admin-list__empty">{{ activityCurrentProgram.placeholder.title }} · {{ activityCurrentProgram.placeholder.message }}</p>
          <p v-else-if="!activities.length" class="admin-list__empty">“{{ activityProgramLabel(activityProgramId) }}”暂未添加推文。</p>
          <div v-else class="admin-content-table" role="table" aria-label="活动内容">
            <div class="admin-content-table__head" role="row">
              <span>推文</span><span>板块</span><span>添加时间</span><span>操作</span>
            </div>
            <article v-for="activity in activities" :key="activity.id" class="admin-content-table__row" role="row">
              <div class="admin-activity-title">
                <img :src="activityImage(activity.imageUrl)" alt="">
                <div><strong>{{ activity.title }}</strong><small v-if="activity.featured">首页展示</small></div>
              </div>
              <span>{{ activityProgramLabel(activity.programId) }}</span>
              <time :datetime="activity.createdAt">{{ formattedTime(activity.createdAt) }}</time>
              <div class="admin-content-table__actions">
                <button type="button" @click="editActivity(activity)">编辑</button>
                <a :href="activity.externalUrl" target="_blank" rel="noopener noreferrer">查看</a>
                <button type="button" @click="archiveManagedActivity(activity)">移除</button>
              </div>
            </article>
          </div>
        </section>

        <NoticeAdminPanel v-else-if="selectedView === 'notices'" ref="noticePanel" :is-demo="isDemo" />

        <section v-else-if="selectedView === 'more'" class="admin-list" aria-label="更多管理">
          <nav class="admin-more-tabs" role="tablist" aria-label="更多栏目"><button type="button" role="tab" aria-selected="true">同学主页<span v-if="pendingHomepages" class="admin-pending-dot admin-sidebar-dot" title="有待审核主页投稿" aria-hidden="true"></span></button></nav>
          <section v-if="homepageEditorOpen" class="admin-editor">
            <header class="admin-editor__head"><div><span>同学主页</span><strong>{{ editingHomepageId ? '编辑主页' : '新增主页' }}</strong></div><button type="button" @click="homepageEditorOpen = false">关闭</button></header>
            <form class="admin-editor__form" @submit.prevent="saveHomepage">
              <label><span>名称</span><input v-model.trim="homepageForm.name" required maxlength="40"></label>
              <label><span>排序</span><input v-model.number="homepageForm.sortOrder" type="number"></label>
              <label class="admin-editor__wide"><span>主页链接</span><input v-model.trim="homepageForm.href" type="url" placeholder="https://（占位条目可留空）"></label>
              <label class="admin-editor__wide"><span>头像</span><input type="file" accept="image/png,image/jpeg,image/webp" @change="selectAdminHomepageAvatar"></label>
              <img v-if="homepageForm.avatarUrl" class="admin-homepage-avatar" :src="homepageForm.avatarUrl.startsWith('data:') || homepageForm.avatarUrl.startsWith('/zjubio/') ? homepageForm.avatarUrl : publicAssetPath(homepageForm.avatarUrl)" alt="头像预览">
              <label><span>状态</span><select v-model="homepageForm.status"><option value="approved">显示</option><option value="pending">隐藏</option></select></label>
              <footer class="admin-editor__actions"><button type="button" @click="homepageEditorOpen = false">取消</button><button class="admin-primary-action" type="submit" :disabled="actionBusy">保存</button></footer>
            </form>
          </section>
          <h2>主页目录</h2>
          <p v-if="!homepages.length" class="admin-list__empty">暂无主页。</p>
          <div v-for="item in homepages" :key="item.id" class="admin-homepage-row">
            <img v-if="item.avatarUrl" :src="item.avatarUrl.startsWith('data:') || item.avatarUrl.startsWith('/zjubio/') ? item.avatarUrl : publicAssetPath(item.avatarUrl)" alt="">
            <span v-else class="admin-homepage-avatar"></span>
            <div><strong>{{ item.name }}</strong><a v-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.href }}</a><small v-else>占位条目</small></div>
            <span>{{ item.status === 'approved' ? '显示' : '隐藏' }}</span>
            <button type="button" @click="startHomepage(item)">编辑</button>
            <button type="button" :disabled="actionBusy" @click="removeHomepage(item)">移除</button>
          </div>
          <h2>投稿审核</h2>
          <p v-if="!homepageApplications.filter(item => item.status === 'pending').length" class="admin-list__empty">暂无待审核投稿。</p>
          <div v-for="item in homepageApplications.filter(entry => entry.status === 'pending')" :key="item.id" class="admin-homepage-row">
            <img v-if="item.avatarUrl" :src="item.avatarUrl" alt="">
            <span v-else class="admin-homepage-avatar"></span>
            <div><strong>{{ item.name }}</strong><a :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.href }}</a><small>投稿人：{{ item.applicantNickname }}</small></div>
            <button type="button" :disabled="actionBusy" @click="decideHomepageApplication(item, 'approve')">通过</button>
            <button type="button" :disabled="actionBusy" @click="decideHomepageApplication(item, 'reject')">拒绝</button>
          </div>
        </section>

        <section v-else-if="selectedView === 'feedback'" class="admin-feedback" aria-label="意见反馈管理">
          <header class="admin-feedback-toolbar"><span>共 {{ feedbackTotal }} 条</span><button type="button" :disabled="feedbackBusy" @click="refreshFeedback(feedbackPage)">刷新</button></header>
          <p v-if="feedbackBusy" class="admin-list__empty">正在读取意见...</p>
          <p v-else-if="!feedbackItems.length" class="admin-list__empty">暂无意见反馈。</p>
          <article v-for="item in feedbackItems" v-else :key="item.id" class="admin-feedback-item">
            <header><strong>{{ item.authorName || '游客' }}</strong><time :datetime="item.createdAt">{{ formattedTime(item.createdAt) }}</time></header>
            <p>{{ item.body }}</p>
          </article>
          <nav v-if="feedbackTotal > 50" class="admin-feedback-pages" aria-label="反馈分页">
            <button type="button" :disabled="feedbackBusy || feedbackPage === 1" @click="refreshFeedback(feedbackPage - 1)">上一页</button>
            <span>第 {{ feedbackPage }} / {{ Math.ceil(feedbackTotal / 50) }} 页</span>
            <button type="button" :disabled="feedbackBusy || feedbackPage * 50 >= feedbackTotal" @click="refreshFeedback(feedbackPage + 1)">下一页</button>
          </nav>
        </section>
        <section v-else-if="selectedView === 'consultation'" class="admin-consultation" aria-label="咨询室管理">
          <p v-if="isDemo" class="admin-list__empty">演示管理员不能开启真实咨询室。请使用正式管理员账号操作。</p>
          <template v-else>
            <div class="admin-consultation__status" aria-live="polite">
              <div>
                <span class="admin-status" :data-status="consultationStatus?.open ? 'published' : 'archived'">
                  {{ consultationStatus?.open ? '开放中' : consultationScheduled ? '已安排' : '未开放' }}
                </span>
                <strong v-if="consultationStatus?.mentor">指导学长：{{ consultationStatus.mentor.nickname }}</strong>
                <strong v-else>尚未安排指导学长</strong>
                <p v-if="consultationScheduled">
                  {{ consultationDate(consultationStatus.startsAt) }} 至 {{ consultationDate(consultationStatus.endsAt) }}
                </p>
              </div>
              <button v-if="consultationScheduled" class="admin-danger-action" type="button" :disabled="consultationBusy" @click="closeConsultation">提前关闭</button>
            </div>

            <p v-if="consultationNotice" class="admin-notice" role="status">{{ consultationNotice }}</p>

            <form class="admin-consultation__form" @submit.prevent="saveConsultation">
              <fieldset :disabled="consultationBusy">
                <legend>安排咨询室</legend>
                <div class="admin-consultation__fields">
                  <div class="admin-consultation__mentor">
                    <label for="admin-mentor-query">指导学长</label>
                    <div class="admin-consultation__search">
                      <input id="admin-mentor-query" v-model.trim="candidateQuery" type="search" placeholder="搜索昵称或学号" @keydown.enter.prevent="searchMentorCandidates">
                      <button type="button" :disabled="candidateBusy" @click="searchMentorCandidates">搜索</button>
                    </div>
                    <p v-if="selectedMentor" class="admin-consultation__selected">已选择：{{ selectedMentor.nickname }}<span v-if="selectedMentor.studentId">（{{ selectedMentor.studentId }}）</span></p>
                    <div v-if="candidates.length" class="admin-consultation__candidates" role="listbox" aria-label="可选指导学长">
                      <button
                        v-for="candidate in candidates"
                        :key="candidate.id"
                        type="button"
                        role="option"
                        :aria-selected="selectedMentor?.id === candidate.id"
                        :class="{ 'is-selected': selectedMentor?.id === candidate.id }"
                        @click="selectedMentor = candidate"
                      >
                        <span>{{ candidate.nickname }}</span><small>{{ candidate.studentId }}</small>
                      </button>
                    </div>
                    <p v-else-if="!candidateBusy" class="admin-consultation__hint">没有找到可选用户。</p>
                  </div>
                  <label>开始时间<input v-model="consultationForm.startsAt" type="datetime-local" required></label>
                  <label>结束时间<input v-model="consultationForm.endsAt" type="datetime-local" required></label>
                </div>
                <div class="admin-consultation__actions">
                  <button class="admin-primary-action" type="submit" :disabled="!selectedMentor || consultationBusy">
                    {{ consultationBusy ? '正在保存...' : consultationScheduled ? '更新安排' : '开启咨询室' }}
                  </button>
                </div>
              </fieldset>
            </form>
          </template>
        </section>

        <section v-else class="admin-list" aria-label="操作日志">
          <div class="admin-list__filters admin-list__filters--wide admin-list__filters--course">
            <label>
              <span>专业</span>
              <select v-model="selectedMajorId" @change="changeMajor">
                <option v-for="major in majorOptions" :key="major.id" :value="major.id">{{ major.label }}</option>
              </select>
            </label>
            <label>
              <span>课程</span>
              <AdminCourseCombobox
                v-model="selectedCourseCode"
                :courses="majorCourses"
                :pending-course-codes="pendingCourseCodes"
                allow-all
                @change="refreshAuditLogs"
              />
            </label>
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
