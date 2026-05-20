<script setup>
import AuthStatusBadges from './account/AuthStatusBadges.vue';

defineProps({
  themes: {
    type: Array,
    required: true,
  },
  activeThemeId: {
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

const emit = defineEmits(['select-theme']);
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-title">
    <div class="settings-header">
      <p class="settings-header__eyebrow">设置</p>
      <h1 id="settings-title">账号状态与主题</h1>
      <p>这里管理主题偏好；账号注册与登录请使用页面底部入口。</p>
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
