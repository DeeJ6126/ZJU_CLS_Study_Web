<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { supportedCourseCodes } from '../data/courses/courseDetails.js';
import {
  DEFAULT_MAJOR_ID,
  curriculumOptions,
  findCurriculumProgram,
  listProgramYears,
  majorOptions,
} from '../data/courses/programCatalog.js';
import { publicAssetPath } from '../utils/publicPath.js';
import { loadCourseAvailability } from '../services/courseContentApiClient.js';
import {
  buildAllCourseSections,
  buildProgramOutline,
  buildProgramSemesterSections,
} from '../services/overviewCatalogService.js';
import {
  buildHashWithQuery,
  getHashQuery,
} from '../services/demoNavigationService.js';

const VALID_GROUPING_MODES = new Set(['outline', 'semester']);
const DEFAULT_PROGRAM_ID = curriculumOptions[0]?.id ?? '2024';

const availableMajorIds = new Set(
  majorOptions.filter((option) => option.available).map((option) => option.id),
);

function programIdForGrade(grade, majorId) {
  if (grade == null) return '';
  const year = String(grade);
  return findCurriculumProgram(majorId, year) ? year : '';
}

function readFiltersFromHash() {
  const params = getHashQuery(window.location.hash);
  const majorId = params.get('major');
  const programId = params.get('program');
  const grouping = params.get('group');
  const major = availableMajorIds.has(majorId) ? majorId : DEFAULT_MAJOR_ID;
  return {
    majorId: major,
    programId: findCurriculumProgram(major, programId) ? programId : '',
    chosenModules: (params.get('module') ?? '').split(',').filter(Boolean),
    grouping: VALID_GROUPING_MODES.has(grouping) ? grouping : 'outline',
    onlyWithResources: params.get('resources') === '1',
  };
}

const initialFilters = readFiltersFromHash();
const hasExplicitProgram = Boolean(initialFilters.programId);
const courses = ref([]);
const selectedMajorId = ref(initialFilters.majorId);
const selectedProgramId = ref(initialFilters.programId || DEFAULT_PROGRAM_ID);
const chosenModules = ref(initialFilters.chosenModules);
const groupingMode = ref(initialFilters.grouping);
const onlyWithResources = ref(initialFilters.onlyWithResources);
const resourceAvailability = ref(new Set(supportedCourseCodes));
const resourceAvailabilityLoading = ref(false);
const resourceAvailabilityLoaded = ref(false);
const isLoading = ref(true);
const loadError = ref('');
const collapsedSections = reactive({});
const collapsedGroups = reactive({});
const props = defineProps({
  canManageCourses: { type: Boolean, default: false },
  savedCourseCodes: { type: Array, default: () => [] },
  userGrade: { type: Number, default: null },
});
const emit = defineEmits(['add-course', 'remove-course', 'navigate-course']);

function applyDefaultFromGrade() {
  if (hasExplicitProgram || selectedProgramId.value !== DEFAULT_PROGRAM_ID) return;
  const fallback = programIdForGrade(props.userGrade, selectedMajorId.value);
  if (fallback) selectedProgramId.value = fallback;
}

function syncOverviewHash() {
  const params = {};
  if (selectedMajorId.value !== DEFAULT_MAJOR_ID) {
    params.major = selectedMajorId.value;
  }
  if (selectedProgramId.value !== DEFAULT_PROGRAM_ID) {
    params.program = selectedProgramId.value;
  }
  if (chosenModules.value.length) {
    params.module = chosenModules.value.join(',');
  }
  if (groupingMode.value !== 'outline') {
    params.group = groupingMode.value;
  }
  if (onlyWithResources.value) {
    params.resources = '1';
  }
  const nextHash = buildHashWithQuery('overview', params);
  if (window.location.hash !== nextHash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

watch(
  [selectedMajorId, selectedProgramId, chosenModules, groupingMode, onlyWithResources],
  () => { syncOverviewHash(); },
);

// 切换专业后原来的年级/模块可能在新专业下不存在，回退到默认培养方案。
watch(selectedMajorId, (majorId) => {
  if (selectedProgramId.value !== DEFAULT_PROGRAM_ID
    && !findCurriculumProgram(majorId, selectedProgramId.value)) {
    selectedProgramId.value = DEFAULT_PROGRAM_ID;
  }
  chosenModules.value = [];
  applyDefaultFromGrade();
});

watch(
  () => props.userGrade,
  () => { applyDefaultFromGrade(); },
);

const selectedProgram = computed(
  () => findCurriculumProgram(selectedMajorId.value, selectedProgramId.value),
);
const isProgramSelected = computed(() => Boolean(selectedProgram.value));

const programYears = computed(() => new Set(listProgramYears(selectedMajorId.value)));
const yearOptions = computed(() => curriculumOptions.map((option) => ({
  ...option,
  available: programYears.value.has(option.id),
})));

// 同一份方案里互斥组不止一个（强基 2025 起还有转段方向），所以按「同组其他
// 分支先剔除、再加入选中分支」维护这个列表。
function chooseModule(row, optionTag) {
  const siblings = new Set(row.options.map((option) => option.tag));
  chosenModules.value = [
    ...chosenModules.value.filter((tag) => !siblings.has(tag)),
    optionTag,
  ];
}

async function handleResourceOnlyChange() {
  if (!onlyWithResources.value || resourceAvailabilityLoaded.value
      || resourceAvailabilityLoading.value || !courses.value.length) {
    return;
  }

  resourceAvailabilityLoading.value = true;
  try {
    const available = await loadCourseAvailability(courses.value);
    resourceAvailability.value = new Set([...resourceAvailability.value, ...available]);
  } finally {
    resourceAvailabilityLoading.value = false;
    resourceAvailabilityLoaded.value = true;
  }
}

const programSourceUrl = computed(() => (
  selectedProgram.value ? publicAssetPath(selectedProgram.value.sourceUrl) : ''
));

const filteredCourses = computed(() => (
  onlyWithResources.value && !resourceAvailabilityLoading.value
    ? courses.value.filter((course) => resourceAvailability.value.has(course.code))
    : courses.value
));

const sections = computed(() => {
  if (!selectedProgram.value) {
    return buildAllCourseSections(filteredCourses.value);
  }
  if (groupingMode.value === 'semester') {
    return buildProgramSemesterSections(filteredCourses.value, selectedProgram.value, chosenModules.value);
  }
  return [];
});

// 「按培养方案结构」视图：原文章节树压平后的行列表。
const outlineRows = computed(() => (
  isProgramSelected.value && groupingMode.value === 'outline'
    ? buildProgramOutline(filteredCourses.value, selectedProgram.value, chosenModules.value)
    : []
));

const visibleCourseCount = computed(() => {
  if (groupingMode.value === 'outline' && isProgramSelected.value) {
    // 同一门课可能同时出现在多个小节（例如生物科学的三个实践方向），按课程
    // 代码去重才是真实门数。
    return new Set(outlineRows.value.flatMap((row) => row.courses.map((c) => c.code))).size;
  }
  return sections.value.reduce((total, section) => (
    section.courses ? total + section.courses.length : total + section.courseCount
  ), 0);
});

function toggleSection(sectionId) {
  collapsedSections[sectionId] = !collapsedSections[sectionId];
}

function toggleGroup(groupId) {
  collapsedGroups[groupId] = !collapsedGroups[groupId];
}

function isSaved(courseCode) {
  return props.savedCourseCodes.includes(courseCode);
}

function toggleSavedCourse(course) {
  emit(isSaved(course.code) ? 'remove-course' : 'add-course', {
    courseCode: course.code,
    courseName: course.name,
  });
}

function handleCourseLinkClick(event, course) {
  // 当点击的课程 hash 与当前 hash 相同时，浏览器不会触发 hashchange，
  // 导致 syncPageFromHash 不会重新执行。显式上抛 navigate 事件，
  // App.vue 监听后会主动调用 syncPageFromHash 重新加载课程内容。
  const target = course?.href;
  if (!target) return;
  if (window.location.hash === target) {
    event.preventDefault();
    emit('navigate-course', { href: target });
  }
}

onMounted(async () => {
  applyDefaultFromGrade();
  try {
    const catalog = await loadResourceCatalog();
    courses.value = catalog.courses;
    if (onlyWithResources.value) {
      await handleResourceOnlyChange();
    }
  } catch {
    loadError.value = '课程目录加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="overview-page" aria-labelledby="overview-title">
    <header class="overview-head">
      <div>
        <p>Course Catalog</p>
        <h1 id="overview-title">课程概览</h1>
        <span>浏览生命科学学院课程，并进入课程页面查看简介、资料与学习内容。</span>
      </div>
      <strong>{{ visibleCourseCount }} 门课程</strong>
    </header>

    <div class="overview-controls" aria-label="课程目录筛选">
      <label>
        <span>专业</span>
        <select v-model="selectedMajorId">
          <option
            v-for="option in majorOptions"
            :key="option.id"
            :value="option.id"
            :disabled="!option.available"
          >
            {{ option.label }}{{ option.available ? '' : '（待整理）' }}
          </option>
        </select>
      </label>

      <label>
        <span>培养方案</span>
        <select v-model="selectedProgramId">
          <option
            v-for="option in yearOptions"
            :key="option.id"
            :value="option.id"
            :disabled="!option.available"
          >
            {{ option.label }}{{ option.available ? '' : '（待整理）' }}
          </option>
        </select>
      </label>

      <div v-if="isProgramSelected" class="overview-grouping" aria-label="分组方式">
        <span>分组方式</span>
        <div>
          <button
            type="button"
            :class="{ 'is-active': groupingMode === 'outline' }"
            @click="groupingMode = 'outline'"
          >
            按培养方案结构
          </button>
          <button
            type="button"
            :class="{ 'is-active': groupingMode === 'semester' }"
            @click="groupingMode = 'semester'"
          >
            按学期
          </button>
        </div>
      </div>

      <label class="overview-resource-filter">
        <input
          v-model="onlyWithResources"
          type="checkbox"
          @change="handleResourceOnlyChange"
        >
        <span>仅展示有资料的课程</span>
      </label>

      <!-- 必须过 publicAssetPath：站点部署在 /zjubio/ 或 GitHub Pages 的
           /ZJU_CLS_Study_Web/ 子路径下时，裸的绝对路径会指向域名根目录。 -->
      <a v-if="selectedProgram" :href="programSourceUrl" target="_blank" rel="noreferrer">
        查看培养方案原文
      </a>
    </div>

    <p v-if="isLoading" class="overview-empty">正在加载课程目录...</p>
    <p v-else-if="loadError" class="overview-empty">{{ loadError }}</p>

    <!-- 按培养方案原文结构展开。各专业层级深浅不同，用 depth 控制缩进。 -->
    <div v-else-if="groupingMode === 'outline' && isProgramSelected" class="overview-outline">
      <section
        v-for="row in outlineRows"
        :key="row.id"
        class="overview-outline__row"
        :class="`is-depth-${row.depth}`"
      >
        <h2 v-if="!row.headingHidden" class="overview-outline__head">
          <span>{{ row.tag }}</span>
          <em>{{ row.credits }}</em>
        </h2>
        <p v-if="row.note" class="overview-outline__note">{{ row.note }}</p>

        <!-- 二选一模块用页签切换 -->
        <div v-if="row.options" class="overview-modules" role="tablist" :aria-label="row.tag">
          <button
            v-for="option in row.options"
            :key="option.tag"
            type="button"
            role="tab"
            :aria-selected="row.selected === option.tag"
            :class="{ 'is-active': row.selected === option.tag }"
            @click="chooseModule(row, option.tag)"
          >
            {{ option.tag }}
          </button>
        </div>

        <div v-if="row.courses.length" class="overview-course-grid">
          <article v-for="course in row.courses" :key="course.code">
            <a :href="course.href" @click="handleCourseLinkClick($event, course)">
              <strong>{{ course.name }}</strong>
              <span>{{ course.code }}</span>
              <small>{{ course.credits }} 学分 · {{ course.totalHours }} 学时</small>
            </a>
            <!-- 收藏替代原“我的课程”清单入口，课程收藏与个人课表分开保存。 -->
            <button v-if="canManageCourses" type="button" @click="toggleSavedCourse(course)">
              {{ isSaved(course.code) ? '取消收藏' : '收藏' }}
            </button>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="overview-sections">
      <section v-for="section in sections" :key="section.id" class="overview-section">
        <button
          class="overview-section__head"
          type="button"
          :aria-expanded="!collapsedSections[section.id]"
          @click="toggleSection(section.id)"
        >
          <span>
            <strong>{{ section.title }}</strong>
            <small v-if="section.subtitle">{{ section.subtitle }}</small>
          </span>
          <em>{{ section.courses?.length ?? section.courseCount }} 门</em>
        </button>

        <div v-if="!collapsedSections[section.id]" class="overview-section__body">
          <template v-if="section.courses">
            <div class="overview-course-grid">
              <article v-for="course in section.courses" :key="course.code">
                <a :href="course.href">
                  <strong>{{ course.name }}</strong>
                  <span>{{ course.code }}</span>
                  <small>{{ course.credits }} 学分 · {{ course.totalHours }} 学时</small>
                </a>
                <button v-if="canManageCourses" type="button" @click="toggleSavedCourse(course)">
                  {{ isSaved(course.code) ? '取消收藏' : '收藏' }}
                </button>
              </article>
            </div>
            <p v-if="!section.courses.length" class="overview-empty">该学期暂无已整理课程。</p>
          </template>

          <section v-for="group in section.groups ?? []" v-else :key="group.id" class="overview-group">
            <button
              v-if="group.title"
              type="button"
              class="overview-group__head"
              :aria-expanded="!collapsedGroups[group.id]"
              @click="toggleGroup(group.id)"
            >
              <strong>{{ group.title }}</strong>
              <span>{{ group.courses.length }} 门</span>
            </button>

            <div v-if="!collapsedGroups[group.id]" class="overview-course-grid">
              <article v-for="course in group.courses" :key="course.code">
                <a :href="course.href" @click="handleCourseLinkClick($event, course)">
                  <strong>{{ course.name }}</strong>
                  <span>{{ course.code }}</span>
                  <small>{{ course.credits }} 学分 · {{ course.totalHours }} 学时</small>
                </a>
                <button v-if="canManageCourses" type="button" @click="toggleSavedCourse(course)">
                  {{ isSaved(course.code) ? '取消收藏' : '收藏' }}
                </button>
              </article>
            </div>
          </section>
        </div>
      </section>
    </div>
  </section>
</template>
