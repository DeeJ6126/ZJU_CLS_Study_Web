<script setup>
import { computed } from 'vue';

import { parseMarkdownAnswer } from '../../services/markdownAnswerService.js';
import { buildAnswerMarkdownBlocks } from '../../services/quizAnswerViewService.js';

const props = defineProps({
  result: {
    type: Object,
    default: null,
  },
  explanation: {
    type: [String, Object],
    default: '',
  },
  correctLabel: {
    type: String,
    default: '答案正确',
  },
  incorrectLabel: {
    type: String,
    default: '答案错误',
  },
  referenceLabel: {
    type: String,
    default: '参考答案',
  },
});

const answerBlocks = computed(() => buildAnswerMarkdownBlocks(props.result));
const explanationBlocks = computed(() => parseMarkdownAnswer(props.explanation));
const label = computed(() => {
  if (props.result?.isCorrect === true) {
    return props.correctLabel;
  }
  if (props.result?.isCorrect === false) {
    return props.incorrectLabel;
  }
  return props.referenceLabel;
});
</script>

<template>
  <div v-if="result" class="practice-result">
    <strong>{{ label }}</strong>
    <div v-if="answerBlocks.length" class="markdown-answer">
      <template v-for="(block, blockIndex) in answerBlocks" :key="blockIndex">
        <h3 v-if="block.type === 'heading' && block.level === 1">{{ block.text }}</h3>
        <h4 v-else-if="block.type === 'heading'">{{ block.text }}</h4>
        <ol v-else-if="block.type === 'list' && block.ordered">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
        </ol>
        <ul v-else-if="block.type === 'list'">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
        </ul>
        <pre v-else-if="block.type === 'code'"><code>{{ block.text }}</code></pre>
        <p v-else>{{ block.text }}</p>
      </template>
    </div>
    <div v-if="explanationBlocks.length" class="markdown-answer">
      <template v-for="(block, blockIndex) in explanationBlocks" :key="`explanation-${blockIndex}`">
        <h3 v-if="block.type === 'heading' && block.level === 1">{{ block.text }}</h3>
        <h4 v-else-if="block.type === 'heading'">{{ block.text }}</h4>
        <ol v-else-if="block.type === 'list' && block.ordered">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
        </ol>
        <ul v-else-if="block.type === 'list'">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
        </ul>
        <pre v-else-if="block.type === 'code'"><code>{{ block.text }}</code></pre>
        <p v-else>{{ block.text }}</p>
      </template>
    </div>
  </div>
</template>
