<script setup>
import AuthStatusBadges from './AuthStatusBadges.vue';
import UserSwitcher from './UserSwitcher.vue';

defineProps({
  user: {
    type: Object,
    required: true,
  },
  users: {
    type: Array,
    required: true,
  },
  activeUserId: {
    type: String,
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
});

const emit = defineEmits(['select-user', 'change-avatar']);
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

    <UserSwitcher
      :users="users"
      :active-user-id="activeUserId"
      @select-user="emit('select-user', $event)"
    />
  </aside>
</template>
