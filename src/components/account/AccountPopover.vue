<script setup>
import AuthStatusBadges from './AuthStatusBadges.vue';
import AccountSwitcher from './AccountSwitcher.vue';

defineProps({
  user: {
    type: Object,
    required: true,
  },
  accountState: {
    type: Object,
    required: true,
  },
  badges: {
    type: Array,
    required: true,
  },
  isGuest: {
    type: Boolean,
    required: true,
  },
  canBindEmail: {
    type: Boolean,
    default: false,
  },
  unreadCount: { type: Number, default: 0 },
  demoOptions: {
    type: Array,
    default: () => [],
  },
  demoActiveId: {
    type: String,
    default: '',
  },
  canOpenAdmin: { type: Boolean, default: false },
  demoAccountActive: { type: Boolean, default: false },
});

const emit = defineEmits([
  'logout', 'open-login', 'open-register-cc98',
  'open-register-email', 'open-bind-email', 'open-profile', 'open-notifications',
  'open-admin',
  'select-demo',
  'reset-demo',
]);
</script>

<template>
  <aside class="account-popover" aria-label="账号面板">
    <div class="account-popover__main">
      <div class="account-popover__fields">
        <p class="popover-kicker">账号状态</p>
        <h2>{{ accountState.label }}</h2>
        <AuthStatusBadges :badges="badges" />

        <dl>
          <div>
            <dt>昵称</dt>
            <dd>{{ user.nickname }}</dd>
          </div>
          <div>
            <dt>CC98昵称</dt>
            <dd>{{ user.cc98Nickname || '未绑定' }}</dd>
          </div>
          <div>
            <dt>注册邮箱</dt>
            <dd>{{ user.email || '未绑定' }}</dd>
          </div>
        </dl>
      </div>

      <div class="account-popover__avatar">
        <img v-if="user.avatarUrl" class="account-avatar account-avatar--large" :src="user.avatarUrl" alt="" />
        <span
          v-else
          class="account-avatar account-avatar--large"
          :style="{ backgroundColor: user.avatarColor }"
          aria-hidden="true"
        >{{ user.avatarInitials }}</span>
      </div>
    </div>

    <div v-if="isGuest" class="account-popover__actions">
      <button type="button" @click="emit('open-register-cc98')">CC98注册</button>
      <button type="button" @click="emit('open-register-email')">浙大邮箱注册</button>
      <button type="button" @click="emit('open-login')">登录</button>
    </div>

    <div v-else class="account-popover__signed-in-actions">
      <button type="button" @click="emit('open-profile')">个人主页</button>
      <button type="button" @click="emit('open-notifications')">
        站内消息<span v-if="unreadCount"> {{ unreadCount }}</span>
      </button>
      <button v-if="canOpenAdmin" type="button" @click="emit('open-admin')">管理后台</button>
      <button
        v-if="canBindEmail"
        type="button"
        @click="emit('open-bind-email')"
      >
        绑定浙大邮箱
      </button>
      <button class="account-popover__logout" type="button" @click="emit('logout')">退出登录</button>
    </div>

    <AccountSwitcher
      v-if="demoOptions.length"
      class="account-popover__switcher"
      :options="demoOptions"
      :active-id="demoActiveId"
      :account-active="demoAccountActive"
      @select="emit('select-demo', $event)"
      @reset="emit('reset-demo')"
    />
  </aside>
</template>
