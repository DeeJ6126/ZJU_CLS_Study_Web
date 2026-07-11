<script setup>
import { ref } from 'vue';

defineProps({
  value: {
    type: String,
    default: '',
  },
  locked: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '输入答案后按 Enter 提交',
  },
});

const emit = defineEmits(['input', 'submit']);
const inputElement = ref(null);

function focus() {
  inputElement.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <textarea
    ref="inputElement"
    class="practice-textarea"
    :value="value"
    :disabled="locked"
    :placeholder="placeholder"
    @input="emit('input', $event.target.value)"
    @keydown.enter.prevent="emit('submit')"
  ></textarea>
</template>
