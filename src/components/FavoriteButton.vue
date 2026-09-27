<script setup>
import { starPath } from '../utils/vendor/lucidePaths.js';

defineProps({
  active: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle']);
</script>

<template>
  <button
    class="favorite-button"
    type="button"
    :class="{ 'is-active': active }"
    :disabled="disabled"
    :aria-pressed="active"
    :aria-label="active ? '取消收藏' : '收藏'"
    :title="disabled ? '完成学号认证后可收藏' : active ? '取消收藏' : '收藏'"
    @click.prevent="emit('toggle')"
  >
    <svg viewBox="0 0 24 24" :fill="active ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path :d="starPath" />
    </svg>
  </button>
</template>
