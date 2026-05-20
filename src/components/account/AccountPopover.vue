<script setup>
import AuthStatusBadges from './AuthStatusBadges.vue';

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
});

const emit = defineEmits(['change-avatar', 'logout', 'open-login', 'open-register-cc98', 'open-register-email']);
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
        <button
          class="account-avatar account-avatar--large"
          type="button"
          aria-label="更改头像颜色"
          :style="{ backgroundColor: user.avatarColor }"
          @click="emit('change-avatar')"
        >
          {{ user.avatarInitials }}
        </button>
        <span>点击头像可切换前端测试颜色</span>
      </div>
    </div>

    <div v-if="isGuest" class="account-popover__actions">
      <button type="button" @click="emit('open-register-cc98')">CC98注册</button>
      <button type="button" @click="emit('open-register-email')">浙大邮箱注册</button>
      <button type="button" @click="emit('open-login')">登录</button>
    </div>

    <button v-else class="account-popover__logout" type="button" @click="emit('logout')">退出登录</button>
  </aside>
</template>
