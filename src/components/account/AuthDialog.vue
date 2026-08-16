<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  mode: { type: String, required: true },
  initialTab: { type: String, default: 'cc98' },
  message: { type: String, default: '' },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits([
  'close', 'submit-register-cc98', 'submit-login-cc98', 'request-email-code',
  'submit-register-email', 'submit-login-email', 'submit-reset-email',
  'submit-bind-email', 'switch-mode',
]);

const cc98Name = ref('');
const studentId = ref('');
const nickname = ref('');
const code = ref('');
const password = ref('');
const activeTab = ref(props.initialTab);

const isEmailOnly = computed(() => ['reset', 'bind'].includes(props.mode));
const title = computed(() => ({ login: '登录', register: '注册', reset: '找回密码', bind: '绑定浙大邮箱' }[props.mode] ?? '账号'));
const emailPurpose = computed(() => ({ register: 'register', reset: 'password-reset', bind: 'bind' }[props.mode] ?? 'register'));

function submit() {
  if (activeTab.value === 'cc98') {
    emit(props.mode === 'login' ? 'submit-login-cc98' : 'submit-register-cc98', {
      cc98Name: cc98Name.value,
      code: code.value,
      password: password.value,
    });
    return;
  }
  const payload = {
    studentId: studentId.value,
    nickname: nickname.value,
    code: code.value,
    password: password.value,
  };
  const event = {
    login: 'submit-login-email', register: 'submit-register-email',
    reset: 'submit-reset-email', bind: 'submit-bind-email',
  }[props.mode];
  emit(event, payload);
}

function requestCode() {
  emit('request-email-code', { studentId: studentId.value, purpose: emailPurpose.value });
}

watch(() => [props.mode, props.initialTab], () => {
  cc98Name.value = '';
  studentId.value = '';
  nickname.value = '';
  code.value = '';
  password.value = '';
  activeTab.value = isEmailOnly.value ? 'email' : props.initialTab;
});
</script>

<template>
  <div class="auth-dialog" role="dialog" aria-modal="true" :aria-label="title">
    <header class="auth-dialog__header">
      <h2>{{ title }}</h2>
      <button type="button" class="auth-dialog__close" @click="emit('close')">关闭</button>
    </header>

    <div v-if="!isEmailOnly" class="auth-dialog__tabs">
      <button type="button" :class="{ 'is-active': activeTab === 'cc98' }" @click="activeTab = 'cc98'">CC98</button>
      <button type="button" :class="{ 'is-active': activeTab === 'email' }" @click="activeTab = 'email'">浙大邮箱</button>
    </div>

    <form class="auth-dialog__body" @submit.prevent="submit">
      <template v-if="activeTab === 'cc98'">
        <label v-if="mode === 'login'">
          <span>CC98 名字</span>
          <input v-model.trim="cc98Name" type="text" required autocomplete="username" />
        </label>
        <label v-else>
          <span>CC98 验证码</span>
          <input v-model.trim="code" type="text" required autocomplete="one-time-code" />
        </label>
      </template>

      <template v-else>
        <label v-if="mode === 'register'">
          <span>昵称</span>
          <input
            v-model.trim="nickname"
            type="text"
            required
            minlength="2"
            maxlength="20"
            autocomplete="nickname"
            placeholder="2 至 20 位中文、字母或数字"
          />
        </label>
        <label>
          <span>浙大邮箱</span>
          <span class="auth-dialog__email-field">
            <input
              v-model.trim="studentId"
              type="text"
              required
              inputmode="numeric"
              pattern="[0-9]+"
              autocomplete="username"
              placeholder="输入学号"
            />
            <strong>@zju.edu.cn</strong>
          </span>
        </label>
        <div v-if="mode !== 'login'" class="auth-dialog__code-row">
          <label>
            <span>邮箱验证码</span>
            <input v-model.trim="code" type="text" required inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
          </label>
          <button type="button" :disabled="busy || !studentId" @click="requestCode">发送验证码</button>
        </div>
      </template>

      <label v-if="mode !== 'bind'">
        <span>{{ mode === 'reset' ? '新密码' : '密码' }}</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="8"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        />
      </label>

      <button type="submit" :disabled="busy">
        {{ busy ? '正在处理...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : mode === 'reset' ? '重置密码' : '完成绑定' }}
      </button>
      <button v-if="mode === 'login' && activeTab === 'email'" class="auth-dialog__text-action" type="button" @click="emit('switch-mode', 'reset')">忘记密码</button>
      <button v-if="mode === 'reset'" class="auth-dialog__text-action" type="button" @click="emit('switch-mode', 'login')">返回登录</button>
      <p v-if="message" class="auth-dialog__message" role="status">{{ message }}</p>
    </form>
  </div>
</template>
