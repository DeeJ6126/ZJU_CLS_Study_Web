<script setup>
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
    @click.prevent="emit('toggle')"
  >
    {{ active ? '已收藏' : '收藏' }}
  </button>
</template>
