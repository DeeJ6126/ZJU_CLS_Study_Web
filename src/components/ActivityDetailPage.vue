<script setup>
import { computed, onMounted, ref } from 'vue';

import { activityProgram, activityProgramIds } from '../data/activityConfig.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  slug: { type: String, default: '' },
  activityClient: { type: Object, default: null },
});

const program = computed(() => activityProgram(props.slug));
const isValidSlug = computed(() => activityProgramIds.has(props.slug));

const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);
const activities = ref([]);
const message = ref('');

const programArticles = computed(() => {
  if (!program.value) return [];
  const target = program.value.category;
  return activities.value.filter((item) => item.category === target);
});

function imageSrc(path) {
  return path ? publicAssetPath(path) : '';
}

function programSummaryParagraphs(text) {
  if (!text) return [];
  return String(text).split(/\n+/).map((part) => part.trim()).filter(Boolean);
}

onMounted(async () => {
  const result = await activeActivityClient.value.fetchActivities();
  if (!result.ok) {
    message.value = result.message;
    return;
  }
  activities.value = result.activities ?? [];
});
</script>

<template>
  <div class="activity-detail-page">
    <a class="activity-detail-page__back" href="#activities">← 返回活动</a>

    <template v-if="!isValidSlug">
      <header class="activity-detail-page__head">
        <p>Activity</p>
        <h1>未找到对应的活动板块</h1>
        <p>链接可能已失效，请回到活动页面重新选择。</p>
      </header>
    </template>

    <template v-else>
      <header class="activity-detail-page__head">
        <p>{{ program.label }}</p>
        <h1>{{ program.label }}</h1>
        <p>{{ program.summary }}</p>
      </header>

      <figure class="activity-detail-page__hero">
        <img :src="imageSrc(program.imageUrl)" :alt="program.imageAlt">
      </figure>

      <section v-if="programArticles.length" class="activity-detail-page__articles" aria-label="本期文章">
        <header>
          <p>Articles</p>
          <h2>本期文章</h2>
          <span>{{ programArticles.length }} 篇</span>
        </header>
        <ul>
          <li v-for="article in programArticles" :key="article.id">
            <a :href="article.externalUrl" target="_blank" rel="noopener noreferrer">
              <strong>{{ article.title }}</strong>
              <span v-if="article.summary">{{ article.summary }}</span>
              <em aria-hidden="true">↗</em>
            </a>
          </li>
        </ul>
      </section>

      <section v-else-if="message" class="activity-detail-page__placeholder" aria-live="polite">
        <p>{{ message }}</p>
      </section>

      <section v-else class="activity-detail-page__placeholder" aria-label="本板块说明">
        <p>{{ program.label }} 板块目前没有可展示的推文。回到活动页面可查看其他板块。</p>
      </section>
    </template>
  </div>
</template>
