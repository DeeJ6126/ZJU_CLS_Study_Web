<script setup>
defineProps({
  selectedValue: {
    type: [Boolean, null],
    default: null,
  },
  locked: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select']);
</script>

<template>
  <div class="practice-options practice-options--tf">
    <button
      type="button"
      :class="{ 'is-selected': selectedValue === true }"
      :disabled="locked"
      @click="emit('select', true)"
    >
      T 正确
    </button>
    <button
      type="button"
      :class="{ 'is-selected': selectedValue === false }"
      :disabled="locked"
      @click="emit('select', false)"
    >
      F 错误
    </button>
  </div>
</template>
