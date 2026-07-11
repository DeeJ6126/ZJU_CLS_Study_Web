<script setup>
defineProps({
  page: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  navigationItems: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: '刷题导航',
  },
});

const emit = defineEmits(['navigate', 'back']);
</script>

<template>
  <div class="quiz-course-app">
    <aside class="quiz-course-nav" :aria-label="ariaLabel">
      <button type="button" class="quiz-course-back" @click="emit('back')">课程</button>
      <strong>{{ title }}</strong>
      <button
        v-for="item in navigationItems"
        :key="item.id"
        type="button"
        :class="{ 'is-active': page === item.id }"
        @click="emit('navigate', item.id)"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="quiz-course-content">
      <slot />
    </main>
  </div>
</template>
