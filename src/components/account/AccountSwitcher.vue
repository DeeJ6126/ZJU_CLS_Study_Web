<script setup>
defineProps({
  options: {
    type: Array,
    required: true,
  },
  activeId: {
    type: String,
    required: true,
  },
  accountActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select', 'reset']);
</script>

<template>
  <div class="account-switcher">
    <label class="account-switcher__label">
      <span>演示身份</span>
      <select :value="activeId" @change="emit('select', $event.target.value)">
        <option value="">真实账号（当前登录）</option>
        <option v-for="option in options" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </select>
    </label>
    <p class="account-switcher__hint">
      演示数据仅保存在当前浏览器，不会提交到服务器。切换身份可测试独立的课程、收藏、投稿和消息。
    </p>
    <button v-if="accountActive" class="account-switcher__reset" type="button" @click="emit('reset')">
      重置当前演示账号
    </button>
  </div>
</template>
