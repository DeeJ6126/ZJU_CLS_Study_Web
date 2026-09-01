<script setup>
import { computed, ref, watch } from 'vue';
import { buildCourseRoute } from '../../data/courses/resourcePaths.js';

const props = defineProps({
  profile: { type: Object, default: null },
  posts: { type: Array, default: () => [] },
  submissions: { type: Array, default: () => [] },
  courses: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] },
  comments: { type: Array, default: () => [] },
  courseImportPreview: { type: Object, default: null },
  isOwn: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  notice: { type: String, default: '' },
  nicknameLocked: { type: Boolean, default: false },
  cc98Bound: { type: Boolean, default: false },
  grade: { type: Number, default: null },
  isDemo: { type: Boolean, default: false },
});

const emit = defineEmits([
  'save-nickname', 'save-grade', 'upload-avatar', 'remove-avatar', 'archive-post', 'submit-revision',
  'resubmit', 'bind-cc98', 'preview-course-schedule', 'replace-courses', 'remove-course',
  'remove-favorite', 'edit-comment', 'delete-comment', 'edit-submission', 'withdraw-submission',
  'delete-submission',
]);
const activeSection = ref('profile');
const nickname = ref('');
const grade = ref('');
const editingPostId = ref('');
const revision = ref({ title: '', summary: '', body: '' });
const cc98Code = ref('');
const currentPassword = ref('');
const editingSubmissionId = ref('');
const submissionDraft = ref({ title: '', summary: '', body: '' });

const GRADE_OPTIONS = [
  { value: '', label: '未设置' },
  { value: '2024', label: '2024 级' },
  { value: '2025', label: '2025 级' },
  { value: '2026', label: '2026 级' },
];

const visiblePosts = computed(() => props.posts.filter((post) => (
  props.isOwn || post.status === 'published' || !post.status
)));
watch(() => props.profile?.nickname, (value) => { nickname.value = value ?? ''; }, { immediate: true });
watch(() => props.grade, (value) => {
  grade.value = value == null ? '' : String(value);
}, { immediate: true });

function chooseAvatar(event) {
  const file = event.target.files?.[0];
  if (file) emit('upload-avatar', file);
  event.target.value = '';
}
function chooseSchedule(event) {
  const file = event.target.files?.[0];
  if (file) emit('preview-course-schedule', file);
  event.target.value = '';
}
function startRevision(post) {
  editingPostId.value = post.id;
  revision.value = { title: post.title, summary: post.summary ?? '', body: post.body ?? '' };
}
function submitRevision(post) {
  emit('submit-revision', { post, changes: { ...revision.value } });
  editingPostId.value = '';
}
function startSubmissionEdit(submission) {
  editingSubmissionId.value = submission.id;
  submissionDraft.value = {
    title: submission.title,
    summary: submission.summary ?? '',
    body: submission.body ?? '',
  };
}
function saveSubmission(submission) {
  const event = submission.status === 'rejected' ? 'resubmit' : 'edit-submission';
  emit(event, { submission, changes: { ...submissionDraft.value } });
  editingSubmissionId.value = '';
}
function saveGrade() {
  const next = grade.value === '' ? null : Number(grade.value);
  emit('save-grade', next);
}
function contentHref(item) {
  const tab = { experience: 'experiences', material: 'materials', paper: 'papers' }[item.type];
  return buildCourseRoute(item.courseCode, tab, item.routeId || item.id);
}
function statusLabel(status) {
  return { draft: '草稿', published: '已发布', archived: '已下架', pending: '审核中', approved: '已通过', rejected: '未通过', withdrawn: '已撤回' }[status] ?? status;
}
</script>

<template>
  <article class="profile-page">
    <aside class="profile-sidebar">
      <a href="#home">返回首页</a>
      <template v-if="isOwn">
        <button v-for="section in [
          ['profile', '账号资料'], ['courses', '我的课程'], ['favorites', '我的收藏'],
          ['posts', '我的帖子'], ['comments', '我的评论'],
        ]" :key="section[0]" :class="{ 'is-active': activeSection === section[0] }" type="button" @click="activeSection = section[0]">{{ section[1] }}</button>
      </template>
      <strong v-else>个人</strong>
    </aside>

    <main class="profile-main">
      <p v-if="loading" class="profile-state">正在加载个人...</p>
      <p v-else-if="error" class="profile-state is-error">{{ error }}</p>
      <template v-else-if="profile">
        <p v-if="isDemo" class="profile-demo-notice">演示数据仅保存在当前浏览器，不会提交到服务器。</p>
        <p v-if="notice" class="profile-notice">{{ notice }}</p>
        <section v-if="!isOwn || activeSection === 'profile'" class="profile-identity">
          <div class="profile-avatar-block">
            <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="`${profile.nickname}的头像`" />
            <span v-else>{{ profile.nickname?.slice(0, 1) || '学' }}</span>
            <label v-if="isOwn" class="profile-file-button">上传头像<input type="file" accept="image/jpeg,image/png,image/webp" @change="chooseAvatar" /></label>
            <button v-if="isOwn && profile.avatarUrl" type="button" class="profile-text-button" @click="emit('remove-avatar')">移除头像</button>
          </div>
          <div>
            <p>生科智学用户</p><h1>{{ profile.nickname }}</h1>
            <form v-if="isOwn && !nicknameLocked" class="profile-nickname-form" @submit.prevent="emit('save-nickname', nickname)">
              <label><span>昵称</span><input v-model.trim="nickname" minlength="2" maxlength="20" required /></label>
              <button type="submit">保存昵称</button>
            </form>
            <p v-else-if="isOwn" class="profile-help">昵称已与 CC98 名字绑定。</p>
            <form v-if="isOwn" class="profile-grade-form" @submit.prevent="saveGrade">
              <label>
                <span>所在年级</span>
                <select v-model="grade">
                  <option v-for="option in GRADE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <button type="submit">保存年级</button>
            </form>
            <form v-if="isOwn" class="profile-cc98-form" @submit.prevent="emit('bind-cc98', { code: cc98Code, password: currentPassword })">
              <h2>{{ cc98Bound ? '换绑 CC98' : '绑定 CC98' }}</h2>
              <label><span>CC98 验证码</span><input v-model.trim="cc98Code" required /></label>
              <label><span>当前密码</span><input v-model="currentPassword" type="password" minlength="8" required /></label>
              <button type="submit">{{ cc98Bound ? '确认换绑' : '确认绑定' }}</button>
            </form>
          </div>
        </section>

        <section v-if="isOwn && activeSection === 'courses'" class="profile-management">
          <header><div><p>Course List</p><h1>我的课程</h1></div><label class="profile-file-button">导入课表<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="chooseSchedule" /></label></header>
          <div v-if="courseImportPreview" class="course-import-preview">
            <strong>识别到 {{ courseImportPreview.courses.length }} 门课程</strong>
            <p v-if="courseImportPreview.duplicateGroupCount">已合并 {{ courseImportPreview.duplicateGroupCount }} 组重复课程。</p>
            <button type="button" @click="emit('replace-courses', courseImportPreview.courses)">确认替换课程清单</button>
          </div>
          <p v-if="!courses.length" class="profile-state">还没有课程，可上传教务系统导出的 XLSX 课表。</p>
          <div v-else class="profile-course-table">
            <div class="profile-course-row profile-course-row--head"><span>课程</span><span>教师</span><span>学期</span><span>时间与地点</span><span></span></div>
            <div v-for="course in courses" :key="course.courseCode" class="profile-course-row">
              <span><a v-if="course.catalogMatched" :href="buildCourseRoute(course.courseCode)">{{ course.courseName }}</a><strong v-else>{{ course.courseName }}</strong><small>{{ course.courseCode }}<em v-if="!course.catalogMatched">站内暂未收录</em></small></span>
              <span>{{ course.teacherName || '未注明' }}</span><span>{{ course.term || '未注明' }}</span>
              <span>{{ course.classTime || '时间待定' }}<small>{{ course.classLocation || '地点待定' }}</small></span>
              <button type="button" @click="emit('remove-course', course)">移除</button>
            </div>
          </div>
        </section>

        <section v-if="isOwn && activeSection === 'favorites'" class="profile-management">
          <header><div><p>Saved Content</p><h1>我的收藏</h1></div><span>{{ favorites.length }} 项</span></header>
          <p v-if="!favorites.length" class="profile-state">还没有收藏内容。</p>
          <article v-for="favorite in favorites" v-else :key="favorite.id" class="profile-post-row">
            <div><span>{{ favorite.courseCode }}</span><h3><a :href="contentHref(favorite)">{{ favorite.title }}</a></h3><p>{{ favorite.summary }}</p></div>
            <button type="button" @click="emit('remove-favorite', favorite)">取消收藏</button>
          </article>
        </section>

        <section v-if="!isOwn || activeSection === 'posts'" class="profile-posts">
          <header><div><p>{{ isOwn ? 'Content Management' : 'Published Posts' }}</p><h2>{{ isOwn ? '我的帖子' : '发布的帖子' }}</h2></div><span>{{ visiblePosts.length }} 篇</span></header>
          <p v-if="!visiblePosts.length" class="profile-state">暂时没有可展示的帖子。</p>
          <article v-for="post in visiblePosts" v-else :key="post.id" class="profile-post-row">
            <div><span>{{ post.courseCode }} · {{ statusLabel(post.status || 'published') }}</span><h3><a :href="contentHref(post)">{{ post.title }}</a></h3><p>{{ post.summary }}</p></div>
            <div v-if="isOwn" class="profile-post-actions"><button v-if="['published', 'archived'].includes(post.status)" type="button" @click="startRevision(post)">{{ post.status === 'archived' ? '重新发布' : '提交修改' }}</button><button v-if="post.status === 'published'" type="button" class="is-danger" @click="emit('archive-post', post)">下架</button></div>
            <form v-if="editingPostId === post.id" class="profile-revision-form" @submit.prevent="submitRevision(post)"><label><span>标题</span><input v-model.trim="revision.title" required /></label><label><span>摘要</span><textarea v-model.trim="revision.summary" rows="2"></textarea></label><label><span>正文</span><textarea v-model="revision.body" rows="8" required></textarea></label><div><button type="submit">提交审核</button><button type="button" @click="editingPostId = ''">取消</button></div></form>
          </article>
          <template v-if="isOwn && submissions.length">
            <header class="profile-submission-head"><div><p>Review Queue</p><h2>投稿记录</h2></div></header>
            <article v-for="submission in submissions" :key="submission.id" class="profile-post-row">
              <div><span>{{ submission.courseCode }} · {{ statusLabel(submission.status) }}</span><h3>{{ submission.title }}</h3><p v-if="submission.reviewNote">{{ submission.reviewNote }}</p></div>
              <div class="profile-post-actions">
                <button v-if="['pending', 'rejected'].includes(submission.status)" type="button" @click="startSubmissionEdit(submission)">{{ submission.status === 'rejected' ? '修改并重投' : '编辑' }}</button>
                <button v-if="submission.status === 'pending'" type="button" @click="emit('withdraw-submission', submission)">撤回</button>
                <button v-if="['rejected', 'withdrawn'].includes(submission.status)" type="button" class="is-danger" @click="emit('delete-submission', submission)">删除</button>
              </div>
              <form v-if="editingSubmissionId === submission.id" class="profile-revision-form" @submit.prevent="saveSubmission(submission)">
                <label><span>标题</span><input v-model.trim="submissionDraft.title" required /></label>
                <label><span>摘要</span><textarea v-model.trim="submissionDraft.summary" rows="2"></textarea></label>
                <label><span>正文</span><textarea v-model="submissionDraft.body" rows="8" required></textarea></label>
                <div><button type="submit">{{ submission.status === 'rejected' ? '重新提交审核' : '保存修改' }}</button><button type="button" @click="editingSubmissionId = ''">取消</button></div>
              </form>
            </article>
          </template>
        </section>

        <section v-if="isOwn && activeSection === 'comments'" class="profile-management">
          <header><div><p>My Discussions</p><h1>我的评论</h1></div><span>{{ comments.length }} 条</span></header>
          <p v-if="!comments.length" class="profile-state">还没有发表过评论。</p>
          <article v-for="comment in comments" v-else :key="comment.id" class="profile-post-row"><div><span>{{ comment.courseCode }} · {{ comment.itemTitle }}</span><p>{{ comment.body }}</p><a :href="comment.href">查看原文</a></div><div v-if="!comment.deleted" class="profile-post-actions"><button type="button" @click="emit('edit-comment', comment)">编辑</button><button type="button" @click="emit('delete-comment', comment)">删除</button></div></article>
        </section>
      </template>
    </main>
  </article>
</template>
