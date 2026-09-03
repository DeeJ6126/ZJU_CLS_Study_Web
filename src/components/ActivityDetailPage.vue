<script setup>
import { computed } from 'vue';
import { activityProgram, activityProgramIds } from '../data/activityConfig.js';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  slug: { type: String, default: '' },
  activityClient: { type: Object, default: null },
});

const program = computed(() => activityProgram(props.slug));
const isValidSlug = computed(() => activityProgramIds.has(props.slug));

function imageSrc(path) {
  return path ? publicAssetPath(path) : '';
}
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

      <section class="activity-detail-page__placeholder" aria-label="占位说明">
        <p>独立活动页面占位 — 内容待后续完善。</p>
      </section>
    </template>
  </div>
</template>
