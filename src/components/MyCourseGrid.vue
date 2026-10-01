<script setup>
defineProps({ courses: { type: Array, default: () => [] }, busy: { type: Boolean, default: false } });
const emit = defineEmits(['remove-course']);
</script>

<template>
  <div class="my-course-grid">
    <article v-for="course in courses" :key="course.courseCode" class="my-course-card">
      <a v-if="course.href" :href="course.href"><strong>{{ course.courseName }}</strong><span>{{ course.courseCode }}</span></a>
      <div v-else class="my-course-card__content"><strong>{{ course.courseName }}</strong><span>{{ course.courseCode }}</span></div>
      <small v-if="course.teacherName || course.classTime || course.classLocation" class="my-course-card__metadata">{{ [course.teacherName, course.classTime, course.classLocation].filter(Boolean).join(' · ') }}</small>
      <button type="button" class="my-course-card__remove" :disabled="busy" :aria-label="`删除课程 ${course.courseName}`" :title="`删除 ${course.courseName}`" @click="emit('remove-course', course)">×</button>
    </article>
  </div>
</template>

<style scoped>
.my-course-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 10px; margin-top: 12px; }
.my-course-card { position: relative; min-width: 0; border: 1px solid var(--color-line); background: var(--color-surface); border-radius: 4px; }
.my-course-card a, .my-course-card__content { display: grid; gap: 5px; padding: 13px 38px 13px 13px; color: var(--color-ink); text-decoration: none; }
.my-course-card strong { font-size: 14px; overflow-wrap: anywhere; }
.my-course-card span { color: var(--color-muted); font-size: 12px; overflow-wrap: anywhere; }
.my-course-card__metadata { display: block; padding: 0 13px 12px; color: var(--color-muted); font-size: 12px; overflow-wrap: anywhere; }
.my-course-card:hover { border-color: var(--demo-primary); }
.my-course-card .my-course-card__remove { position: absolute; right: 4px; top: 4px; display: grid; place-items: center; padding: 0; width: 28px; height: 28px; border: 0; border-radius: 2px; background: transparent; color: #c73131; font-size: 24px; opacity: 0; pointer-events: none; cursor: pointer; }
.my-course-card:hover .my-course-card__remove, .my-course-card:focus-within .my-course-card__remove { opacity: 1; pointer-events: auto; }
.my-course-card__remove:hover { background: #ffeded; }
@media (hover: none) { .my-course-card .my-course-card__remove { opacity: 1; pointer-events: auto; } }
</style>
