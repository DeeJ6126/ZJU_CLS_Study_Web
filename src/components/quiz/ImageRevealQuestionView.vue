<script setup>
defineProps({
  imageSrc: {
    type: String,
    required: true,
  },
  imageAlt: {
    type: String,
    default: '题图',
  },
  result: {
    type: Object,
    default: null,
  },
});
</script>

<template>
  <div class="image-reveal-question">
    <img class="botany-slice-image" :src="imageSrc" :alt="imageAlt" />
    <div v-if="!result" class="practice-result">
      <strong>等待揭晓</strong>
      <p>观察切片图后点击按钮查看答案。</p>
    </div>
    <div v-else class="practice-result">
      <strong>答案</strong>
      <p>{{ result.revealedAnswer?.answer || result.correctDisplay }}</p>
      <p v-if="result.revealedAnswer?.sourceName">来源文件名：{{ result.revealedAnswer.sourceName }}</p>
    </div>
  </div>
</template>
