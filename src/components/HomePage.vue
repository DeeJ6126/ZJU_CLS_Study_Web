<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  homePopularResources,
  homeQuizSearchItems,
  homeResourceSearchItems,
  homeSearchKinds,
} from '../data/homeContent.js';
import { activityProgramLabel } from '../data/activityConfig.js';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { buildHomeSearchIndex, searchHomeIndex } from '../services/homeSearchService.js';
import { searchProfiles } from '../services/profileApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  activityClient: { type: Object, default: null },
});
const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);

const activeKind = ref('course');
const query = ref('');
const courses = ref([]);
const catalogMessage = ref('');
const users = ref([]);
const activities = ref([]);
let userSearchSequence = 0;

const activeSearchKind = computed(
  () => homeSearchKinds.find((kind) => kind.id === activeKind.value) ?? homeSearchKinds[0],
);

const searchIndex = computed(() => buildHomeSearchIndex({
  courses: courses.value,
  resources: homeResourceSearchItems,
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

function selectSearchKind(kindId) {
  activeKind.value = kindId;
}

function resourceImage(path) {
  return path ? publicAssetPath(path) : '';
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

onMounted(async () => {
  const [activityResult, catalogResult] = await Promise.all([
    activeActivityClient.value.fetchActivities(),
    loadResourceCatalog().then((catalog) => ({ ok: true, catalog })).catch(() => ({ ok: false })),
  ]);
  if (activityResult.ok) activities.value = activityResult.activities;
  if (catalogResult.ok) courses.value = catalogResult.catalog.courses;
  else catalogMessage.value = '课程目录暂时无法读取，请稍后再试。';
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
          <kbd>Enter</kbd>
        </label>

        <div v-if="hasQuery" class="home-search__results" aria-live="polite">
          <a v-for="item in searchResults" :key="`${item.kind}-${item.id}`" :href="item.href">
            <span>{{ item.kindLabel }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.code || item.courseCode || item.subtitle || item.summary }}</small>
          </a>
          <p v-if="!searchResults.length">没有找到相关{{ activeSearchKind.label }}，试试更短的关键词。</p>
        </div>

        <p v-if="catalogMessage" class="home-search__message">{{ catalogMessage }}</p>
      </div>

      <div v-if="!hasQuery" class="home-search-stage__quicklinks" aria-label="常用入口">
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

      <aside class="home-popular" aria-labelledby="popular-title">
        <header class="home-section-head">
          <div>
            <p>Quick Access</p>
            <h2 id="popular-title">热门资料</h2>
          </div>
        </header>

        <a v-for="(resource, index) in homePopularResources" :key="resource.id" :href="resource.href">
          <img v-if="resource.image" :src="resourceImage(resource.image)" alt="植物茎切片显微图" />
          <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
          <div>
            <strong>{{ resource.title }}</strong>
            <small>{{ resource.meta }}</small>
          </div>
        </a>
      </aside>
    </section>
  </div>
</template>
