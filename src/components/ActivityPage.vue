<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { activityCategories, activityCategoryLabel } from '../data/activityConfig.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  activeSlug: { type: String, default: '' },
  activityClient: { type: Object, default: null },
});
const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);

const activities = ref([]);
const activeCategory = ref('all');
const loading = ref(true);
const message = ref('');

const filteredActivities = computed(() => (
  activeCategory.value === 'all'
    ? activities.value
    : activities.value.filter((item) => item.category === activeCategory.value)
));
const selectedActivity = computed(() => (
  activities.value.find((item) => item.slug === props.activeSlug)
  ?? filteredActivities.value[0]
  ?? activities.value[0]
  ?? null
));
const selectedParagraphs = computed(() => String(selectedActivity.value?.body ?? '')
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean));

function activityHref(slug) {
  return `#activities/${encodeURIComponent(slug)}`;
}

function activityImage(path) {
  return path ? publicAssetPath(path) : '';
}

function selectCategory(categoryId) {
  activeCategory.value = categoryId;
  if (categoryId === 'all') return;
  const first = filteredActivities.value[0];
  if (first) window.location.hash = activityHref(first.slug);
}

watch(() => props.activeSlug, (slug) => {
  const active = activities.value.find((item) => item.slug === slug);
  if (active) activeCategory.value = active.category;
});

onMounted(async () => {
  const result = await activeActivityClient.value.fetchActivities();
  loading.value = false;
  if (!result.ok) {
    message.value = result.message;
    return;
  }
  activities.value = result.activities;
  const active = activities.value.find((item) => item.slug === props.activeSlug);
  if (active) activeCategory.value = active.category;
});
</script>

<template>
  <div class="activities-page">
    <header class="activities-page__head">
      <div>
        <p>Academic Department</p>
        <h1>活动</h1>
      </div>
      <p>从课堂、实验室到校园生活，记录生科学子共同参与的学术与学习实践。</p>
    </header>

    <nav class="activities-filter" aria-label="活动分类">
      <button
        v-for="category in activityCategories"
        :key="category.id"
        type="button"
        :class="{ 'is-active': activeCategory === category.id }"
        @click="selectCategory(category.id)"
      >
        {{ category.label }}
      </button>
    </nav>

    <p v-if="loading" class="activities-state">正在读取活动内容…</p>
    <p v-else-if="message" class="activities-state">{{ message }}</p>
    <p v-else-if="!activities.length" class="activities-state">暂无已发布活动。</p>

    <template v-else>
      <section v-if="selectedActivity" class="activity-feature" :aria-labelledby="`activity-${selectedActivity.slug}`">
        <figure>
          <img
            :src="activityImage(selectedActivity.imageUrl)"
            :alt="selectedActivity.imageAlt"
          />
          <figcaption>{{ activityCategoryLabel(selectedActivity.category) }}</figcaption>
        </figure>
        <article>
          <p class="activity-feature__index">
            {{ String(activities.findIndex((item) => item.id === selectedActivity.id) + 1).padStart(2, '0') }}
          </p>
          <h2 :id="`activity-${selectedActivity.slug}`">{{ selectedActivity.title }}</h2>
          <strong>{{ selectedActivity.summary }}</strong>
          <p v-for="paragraph in selectedParagraphs" :key="paragraph">{{ paragraph }}</p>
        </article>
      </section>

      <section class="activity-directory" aria-labelledby="activity-directory-title">
        <header>
          <p>Activity Index</p>
          <h2 id="activity-directory-title">活动目录</h2>
          <span>{{ filteredActivities.length }} 项</span>
        </header>
        <div class="activity-directory__list">
          <a
            v-for="(activity, index) in filteredActivities"
            :key="activity.id"
            :href="activityHref(activity.slug)"
            :class="{ 'is-active': selectedActivity?.id === activity.id }"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <small>{{ activityCategoryLabel(activity.category) }}</small>
              <strong>{{ activity.title }}</strong>
              <p>{{ activity.summary }}</p>
            </div>
            <b aria-hidden="true">↗</b>
          </a>
        </div>
      </section>
    </template>
  </div>
</template>
