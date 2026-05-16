<script setup>
defineProps({
  badges: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <span class="auth-badges" aria-label="账号认证状态">
    <span v-for="badge in badges" :key="badge" class="auth-badge">
      {{ badge }}
    </span>
  </span>
</template>
