<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { courseOptionLabel, filterAdminCourses } from '../../services/adminCourseService.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  courses: { type: Array, default: () => [] },
  pendingCourseCodes: { type: Array, default: () => [] },
  allowAll: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '输入课程代码或名称' },
});

const emit = defineEmits(['update:modelValue', 'change']);
const root = ref(null);
const input = ref(null);
const query = ref('');
const open = ref(false);
const activeIndex = ref(-1);

const selectedCourse = computed(() => props.courses.find((course) => course.code === props.modelValue) ?? null);
const visibleCourses = computed(() => filterAdminCourses(props.courses, query.value));
const pendingSet = computed(() => new Set(props.pendingCourseCodes));
const inputPlaceholder = computed(() => (props.allowAll ? '全部课程（可输入检索）' : props.placeholder));

function syncQuery() {
  query.value = courseOptionLabel(selectedCourse.value);
}

function showOptions() {
  if (props.disabled) return;
  open.value = true;
  activeIndex.value = -1;
  input.value?.select();
}

function toggleOptions() {
  if (open.value) {
    open.value = false;
    syncQuery();
  } else {
    showOptions();
    input.value?.focus();
  }
}

function handleInput() {
  open.value = true;
  activeIndex.value = -1;
}

function choose(course) {
  const value = course?.code ?? '';
  query.value = courseOptionLabel(course);
  open.value = false;
  activeIndex.value = -1;
  emit('update:modelValue', value);
  emit('change', value);
}

function handleKeydown(event) {
  const options = visibleCourses.value;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    open.value = true;
    activeIndex.value = Math.min(activeIndex.value + 1, options.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  } else if (event.key === 'Enter' && open.value) {
    event.preventDefault();
    if (activeIndex.value >= 0 && options[activeIndex.value]) choose(options[activeIndex.value]);
    else if (options.length === 1) choose(options[0]);
  } else if (event.key === 'Escape') {
    open.value = false;
    syncQuery();
  }
}

function handleDocumentPointerDown(event) {
  if (!root.value?.contains(event.target)) {
    open.value = false;
    syncQuery();
  }
}

watch(() => [props.modelValue, props.courses], syncQuery, { immediate: true, deep: true });
onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown));
</script>

<template>
  <div ref="root" class="admin-course-combobox" :class="{ 'is-open': open }">
    <input
      ref="input"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      :aria-expanded="open"
      aria-autocomplete="list"
      aria-controls="admin-course-options"
      :disabled="disabled"
      :required="required"
      :placeholder="inputPlaceholder"
      @focus="showOptions"
      @input="handleInput"
      @keydown="handleKeydown"
    >
    <button type="button" class="admin-course-combobox__toggle" :disabled="disabled" aria-label="展开课程列表" @click="toggleOptions">
      <span aria-hidden="true">⌄</span>
    </button>
    <div v-if="open" id="admin-course-options" class="admin-course-combobox__options" role="listbox">
      <button v-if="allowAll && !query" type="button" role="option" :aria-selected="modelValue === ''" @click="choose(null)">
        <span>全部课程</span>
      </button>
      <button
        v-for="(course, index) in visibleCourses"
        :key="course.code"
        type="button"
        role="option"
        :class="{ 'is-active': index === activeIndex, 'is-selected': course.code === modelValue }"
        :aria-selected="course.code === modelValue"
        @mouseenter="activeIndex = index"
        @click="choose(course)"
      >
        <span><strong>{{ course.code }}</strong> · {{ course.name }}</span>
        <span v-if="pendingSet.has(course.code)" class="admin-course-combobox__pending" title="有待审核投稿" aria-label="有待审核投稿"></span>
      </button>
      <p v-if="!visibleCourses.length" class="admin-course-combobox__empty">没有匹配的课程</p>
    </div>
  </div>
</template>
