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
});

const emit = defineEmits(['select']);
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
      演示身份仅改变界面展示，不改变真实登录状态；真实写操作仍按后端会话执行。
      如需登录真实账号，请先切回「真实账号」。
    </p>
  </div>
</template>
