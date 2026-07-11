<script setup>
import { buildOptionStateClass } from '../../services/quizAnswerViewService.js';

defineProps({
  options: {
    type: Array,
    default: () => [],
  },
  selectedKey: {
    type: String,
    default: '',
  },
  result: {
    type: Object,
    default: null,
  },
  locked: {
    type: Boolean,
    default: false,
  },
  vocabularyEnabled: {
    type: Boolean,
    default: false,
  },
  optionTextResolver: {
    type: Function,
    default: (option) => option?.textCn || option?.text || '',
  },
});

const emit = defineEmits(['select', 'pick-vocabulary']);

function optionClass(optionKey, selectedKey, result) {
  return buildOptionStateClass({ optionKey, selectedKey, result });
}
</script>

<template>
  <div class="practice-options">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :class="optionClass(option.key, selectedKey, result)"
      :disabled="locked || vocabularyEnabled"
      @click="emit('select', option.key)"
    >
      <strong>{{ option.key }}</strong>
      <span>{{ optionTextResolver(option) }}</span>
    </button>
  </div>
</template>
