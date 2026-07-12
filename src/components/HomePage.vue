<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  homeActivities,
  homePopularResources,
  homeQuizSearchItems,
  homeResourceSearchItems,
  homeSearchKinds,
} from '../data/homeContent.js';
import { loadResourceCatalog } from '../data/courses/resourceData.js';
import { buildHomeSearchIndex, searchHomeIndex } from '../services/homeSearchService.js';
import { publicAssetPath } from '../utils/publicPath.js';

const activeKind = ref('course');
const query = ref('');
const courses = ref([]);
const catalogMessage = ref('');

const activeSearchKind = computed(
  () => homeSearchKinds.find((kind) => kind.id === activeKind.value) ?? homeSearchKinds[0],
);

const searchIndex = computed(() => buildHomeSearchIndex({
  courses: courses.value,
  resources: homeResourceSearchItems,
  quizzes: homeQuizSearchItems,
  activities: homeActivities,
}));

const searchResults = computed(() => searchHomeIndex(searchIndex.value, query.value, activeKind.value));
const hasQuery = computed(() => Boolean(query.value.trim()));

function selectSearchKind(kindId) {
  activeKind.value = kindId;
}

function resourceImage(path) {
  return path ? publicAssetPath(path) : '';
}

onMounted(async () => {
  try {
    const catalog = await loadResourceCatalog();
    courses.value = catalog.courses;
  } catch {
    catalogMessage.value = '课程目录暂时无法读取，请稍后再试。';
  }
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

      <div class="home-search-stage__quicklinks" aria-label="常用入口">
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
          <a href="#about">全部活动</a>
        </header>

        <div class="home-activity-grid">
          <article v-for="(activity, index) in homeActivities" :key="activity.id" :class="`is-${activity.tone}`">
            <span class="home-activity-card__number">0{{ index + 1 }}</span>
            <div>
              <p>{{ activity.eyebrow }}</p>
              <h3>{{ activity.title }}</h3>
              <span>{{ activity.summary }}</span>
            </div>
            <a :href="activity.href">{{ activity.actionLabel }} <b aria-hidden="true">→</b></a>
          </article>
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
