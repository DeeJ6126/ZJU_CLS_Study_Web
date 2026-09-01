<script setup>
import { computed, onMounted, ref } from 'vue';

import { activityPrograms } from '../data/activityConfig.js';
import { activityApiClient } from '../services/activityApiClient.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  activeSlug: { type: String, default: '' },
  activityClient: { type: Object, default: null },
});

const activeActivityClient = computed(() => props.activityClient ?? activityApiClient);
const activities = ref([]);
const loading = ref(true);
const message = ref('');

const activitiesByProgram = computed(() => {
  const grouped = new Map(activityPrograms.map((program) => [program.id, []]));
  for (const activity of activities.value) {
    grouped.get(activity.programId)?.push(activity);
  }
  return grouped;
});

function activityImage(path) {
  return path ? publicAssetPath(path) : '';
}

onMounted(async () => {
  const result = await activeActivityClient.value.fetchActivities();
  loading.value = false;
  if (!result.ok) {
    message.value = result.message;
    return;
  }
  activities.value = result.activities;
});
</script>

<template>
  <div class="activities-page">
    <header class="activities-page__head">
      <div>
        <p>Academic Department</p>
        <h1>活动</h1>
      </div>
      <p>按六个长期板块整理学院活动。目录收录对应公众号推文，点击标题即可阅读原文。</p>
    </header>

    <nav class="activities-jump" aria-label="活动板块">
      <a v-for="program in activityPrograms" :key="program.id" :href="`#activity-program-${program.id}`">
        {{ program.label }}
      </a>
    </nav>

    <p v-if="loading" class="activities-state">正在读取活动目录...</p>
    <p v-else-if="message" class="activities-state">{{ message }}</p>

    <div v-else class="activity-programs">
      <section
        v-for="(program, programIndex) in activityPrograms"
        :id="`activity-program-${program.id}`"
        :key="program.id"
        class="activity-program"
        :aria-labelledby="`activity-program-title-${program.id}`"
      >
        <div class="activity-program__intro">
          <figure>
            <img :src="activityImage(program.imageUrl)" :alt="program.imageAlt">
          </figure>
          <div>
            <span>{{ String(programIndex + 1).padStart(2, '0') }}</span>
            <h2 :id="`activity-program-title-${program.id}`">{{ program.label }}</h2>
            <p>{{ program.summary }}</p>
          </div>
        </div>

        <div class="activity-directory">
          <header>
            <div>
              <p>Articles</p>
              <h3>活动目录</h3>
            </div>
            <span>{{ activitiesByProgram.get(program.id)?.length ?? 0 }} 篇</span>
          </header>

          <div v-if="activitiesByProgram.get(program.id)?.length" class="activity-directory__list">
            <a
              v-for="activity in activitiesByProgram.get(program.id)"
              :key="activity.id"
              :href="activity.externalUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img :src="activityImage(activity.imageUrl)" :alt="activity.imageAlt">
              <strong>{{ activity.title }}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p v-else class="activity-directory__empty">暂无收录推文</p>
        </div>
      </section>
    </div>
  </div>
</template>
