<script setup>
import { onMounted, reactive, ref } from 'vue';
import { loadResourceCatalog, programOptions, resourceProgramMeta } from '../data/courses/resourceData.js';

const collapsedSections = reactive({});
const collapsedGroups = reactive({});
const resourceSections = ref([]);
const isLoading = ref(true);
const loadError = ref('');

function toggleSection(sectionId) {
  collapsedSections[sectionId] = !collapsedSections[sectionId];
}

function toggleGroup(groupId) {
  collapsedGroups[groupId] = !collapsedGroups[groupId];
}

function countSectionCourses(section) {
  return section.groups.reduce((total, group) => total + group.courses.length, 0);
}

onMounted(async () => {
  try {
    const catalog = await loadResourceCatalog();
    resourceSections.value = catalog.sections;
  } catch (error) {
    loadError.value = '课程目录加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="resource-page" aria-labelledby="resource-title">
    <header class="resource-hero">
      <div>
        <h1 id="resource-title">资源中心</h1>
        <p>{{ resourceProgramMeta.note }}</p>
      </div>
      <label class="program-selector" aria-label="选择培养方案">
        <span>培养方案</span>
        <select value="2024">
          <option
            v-for="option in programOptions"
            :key="option.year"
            :value="option.year"
            :disabled="!option.available"
          >
            {{ option.label }}{{ option.available ? '' : '（暂未支持）' }}
          </option>
        </select>
      </label>
    </header>

    <div class="resource-stack">
      <p v-if="isLoading" class="resource-empty">正在加载课程目录...</p>
      <p v-else-if="loadError" class="resource-empty">{{ loadError }}</p>
      <template v-else>
      <section
        v-for="section in resourceSections"
        :key="section.id"
        class="resource-category"
        :class="`resource-category--${section.id}`"
      >
        <button
          class="resource-category__header"
          type="button"
          :aria-expanded="!collapsedSections[section.id]"
          @click="toggleSection(section.id)"
        >
          <span>
            <strong>{{ section.title }}</strong>
          </span>
          <span class="resource-category__meta">
            {{ countSectionCourses(section) }} 门
            <i aria-hidden="true">{{ collapsedSections[section.id] ? '+' : '−' }}</i>
          </span>
        </button>

        <div v-if="!collapsedSections[section.id]" class="resource-category__body">
          <section
            v-for="group in section.groups"
            :key="group.id"
            class="resource-group"
            :class="{ 'resource-group--plain': !group.title }"
          >
            <button
              v-if="group.title"
              class="resource-group__header"
              type="button"
              :aria-expanded="!collapsedGroups[group.id]"
              @click="toggleGroup(group.id)"
            >
              <span>{{ group.title }}</span>
              <em>{{ group.courses.length ? `${group.courses.length} 门` : '说明' }}</em>
              <i aria-hidden="true">{{ collapsedGroups[group.id] ? '+' : '−' }}</i>
            </button>

            <div v-if="!collapsedGroups[group.id]" class="resource-grid">
              <a
                v-for="course in group.courses"
                :id="`resource-${section.id}-${course.code}`"
                :key="`${group.id}-${course.code}`"
                class="resource-card"
                :href="course.href"
                :title="course.name"
              >
                <span class="resource-card__content">
                  <strong>{{ course.name }}</strong>
                  <em>{{ course.code }}</em>
                </span>
                <span class="resource-card__details">
                  <span>{{ course.credits }} 学分</span>
                  <span>{{ course.totalHours }} 学时</span>
                </span>
              </a>

              <p v-if="!group.courses.length" class="resource-empty">
                该模块按培养方案保留为开放修读入口，后续可接入跨院系课程与学生自选课程。
              </p>
            </div>
          </section>
        </div>
      </section>
      </template>
    </div>
  </section>
</template>
