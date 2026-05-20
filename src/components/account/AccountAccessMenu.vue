<script setup>
defineProps({
  isGuest: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['open-login', 'open-register-cc98', 'open-register-email']);
</script>

<template>
  <div class="account-access-menu">
    <button type="button" class="account-access-menu__primary" @click="emit('open-register-cc98')">
      CC98注册
    </button>
    <button type="button" class="account-access-menu__secondary" @click="emit('open-register-email')">
      浙大邮箱注册
    </button>
    <button type="button" class="account-access-menu__login" @click="emit('open-login')">
      登录
    </button>
  </div>
</template>
