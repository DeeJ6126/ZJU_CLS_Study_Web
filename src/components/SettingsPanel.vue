<script setup>
import AuthStatusBadges from './account/AuthStatusBadges.vue';
import UserSwitcher from './account/UserSwitcher.vue';

defineProps({
  themes: {
    type: Array,
    required: true,
  },
  activeThemeId: {
    type: String,
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

const emit = defineEmits(['select-theme', 'select-user']);
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-title">
    <div class="settings-header">
      <p class="settings-header__eyebrow">设置</p>
      <h1 id="settings-title">账号状态与主题</h1>
      <p>这里先保留前端账号骨架和主题偏好，后续接入真实登录后可以直接替换测试账号来源。</p>
    </div>

    <div class="settings-layout">
      <article class="settings-section account-section">
        <div class="settings-section__title">
          <span>账号状态</span>
          <small>前端测试</small>
        </div>

        <div class="account-status-card">
          <div>
            <p class="settings-section__kicker">当前身份</p>
            <h2>{{ accountState.label }}</h2>
            <p>{{ accountState.description }}</p>
            <AuthStatusBadges :badges="badges" />
          </div>

          <UserSwitcher
            :users="users"
            :active-user-id="activeUserId"
            @select-user="emit('select-user', $event)"
          />
        </div>
      </article>

      <article class="settings-section theme-section">
        <div class="settings-section__title">
          <span>主题</span>
          <small>全站生效</small>
        </div>

        <div class="theme-grid" role="radiogroup" aria-label="主题选择">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="theme-option"
            :class="{ 'is-selected': activeThemeId === theme.id }"
            type="button"
            role="radio"
            :aria-checked="activeThemeId === theme.id"
            @click="emit('select-theme', theme.id)"
          >
            <span class="theme-option__swatches" aria-hidden="true">
              <span
                v-for="swatch in theme.swatches"
                :key="swatch"
                :style="{ backgroundColor: swatch }"
              ></span>
            </span>
            <span class="theme-option__copy">
              <strong>{{ theme.name }}</strong>
              <em>{{ theme.description }}</em>
            </span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
