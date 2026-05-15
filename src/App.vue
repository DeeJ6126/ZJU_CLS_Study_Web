<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import CourseDetailPage from './components/CourseDetailPage.vue';
import ResourcePage from './components/ResourcePage.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import { getCourseDetail, supportedCourseCodes } from './data/courseDetails.js';
import { navigationItems } from './data/navigation.js';
import { getResourceCourseByCode } from './data/resourceData.js';
import { buildResourceRoute, parseResourceHash, defaultCourseDetailTab } from './data/resourcePaths.js';
import { defaultThemeId, themes } from './data/themes.js';

const activeSection = ref(navigationItems[0].id);
const isSidebarOpen = ref(false);
const isSettingsOpen = ref(false);
const activeThemeId = ref(defaultThemeId);
const activeCourseCode = ref('');
const activeCourseTabId = ref(defaultCourseDetailTab);
const activeCourseItemId = ref('');
const activeSourceCourse = ref(null);

const activeTheme = computed(
  () => themes.find((theme) => theme.id === activeThemeId.value) ?? themes[0],
);
const activeCourse = computed(() => getCourseDetail(activeSourceCourse.value));
const topbarTitle = computed(() => {
  if (isSettingsOpen.value) {
    return '设置';
  }

  if (activeCourse.value) {
    return activeCourse.value.code;
  }

  return activeSection.value === 'resources' ? '资源中心' : '初版导航结构';
});

function syncRouteFromHash() {
  const route = parseResourceHash(window.location.hash);
  activeCourseCode.value = supportedCourseCodes.includes(route.courseCode) ? route.courseCode : '';
  activeCourseTabId.value = route.tabId;
  activeCourseItemId.value = route.itemId;

  if (activeCourseCode.value) {
    activeSection.value = 'resources';
    isSettingsOpen.value = false;
  } else if (route.section === 'resources') {
    activeSection.value = 'resources';
    isSettingsOpen.value = false;
  }
}

function selectNavigation(id) {
  activeSection.value = id;
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  isSettingsOpen.value = false;
  isSidebarOpen.value = false;

  if (id === 'resources') {
    window.location.hash = buildResourceRoute();
  } else if (window.location.hash) {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

function openSettings() {
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  isSettingsOpen.value = true;
  isSidebarOpen.value = false;

  if (window.location.hash) {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

function selectTheme(id) {
  activeThemeId.value = id;
}

function backToResources() {
  activeCourseCode.value = '';
  activeCourseTabId.value = defaultCourseDetailTab;
  activeCourseItemId.value = '';
  activeSection.value = 'resources';
  isSettingsOpen.value = false;

  window.location.hash = buildResourceRoute();
}

onMounted(() => {
  const storedTheme = window.localStorage.getItem('study-platform-theme');
  if (themes.some((theme) => theme.id === storedTheme)) {
    activeThemeId.value = storedTheme;
  }

  syncRouteFromHash();
  window.addEventListener('hashchange', syncRouteFromHash);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRouteFromHash);
});

watch(activeCourseCode, async (courseCode) => {
  activeSourceCourse.value = null;

  if (!courseCode) {
    return;
  }

  activeSourceCourse.value = await getResourceCourseByCode(courseCode);
}, { immediate: true });

watch(activeThemeId, (themeId) => {
  document.documentElement.dataset.theme = themeId;
  window.localStorage.setItem('study-platform-theme', themeId);
}, { immediate: true });
</script>

<template>
  <div class="site-shell" :class="{ 'is-sidebar-open': isSidebarOpen }" id="top">
    <AppSidebar
      :items="navigationItems"
      :active-section="activeSection"
      :settings-active="isSettingsOpen"
      @select-navigation="selectNavigation"
      @open-settings="openSettings"
    />

    <main class="main-content">
      <header class="topbar">
        <button class="sidebar-toggle" type="button" aria-label="打开或收起侧边栏" @click="isSidebarOpen = !isSidebarOpen">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="topbar__identity">
          <span>生命科学学子学习平台</span>
          <strong>{{ topbarTitle }}</strong>
        </div>
      </header>

      <SettingsPanel
        v-if="isSettingsOpen"
        :themes="themes"
        :active-theme-id="activeTheme.id"
        @select-theme="selectTheme"
      />

      <CourseDetailPage
        v-else-if="activeCourse"
        :course="activeCourse"
        :active-tab-id="activeCourseTabId"
        :active-item-id="activeCourseItemId"
        @back="backToResources"
      />

      <ResourcePage v-else-if="activeSection === 'resources'" />

      <template v-else>
        <div class="intro-panel">
          <p class="intro-panel__eyebrow">生命科学学习平台</p>
          <h1>把课程资源、朋辈支持和实验室机会放在同一个清晰入口。</h1>
          <p>
            当前版本先完成侧边栏与信息架构。右侧区域保留为后续资源卡片、活动投稿、
            实验室开放日和榜单展示的内容容器。
          </p>
        </div>

        <div class="section-grid" aria-label="栏目预览">
          <section v-for="item in navigationItems" :key="item.id" class="section-card" :id="item.id">
            <span class="section-card__kicker">{{ item.kicker }}</span>
            <h2>{{ item.label }}</h2>
            <p>{{ item.description }}</p>
            <p v-if="item.children?.length" class="section-card__meta">
              {{ item.children.map((child) => child.label).join(' / ') }}
            </p>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>
