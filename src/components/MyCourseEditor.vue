<script setup>
import { computed, ref } from 'vue';
import MyCourseGrid from './MyCourseGrid.vue';
import { searchCoursePicker } from '../services/myCourseService.js';

const props = defineProps({ courses: { type: Array, default: () => [] }, catalog: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false }, catalogError: { type: String, default: '' } });
const emit = defineEmits(['add-course', 'remove-course', 'reset-preset', 'retry-catalog']);
const query = ref('');
const results = computed(() => searchCoursePicker(props.catalog, query.value, props.courses));
function add(course) { emit('add-course', { courseCode: course.code, courseName: course.name }); }
</script>

<template>
  <section class="my-course-editor" aria-label="我的课程设置" :aria-busy="busy">
    <div class="my-course-editor__tools">
      <label>添加课程<input v-model="query" type="search" maxlength="100" placeholder="搜索课程名或课程号" autocomplete="off"></label>
      <button type="button" :disabled="busy" @click="emit('reset-preset')">重新预置本学期课程</button>
    </div>
    <p v-if="catalogError" role="alert">{{ catalogError }} <button type="button" @click="emit('retry-catalog')">重试</button></p>
    <ul v-if="query.trim() && results.length" class="my-course-editor__results" aria-label="可添加课程">
      <li v-for="course in results" :key="course.code"><div><strong>{{ course.name }}</strong><span>{{ course.code }}</span></div><button type="button" :disabled="busy || course.selected" @click="add(course)">{{ course.selected ? '已添加' : '添加' }}</button></li>
    </ul>
    <p v-else-if="query.trim() && catalog.length" role="status">没有匹配的课程，请换个名称或课程号。</p>
    <MyCourseGrid :courses="courses" :busy="busy" @remove-course="emit('remove-course', $event)" />
    <p v-if="!courses.length" class="my-course-editor__empty">暂无课程。</p>
  </section>
</template>

<style scoped>
.my-course-editor { min-width: 0; }
.my-course-editor__tools { display: flex; align-items: end; flex-wrap: wrap; gap: 14px; margin: 18px 0; }
.my-course-editor__tools label { display: grid; gap: 7px; font-size: 14px; flex: 1 1 220px; }
.my-course-editor input { width: 100%; min-width: 0; box-sizing: border-box; min-height: 40px; border: 1px solid var(--color-input-border); border-radius: 4px; padding: 8px 12px; background: var(--color-input); color: var(--color-ink); font: inherit; }
.my-course-editor button { min-height: 36px; border: 1px solid var(--color-line); border-radius: 4px; padding: 6px 12px; background: var(--color-surface); color: var(--color-ink); font: inherit; cursor: pointer; }
.my-course-editor button:disabled { opacity: .6; cursor: default; }
.my-course-editor__results { padding: 0; margin: 0 0 16px; list-style: none; max-height: 300px; overflow-y: auto; border: 1px solid var(--color-line); }
.my-course-editor__results li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--color-line); }
.my-course-editor__results li > div { display: grid; gap: 4px; min-width: 0; }
.my-course-editor__results strong { font-size: 14px; overflow-wrap: anywhere; }
.my-course-editor__results span, .my-course-editor__empty { color: var(--color-muted); font-size: 13px; }
</style>
