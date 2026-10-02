<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  homeQuizSearchItems,
  homeSearchKinds,
} from '../data/homeContent.js';
import { majorOptions } from '../data/courses/programCatalog.js';
import { activityProgramLabel } from '../data/activityConfig.js';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { buildHomeSearchIndex, searchHomeIndex } from '../services/homeSearchService.js';
import { currentSchoolSemester, currentSemesterCourses } from '../services/currentSemesterService.js';
import { searchProfiles } from '../services/profileApiClient.js';
import { resourceSearchApiClient } from '../services/resourceSearchApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';
import TeacherNameInput from './TeacherNameInput.vue';
import MyCourseGrid from './MyCourseGrid.vue';
import { searchTeacherNames } from '../services/teacherSuggestionService.js';

const props = defineProps({
  activityClient: { type: Object, default: null },
  resourceSearchClient: { type: Object, default: null },
  studyProfile: { type: Object, default: () => ({ majorId: '', cohortYear: null, onboardingDismissed: false }) },
  lastQuiz: { type: Object, default: null },
  studyNotice: { type: String, default: '' },
  studySaving: { type: Boolean, default: false },
  gradeLocked: { type: Boolean, default: false },
  myCourses: { type: Array, default: () => [] },
  coursesBusy: { type: Boolean, default: false },
  courseNotice: { type: String, default: '' },
});
const emit = defineEmits(['save-study-profile', 'dismiss-study-setup', 'resume-quiz', 'remove-course']);
const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);
const activeResourceSearchClient = computed(() => props.resourceSearchClient ?? resourceSearchApiClient);

const activeKind = ref('course');
const query = ref('');
const courses = ref([]);
const courseCatalogReady = ref(false);
const catalogMessage = ref('');
const users = ref([]);
const activities = ref([]);
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
const recentActivities = computed(() => activities.value
  .filter((item) => item.featured === true)
  .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
  .slice(0, 3));
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
  const cohortYear = props.gradeLocked ? props.studyProfile.cohortYear : Number(studyDraft.cohortYear);
  if (!studyDraft.majorId || (!props.gradeLocked && !cohortYear)) return;
  emit('save-study-profile', { majorId: studyDraft.majorId, cohortYear });
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

function activityImage(path) {
  return path ? publicAssetPath(path) : '';
}
function submitSearch() {
  query.value = query.value.trim();
  if (activeKind.value === 'resource') queueResourceSearch({ immediate: true });
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
  const [activityResult, catalogResult] = await Promise.all([
    activeActivityClient.value.fetchActivities(),
    loadResourceCatalog().then((catalog) => ({ ok: true, catalog })).catch(() => ({ ok: false })),
  ]);
  if (activityResult.ok) activities.value = activityResult.activities;
  if (catalogResult.ok) courses.value = catalogResult.catalog.courses;
  else catalogMessage.value = '课程目录暂时无法读取，请稍后再试。';
  courseCatalogReady.value = true;
});
</script>

<template>
  <div class="home-page">
    <section class="home-search-stage" aria-labelledby="home-title">
      <h1 id="home-title" class="home-sr-only">生科智学学习资源</h1>

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

        <form class="home-search__form" @submit.prevent="submitSearch">
          <label class="home-search__field">
            <input v-model="query" type="search" :placeholder="activeSearchKind.placeholder" aria-label="搜索课程或资料" autocomplete="off" />
          </label>
          <button class="home-search__submit" type="submit">搜索</button>
        </form>

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
          <a href="#my-courses">管理课程</a>
          <button v-if="hasStudyProfile && !showStudyForm" type="button" @click="editingStudyProfile = true">{{ gradeLocked ? '修改专业' : '修改专业与年级' }}</button>
        </header>

        <form v-if="showStudyForm" class="home-study__setup" @submit.prevent="saveStudyProfile">
          <label>专业
            <select v-model="studyDraft.majorId" required>
              <option value="">选择专业</option>
              <option v-for="major in availableMajors" :key="major.id" :value="major.id">{{ major.label }}</option>
            </select>
          </label>
          <label v-if="!gradeLocked">入学年级
            <select v-model="studyDraft.cohortYear" required>
              <option value="">选择年级</option>
              <option v-for="year in cohortYears" :key="year" :value="String(year)">{{ year }} 级</option>
            </select>
          </label>
          <p v-else class="home-study__cohort">入学年级：{{ studyProfile.cohortYear == null ? '未识别' : `${studyProfile.cohortYear} 级` }}</p>
          <div class="home-study__setup-actions">
            <button type="submit" :disabled="studySaving">{{ studySaving ? '正在保存...' : '保存' }}</button>
            <button v-if="!hasStudyProfile" type="button" @click="emit('dismiss-study-setup'); editingStudyProfile = false">稍后设置</button>
            <button v-else type="button" @click="editingStudyProfile = false">取消</button>
          </div>
        </form>
        <p v-else-if="hasStudyProfile && !courseCatalogReady" class="home-study__empty">正在读取课程...</p>
        <template v-else-if="hasStudyProfile && semesterOverview.status === 'ready'">
          <p class="home-study__term" hidden>{{ semesterOverview.label }} · {{ availableMajors.find((major) => major.id === studyProfile.majorId)?.label }}</p>
        </template>
        <p v-else-if="hasStudyProfile && semesterOverview.status === 'no-program'" class="home-study__empty">这一年级的培养方案暂未收录，课程建议无法准确生成。</p>
        <button v-else type="button" class="home-study__set-later" @click="editingStudyProfile = true">{{ gradeLocked ? '设置专业' : '设置专业与入学年级' }}</button>
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


    </section>

    <section class="home-feed" aria-label="首页动态">
      <div class="home-feed__main">
        <header class="home-section-head">
          <div>
            <h2>近期活动</h2>
          </div>
          <a href="#activities">全部活动</a>
        </header>

        <div class="home-activity-grid">
          <article v-for="activity in recentActivities" :key="activity.id">
            <a :href="activity.externalUrl" class="home-activity-card__image" target="_blank" rel="noopener noreferrer">
              <img v-if="activity.imageUrl" :src="activityImage(activity.imageUrl)" :alt="activity.imageAlt || activity.title" loading="lazy">
            </a>
            <div>
              <h3>{{ activity.title }}</h3>
            </div>
            <a :href="activity.externalUrl" target="_blank" rel="noopener noreferrer">阅读推文 <b aria-hidden="true">↗</b></a>
          </article>
          <p v-if="!recentActivities.length" class="home-activity-grid__empty">暂无近期活动。</p>
        </div>
      </div>


    </section>

  </div>
</template>
