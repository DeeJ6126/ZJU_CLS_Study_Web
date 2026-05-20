<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  mode: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['close', 'submit-register-cc98', 'submit-login-cc98', 'switch-mode']);

const cc98Name = ref('');
const code = ref('');
const password = ref('');
const activeTab = ref('cc98');

const title = computed(() => (props.mode === 'login' ? '登录' : '注册'));

function submitRegisterCc98() {
  emit('submit-register-cc98', {
    cc98Name: cc98Name.value,
    code: code.value,
    password: password.value,
  });
}

function submitLoginCc98() {
  emit('submit-login-cc98', {
    cc98Name: cc98Name.value,
    password: password.value,
  });
}

watch(() => props.mode, () => {
  cc98Name.value = '';
  code.value = '';
  password.value = '';
  activeTab.value = 'cc98';
});
</script>

<template>
  <div class="auth-dialog">
    <header class="auth-dialog__header">
      <h2>{{ title }}</h2>
      <button type="button" class="auth-dialog__close" @click="emit('close')">关闭</button>
    </header>
    <div class="auth-dialog__tabs">
      <button
        type="button"
        :class="{ 'is-active': activeTab === 'cc98' }"
        @click="activeTab = 'cc98'"
      >
        CC98
      </button>
      <button
        type="button"
        :class="{ 'is-active': activeTab === 'email' }"
        @click="activeTab = 'email'"
      >
        学校邮箱
      </button>
    </div>

    <form v-if="activeTab === 'cc98'" class="auth-dialog__body" @submit.prevent="props.mode === 'login' ? submitLoginCc98() : submitRegisterCc98()">
      <label>
        <span>CC98名字</span>
        <input v-model="cc98Name" type="text" autocomplete="username" />
      </label>
      <label v-if="props.mode !== 'login'">
        <span>验证码</span>
        <input v-model="code" type="text" autocomplete="off" />
      </label>
      <label>
        <span>密码</span>
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <button type="submit">{{ props.mode === 'login' ? '登录' : '注册' }}</button>
      <p v-if="props.message" class="auth-dialog__message">{{ props.message }}</p>
    </form>
    <div v-else class="auth-dialog__body">
      <p class="auth-dialog__disabled">学校邮箱注册/登录暂未开放。</p>
    </div>
  </div>
</template>
