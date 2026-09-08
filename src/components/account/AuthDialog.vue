<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  mode: { type: String, required: true },
  message: { type: String, default: '' },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits([
  'close', 'request-email-code', 'submit-register-email',
  'submit-login-email', 'submit-reset-email', 'switch-mode',
]);

const studentId = ref('');
const nickname = ref('');
const code = ref('');
const password = ref('');
const panelRef = ref(null);

const title = computed(() => ({ login: '登录', register: '学号认证注册', reset: '找回密码' }[props.mode] ?? '账号'));
const emailPurpose = computed(() => ({ register: 'register', reset: 'password-reset' }[props.mode] ?? 'register'));

function submit() {
  const payload = {
    studentId: studentId.value,
    nickname: nickname.value,
    code: code.value,
    password: password.value,
  };
  const event = {
    login: 'submit-login-email', register: 'submit-register-email', reset: 'submit-reset-email',
  }[props.mode];
  emit(event, payload);
}

function requestCode() {
  emit('request-email-code', { studentId: studentId.value, purpose: emailPurpose.value });
}

function focusableElements() {
  const root = panelRef.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}

function trapTab(event) {
  if (event.key !== 'Tab') return;
  const focusables = focusableElements();
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
    return;
  }
  trapTab(event);
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  // Move focus into the dialog on open so screen-reader users land on the form.
  nextTick(() => {
    const first = focusableElements()[0];
    if (first) first.focus();
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

watch(() => props.mode, () => {
  studentId.value = '';
  nickname.value = '';
  code.value = '';
  password.value = '';
});
</script>

<template>
  <div class="auth-dialog-backdrop" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="auth-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header class="auth-dialog__header">
        <h2>{{ title }}</h2>
        <button type="button" class="auth-dialog__close" @click="emit('close')" aria-label="关闭登录对话框">关闭</button>
      </header>

      <form class="auth-dialog__body" @submit.prevent="submit">
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

        <label>
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
          {{ busy ? '正在处理...' : mode === 'login' ? '登录' : mode === 'register' ? '完成学号认证注册' : '重置密码' }}
        </button>
        <button v-if="mode === 'login'" class="auth-dialog__text-action" type="button" @click="emit('switch-mode', 'reset')">忘记密码</button>
        <button v-if="mode === 'reset'" class="auth-dialog__text-action" type="button" @click="emit('switch-mode', 'login')">返回登录</button>
        <p v-if="message" class="auth-dialog__message" role="status">{{ message }}</p>
      </form>
    </div>
  </div>
</template>
