<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  homeQuizSearchItems,
  homeSearchKinds,
} from '../data/homeContent.js';
import { activityProgramLabel } from '../data/activityConfig.js';
import { majorOptions } from '../data/courses/programCatalog.js';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { buildHomeSearchIndex, searchHomeIndex } from '../services/homeSearchService.js';
import { currentSchoolSemester, currentSemesterCourses } from '../services/currentSemesterService.js';
import { searchProfiles } from '../services/profileApiClient.js';
import { resourceSearchApiClient } from '../services/resourceSearchApiClient.js';
import { imageFileToAvatarDataUrl, studentHomepageApiClient } from '../services/studentHomepageApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';
import TeacherNameInput from './TeacherNameInput.vue';
import MyCourseGrid from './MyCourseGrid.vue';
import { searchTeacherNames } from '../services/teacherSuggestionService.js';

const props = defineProps({
  activityClient: { type: Object, default: null },
  homepageClient: { type: Object, default: null },
  resourceSearchClient: { type: Object, default: null },
  canSubmit: { type: Boolean, default: false },
  studyProfile: { type: Object, default: () => ({ majorId: '', cohortYear: null, onboardingDismissed: false }) },
  lastQuiz: { type: Object, default: null },
  studyNotice: { type: String, default: '' },
  studySaving: { type: Boolean, default: false },
  myCourses: { type: Array, default: () => [] },
  coursesBusy: { type: Boolean, default: false },
  courseNotice: { type: String, default: '' },
});
const emit = defineEmits(['save-study-profile', 'dismiss-study-setup', 'resume-quiz', 'remove-course']);
const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);
const activeHomepageClient = computed(() => props.homepageClient ?? studentHomepageApiClient);
const activeResourceSearchClient = computed(() => props.resourceSearchClient ?? resourceSearchApiClient);

const activeKind = ref('course');
const query = ref('');
const courses = ref([]);
const courseCatalogReady = ref(false);
const catalogMessage = ref('');
const users = ref([]);
const activities = ref([]);
const homepages = ref([]);
const homepageDialogOpen = ref(false);
const homepageForm = ref({ name: '', href: '', avatarUrl: '' });
const homepageNotice = ref('');
const homepageBusy = ref(false);
const studyDraft = reactive({ majorId: '', cohortYear: '' });
const editingStudyProfile = ref(false);
const availableMajors = majorOptions.filter((major) => major.available);
const currentAcademicYear = currentSchoolSemester()?.academicYear ?? new Date().getFullYear();
const cohortYears = Array.from({ length: Math.max(1, currentAcademicYear - 2023 + 1) }, (_, index) => 2023 + index);
const resourceFilters = reactive({ course: '', type: '', teacher: '', year: '' });
const resourceTeacherNames = computed(() => searchTeacherNames(resourceFilters.course, courses.value));
const resourceItems = ref([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourceLoading = ref(false);
const resourceError = ref('');
const resourcePageSize = 10;
const resourceTypeLabels = { experience: '学习心得', material: '复习资料', paper: '历年试卷' };
let userSearchSequence = 0;
let resourceSearchSequence = 0;
let resourceSearchTimer;
let resourceSearchController;

const activeSearchKind = computed(
  () => homeSearchKinds.find((kind) => kind.id === activeKind.value) ?? homeSearchKinds[0],
);

const searchIndex = computed(() => buildHomeSearchIndex({
  courses: courses.value,
  resources: [],
  quizzes: homeQuizSearchItems,
  activities: activities.value.map((item) => ({
    ...item,
    summary: activityProgramLabel(item.programId),
    href: item.externalUrl,
  })),
  users: users.value,
}));

const searchResults = computed(() => searchHomeIndex(searchIndex.value, query.value, activeKind.value));
const hasQuery = computed(() => Boolean(query.value.trim()));
const recentActivities = computed(() => activities.value.slice(0, 3));
const resourcePageCount = computed(() => Math.max(1, Math.ceil(resourceTotal.value / resourcePageSize)));
const hasStudyProfile = computed(() => Boolean(props.studyProfile.majorId && props.studyProfile.cohortYear));
const semesterOverview = computed(() => currentSemesterCourses({
  majorId: props.studyProfile.majorId, cohortYear: props.studyProfile.cohortYear,
  courses: courses.value,
}));
const showStudyForm = computed(() => editingStudyProfile.value
  || (!hasStudyProfile.value && !props.studyProfile.onboardingDismissed));

watch(() => [props.studyProfile.majorId, props.studyProfile.cohortYear], ([majorId, cohortYear]) => {
  studyDraft.majorId = majorId || '';
  studyDraft.cohortYear = cohortYear == null ? '' : String(cohortYear);
  if (majorId && cohortYear) editingStudyProfile.value = false;
}, { immediate: true });

function saveStudyProfile() {
  if (!studyDraft.majorId || !studyDraft.cohortYear) return;
  emit('save-study-profile', { majorId: studyDraft.majorId, cohortYear: Number(studyDraft.cohortYear) });
}

async function loadResourceResults() {
  if (activeKind.value !== 'resource') return;
  const sequence = ++resourceSearchSequence;
  resourceSearchController?.abort();
  const controller = new AbortController();
  resourceSearchController = controller;
  resourceLoading.value = true;
  resourceError.value = '';
  const result = await activeResourceSearchClient.value.search({
    query: query.value,
    ...resourceFilters,
    page: resourcePage.value,
    pageSize: resourcePageSize,
    signal: controller.signal,
  });
  if (sequence !== resourceSearchSequence || activeKind.value !== 'resource') return;
  resourceLoading.value = false;
  if (!result.ok) {
    resourceItems.value = [];
    resourceTotal.value = 0;
    resourceError.value = result.message || '资料搜索暂时不可用，请稍后重试。';
    return;
  }
  resourceItems.value = result.items;
  resourceTotal.value = result.total;
}

function queueResourceSearch({ immediate = false } = {}) {
  clearTimeout(resourceSearchTimer);
  resourceSearchController?.abort();
  ++resourceSearchSequence;
  resourceItems.value = [];
  resourceTotal.value = 0;
  resourceError.value = '';
  resourceLoading.value = activeKind.value === 'resource';
  if (activeKind.value !== 'resource') return;
  if (immediate) loadResourceResults();
  else resourceSearchTimer = setTimeout(loadResourceResults, 250);
}

function resetResourceFilters() {
  resourceFilters.course = '';
  resourceFilters.type = '';
  resourceFilters.teacher = '';
  resourceFilters.year = '';
}

function changeResourcePage(nextPage) {
  if (nextPage < 1 || nextPage > resourcePageCount.value || resourceLoading.value) return;
  resourcePage.value = nextPage;
  queueResourceSearch({ immediate: true });
}

function selectSearchKind(kindId) {
  activeKind.value = kindId;
}

function avatarImage(path) {
  return path?.startsWith('data:image/webp;base64,') || path?.startsWith('/zjubio/') ? path : (path ? publicAssetPath(path) : '');
}

async function selectHomepageAvatar(event) {
  homepageNotice.value = '';
  try {
    homepageForm.value.avatarUrl = await imageFileToAvatarDataUrl(event.target.files?.[0]);
  } catch (error) {
    homepageForm.value.avatarUrl = '';
    homepageNotice.value = error.message;
  }
}

async function submitHomepage() {
  if (!props.canSubmit) {
    homepageNotice.value = '完成学号认证后即可投稿个人主页。';
    return;
  }
  if (!homepageForm.value.avatarUrl) {
    homepageNotice.value = '请先选择头像。';
    return;
  }
  homepageBusy.value = true;
  const result = await activeHomepageClient.value.submitApplication(homepageForm.value);
  homepageBusy.value = false;
  if (!result.ok) {
    homepageNotice.value = result.message;
    return;
  }
  homepageDialogOpen.value = false;
  homepageForm.value = { name: '', href: '', avatarUrl: '' };
  homepageNotice.value = '投稿已提交，管理员审核后会显示在首页。';
}

watch([query, activeKind], async ([nextQuery, nextKind]) => {
  if (nextKind !== 'user' || nextQuery.trim().length < 1) {
    users.value = [];
    return;
  }
  const sequence = ++userSearchSequence;
  const result = await searchProfiles(nextQuery.trim());
  if (sequence === userSearchSequence) {
    users.value = result.ok ? result.profiles : [];
  }
});

watch(
  [query, activeKind, () => resourceFilters.course, () => resourceFilters.type, () => resourceFilters.teacher, () => resourceFilters.year],
  () => {
    resourcePage.value = 1;
    queueResourceSearch();
  },
);

onUnmounted(() => {
  clearTimeout(resourceSearchTimer);
  resourceSearchController?.abort();
  ++resourceSearchSequence;
});

onMounted(async () => {
  const [activityResult, catalogResult, homepageResult] = await Promise.all([
    activeActivityClient.value.fetchActivities(),
    loadResourceCatalog().then((catalog) => ({ ok: true, catalog })).catch(() => ({ ok: false })),
    activeHomepageClient.value.fetchHomepages(),
  ]);
  if (activityResult.ok) activities.value = activityResult.activities;
  if (homepageResult.ok) homepages.value = homepageResult.homepages;
  if (catalogResult.ok) courses.value = catalogResult.catalog.courses;
  else catalogMessage.value = '课程目录暂时无法读取，请稍后再试。';
  courseCatalogReady.value = true;
});
</script>

<template>
  <div class="home-page">
    <section class="home-search-stage" aria-labelledby="home-title">
      <div class="home-search-stage__copy">
        <p>浙江大学生命科学学院课程资源</p>
        <h1 id="home-title">今天想找哪门课？</h1>
        <span>从课程入口出发，也可以查找资料、题库与学生会活动。</span>
      </div>

      <div class="home-search" role="search">
        <div class="home-search__kinds" aria-label="搜索类型">
          <button
            v-for="kind in homeSearchKinds"
            :key="kind.id"
            type="button"
            :class="{ 'is-active': activeKind === kind.id }"
            @click="selectSearchKind(kind.id)"
          >
            {{ kind.label }}
          </button>
        </div>

        <label class="home-search__field">
          <span class="home-search__icon" aria-hidden="true">⌕</span>
          <input v-model="query" type="search" :placeholder="activeSearchKind.placeholder" autocomplete="off" />
          <kbd v-if="activeKind !== 'resource'">Enter</kbd>
        </label>

        <div v-if="activeKind === 'resource'" class="home-resource-search" aria-live="polite">
          <div class="home-resource-search__filters">
            <label>课程<input v-model.trim="resourceFilters.course" type="search" placeholder="课程名或代码" autocomplete="off" /></label>
            <label>类型
              <select v-model="resourceFilters.type">
                <option value="">全部类型</option>
                <option value="experience">学习心得</option>
                <option value="material">复习资料</option>
                <option value="paper">历年试卷</option>
              </select>
            </label>
            <label>授课老师<TeacherNameInput v-model="resourceFilters.teacher" :names="resourceTeacherNames" placeholder="老师姓名" /></label>
            <label>年份<input v-model.trim="resourceFilters.year" type="search" placeholder="如 2025" inputmode="numeric" autocomplete="off" /></label>
            <button type="button" class="home-resource-search__reset" @click="resetResourceFilters">清除筛选</button>
          </div>
          <div class="home-resource-search__head">
            <strong>{{ hasQuery ? '搜索结果' : '最新资料' }}</strong>
            <span v-if="!resourceLoading && !resourceError">共 {{ resourceTotal }} 条</span>
          </div>
          <p v-if="resourceLoading" class="home-resource-search__state" role="status">正在查找资料...</p>
          <div v-else-if="resourceError" class="home-resource-search__state" role="alert">
            {{ resourceError }}
            <button type="button" @click="queueResourceSearch({ immediate: true })">重试</button>
          </div>
          <p v-else-if="!resourceItems.length" class="home-resource-search__state">没有找到符合条件的资料。</p>
          <div v-else class="home-resource-search__list">
            <a v-for="item in resourceItems" :key="item.id" :href="item.href" class="home-resource-search__item">
              <span class="home-resource-search__item-meta">{{ item.courseName || item.courseCode }}<template v-if="item.courseName"> · {{ item.courseCode }}</template> · {{ resourceTypeLabels[item.type] || item.type }}</span>
              <strong>{{ item.title }}</strong>
              <small v-if="item.summary">{{ item.summary }}</small>
              <span class="home-resource-search__item-detail">
                <span v-if="item.teacher">{{ item.teacher }}</span>
                <span v-if="item.year">{{ item.year }}</span>
                <span v-if="item.author">{{ item.author }}</span>
              </span>
            </a>
          </div>
          <nav v-if="!resourceLoading && !resourceError && resourcePageCount > 1" class="home-resource-search__pages" aria-label="资料搜索分页">
            <button type="button" :disabled="resourcePage === 1" @click="changeResourcePage(resourcePage - 1)">上一页</button>
            <span>第 {{ resourcePage }} / {{ resourcePageCount }} 页</span>
            <button type="button" :disabled="resourcePage === resourcePageCount" @click="changeResourcePage(resourcePage + 1)">下一页</button>
          </nav>
        </div>

        <div v-else-if="hasQuery" class="home-search__results" aria-live="polite">
          <a v-for="item in searchResults" :key="`${item.kind}-${item.id}`" :href="item.href">
            <span>{{ item.kindLabel }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.code || item.courseCode || item.subtitle || item.summary }}</small>
          </a>
          <p v-if="!searchResults.length">没有找到相关{{ activeSearchKind.label }}，试试更短的关键词。</p>
        </div>

        <p v-if="catalogMessage" class="home-search__message">{{ catalogMessage }}</p>
      </div>

      <section class="home-study" aria-labelledby="home-study-title">
        <header class="home-study__head">
          <div>
            <h2 id="home-study-title">我的课程</h2>
          </div>
          <a href="#my-courses">设置我的课程</a>
          <button v-if="hasStudyProfile && !showStudyForm" type="button" @click="editingStudyProfile = true">修改专业与年级</button>
        </header>

        <form v-if="showStudyForm" class="home-study__setup" @submit.prevent="saveStudyProfile">
          <label>专业
            <select v-model="studyDraft.majorId" required>
              <option value="">选择专业</option>
              <option v-for="major in availableMajors" :key="major.id" :value="major.id">{{ major.label }}</option>
            </select>
          </label>
          <label>入学年级
            <select v-model="studyDraft.cohortYear" required>
              <option value="">选择年级</option>
              <option v-for="year in cohortYears" :key="year" :value="String(year)">{{ year }} 级</option>
            </select>
          </label>
          <div class="home-study__setup-actions">
            <button type="submit" :disabled="studySaving">{{ studySaving ? '正在保存...' : '保存' }}</button>
            <button v-if="!hasStudyProfile" type="button" @click="emit('dismiss-study-setup'); editingStudyProfile = false">稍后设置</button>
            <button v-else type="button" @click="editingStudyProfile = false">取消</button>
          </div>
        </form>
        <p v-else-if="hasStudyProfile && !courseCatalogReady" class="home-study__empty">正在读取课程...</p>
        <template v-else-if="hasStudyProfile && semesterOverview.status === 'ready'">
          <p class="home-study__term">{{ semesterOverview.label }} · {{ availableMajors.find((major) => major.id === studyProfile.majorId)?.label }}</p>
        </template>
        <p v-else-if="hasStudyProfile && semesterOverview.status === 'no-program'" class="home-study__empty">这一年级的培养方案暂未收录，课程建议无法准确生成。</p>
        <button v-else type="button" class="home-study__set-later" @click="editingStudyProfile = true">设置专业与入学年级</button>
        <MyCourseGrid v-if="myCourses.length" class="home-study__courses" :courses="myCourses" :busy="coursesBusy" @remove-course="emit('remove-course', $event)" />
        <p v-else-if="!studySaving" class="home-study__empty">暂无课程。</p>
        <p v-if="courseNotice" class="home-study__course-notice" role="status">{{ courseNotice }}</p>
        <p v-if="studyNotice" class="home-study__notice" role="status">{{ studyNotice }}</p>

        <div class="home-study__last-quiz">
          <div><span>上次刷题</span><strong>{{ lastQuiz?.courseName || '还没有刷题记录' }}</strong></div>
          <button v-if="lastQuiz" type="button" @click="emit('resume-quiz')">{{ lastQuiz.sessionId && !lastQuiz.completedAt ? '继续练习' : '再次进入' }}</button>
          <a v-else href="#quiz">开始刷题</a>
        </div>
      </section>

      <div v-if="!hasQuery && activeKind !== 'resource'" class="home-search-stage__quicklinks" aria-label="常用入口">
        <span>常用入口</span>
        <a href="#quiz">开始刷题</a>
        <a href="#overview">查看培养方案</a>
      </div>
    </section>

    <section class="home-feed" aria-label="首页动态">
      <div class="home-feed__main">
        <header class="home-section-head">
          <div>
            <p>Student Union</p>
            <h2>近期活动</h2>
          </div>
          <a href="#activities">全部活动</a>
        </header>

        <div class="home-activity-grid">
          <article v-for="(activity, index) in recentActivities" :key="activity.id" :class="`is-${['green', 'amber', 'blue'][index % 3]}`">
            <span class="home-activity-card__number">0{{ index + 1 }}</span>
            <div>
              <p>{{ activityProgramLabel(activity.programId) }}</p>
              <h3>{{ activity.title }}</h3>
              <span>查看公众号原文</span>
            </div>
            <a :href="activity.externalUrl" target="_blank" rel="noopener noreferrer">阅读推文 <b aria-hidden="true">↗</b></a>
          </article>
          <p v-if="!recentActivities.length" class="home-activity-grid__empty">暂无近期活动。</p>
        </div>
      </div>

      <aside class="home-popular" aria-labelledby="homepages-title">
        <header class="home-section-head">
          <div>
            <p>Student Pages</p>
            <h2 id="homepages-title">同学主页</h2>
          </div>
          <button class="home-homepages__submit" type="button" @click="homepageNotice = ''; homepageDialogOpen = true">投稿</button>
        </header>

        <template v-for="(homepage, index) in homepages" :key="homepage.id">
          <a v-if="homepage.href" class="home-homepages__row" :href="homepage.href" target="_blank" rel="noopener noreferrer">
            <img v-if="homepage.avatarUrl" :src="avatarImage(homepage.avatarUrl)" :alt="`${homepage.name}的头像`" />
            <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ homepage.name }}</strong>
              <small>{{ homepage.href }}</small>
            </div>
          </a>
          <div v-else class="home-homepages__row is-placeholder">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ homepage.name }}</strong>
              <small>期待你的主页</small>
            </div>
          </div>
        </template>
        <p v-if="!homepages.length" class="home-homepages__empty">暂无同学主页。</p>
        <p v-if="homepageNotice && !homepageDialogOpen" class="home-homepages__notice" role="status">{{ homepageNotice }}</p>
      </aside>
    </section>

    <div v-if="homepageDialogOpen" class="home-homepages__overlay" @click.self="homepageDialogOpen = false">
      <section class="home-homepages__dialog" role="dialog" aria-modal="true" aria-labelledby="homepage-submit-title">
        <header>
          <h2 id="homepage-submit-title">投稿同学主页</h2>
          <button type="button" aria-label="关闭" @click="homepageDialogOpen = false">×</button>
        </header>
        <form @submit.prevent="submitHomepage">
          <label>名称<input v-model.trim="homepageForm.name" required maxlength="40" placeholder="你的名称"></label>
          <label>头像<input type="file" required accept="image/png,image/jpeg,image/webp" @change="selectHomepageAvatar"></label>
          <img v-if="homepageForm.avatarUrl" class="home-homepages__preview" :src="homepageForm.avatarUrl" alt="头像预览">
          <label>主页链接<input v-model.trim="homepageForm.href" required type="url" maxlength="500" placeholder="https://"></label>
          <p v-if="homepageNotice" role="status">{{ homepageNotice }}</p>
          <footer>
            <button type="button" @click="homepageDialogOpen = false">取消</button>
            <button type="submit" :disabled="homepageBusy">{{ homepageBusy ? '提交中...' : '提交审核' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>
