<script setup>
defineProps({
  users: {
    type: Array,
    required: true,
  },
  activeUserId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['select-user']);
</script>

<template>
  <label class="user-switcher">
    <span>测试账号</span>
    <select :value="activeUserId" @change="emit('select-user', $event.target.value)">
      <option v-for="user in users" :key="user.id" :value="user.id">
        {{ user.nickname }}
      </option>
    </select>
  </label>
</template>
