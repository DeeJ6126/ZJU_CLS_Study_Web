<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import {
  curriculumOptions,
  curriculumPrograms,
} from '../data/courses/programCatalog.js';
import {
  buildAllCourseSections,
  buildProgramCategorySections,
  buildProgramSemesterSections,
} from '../services/overviewCatalogService.js';
import {
  buildHashWithQuery,
  getHashQuery,
} from '../services/demoNavigationService.js';

const VALID_GROUPING_MODES = new Set(['category', 'semester']);
const DEFAULT_PROGRAM_ID = 'all';

function programIdForGrade(grade) {
  if (grade == null) return '';
  const year = String(grade);
  return curriculumPrograms[year] ? year : '';
}

function readFiltersFromHash() {
  const params = getHashQuery(window.location.hash);
  const programId = params.get('program');
  const grouping = params.get('group');
  return {
    programId: curriculumPrograms[programId] ? programId : '',
    grouping: VALID_GROUPING_MODES.has(grouping) ? grouping : 'category',
  };
}

const initialFilters = readFiltersFromHash();
const courses = ref([]);
const selectedProgramId = ref(initialFilters.programId || DEFAULT_PROGRAM_ID);
const groupingMode = ref(initialFilters.grouping);
const isLoading = ref(true);
const loadError = ref('');
const collapsedSections = reactive({});
const collapsedGroups = reactive({});
const props = defineProps({
  canManageCourses: { type: Boolean, default: false },
  savedCourseCodes: { type: Array, default: () => [] },
  userGrade: { type: Number, default: null },
});
const emit = defineEmits(['add-course', 'remove-course']);

function applyDefaultFromGrade() {
  if (selectedProgramId.value !== DEFAULT_PROGRAM_ID) return;
  const fallback = programIdForGrade(props.userGrade);
  if (fallback) selectedProgramId.value = fallback;
}

function syncOverviewHash() {
  const params = {};
  if (selectedProgramId.value !== DEFAULT_PROGRAM_ID) {
    params.program = selectedProgramId.value;
  }
  if (groupingMode.value !== 'category') {
    params.group = groupingMode.value;
  }
  const nextHash = buildHashWithQuery('overview', params);
  if (window.location.hash !== nextHash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

watch(
  [selectedProgramId, groupingMode],
  () => { syncOverviewHash(); },
);

watch(
  () => props.userGrade,
  () => { applyDefaultFromGrade(); },
);

const selectedProgram = computed(() => curriculumPrograms[selectedProgramId.value] ?? null);
const isProgramSelected = computed(() => Boolean(selectedProgram.value));

const sections = computed(() => {
  if (!selectedProgram.value) {
    return buildAllCourseSections(courses.value);
  }
  if (groupingMode.value === 'semester') {
    return buildProgramSemesterSections(courses.value, selectedProgram.value);
  }
  return buildProgramCategorySections(courses.value, selectedProgram.value);
});

const visibleCourseCount = computed(() => sections.value.reduce((total, section) => {
  if (section.courses) {
    return total + section.courses.length;
  }
  return total + section.courseCount;
}, 0));

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

onMounted(async () => {
  applyDefaultFromGrade();
  try {
    const catalog = await loadResourceCatalog();
    courses.value = catalog.courses;
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
        <span>培养方案</span>
        <select v-model="selectedProgramId">
          <option
            v-for="option in curriculumOptions"
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
            :class="{ 'is-active': groupingMode === 'category' }"
            @click="groupingMode = 'category'"
          >
            按课程类别
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

      <a v-if="selectedProgram" :href="selectedProgram.sourceUrl" target="_blank" rel="noreferrer">
        查看培养方案原文
      </a>
    </div>

    <p v-if="isLoading" class="overview-empty">正在加载课程目录...</p>
    <p v-else-if="loadError" class="overview-empty">{{ loadError }}</p>

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
                  {{ isSaved(course.code) ? '移出我的课程' : '加入我的课程' }}
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
                <a :href="course.href">
                  <strong>{{ course.name }}</strong>
                  <span>{{ course.code }}</span>
                  <small>{{ course.credits }} 学分 · {{ course.totalHours }} 学时</small>
                </a>
                <button v-if="canManageCourses" type="button" @click="toggleSavedCourse(course)">
                  {{ isSaved(course.code) ? '移出我的课程' : '加入我的课程' }}
                </button>
              </article>
            </div>
          </section>
        </div>
      </section>
    </div>
  </section>
</template>
