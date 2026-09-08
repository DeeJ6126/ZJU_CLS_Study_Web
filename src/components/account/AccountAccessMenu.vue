<script setup>
defineProps({
  isGuest: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['open-login', 'open-register-email']);
</script>

<template>
  <div class="account-access-menu">
    <button type="button" class="account-access-menu__secondary" @click="emit('open-register-email')">
      学号认证注册
    </button>
    <button type="button" class="account-access-menu__login" @click="emit('open-login')">
      登录
    </button>
  </div>
</template>
