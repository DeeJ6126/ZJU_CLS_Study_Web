<script setup>
import { profile } from '../data/profile.js';

defineProps({
  themes: {
    type: Array,
    required: true,
  },
  activeThemeId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['select-theme']);
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-title">
    <div class="settings-header">
      <p class="settings-header__eyebrow">Settings</p>
      <h1 id="settings-title">设置</h1>
      <p>登录系统后续会接入 CC98 验证码认证与浙大邮箱认证。当前先整理账号展示与主题偏好。</p>
    </div>

    <div class="settings-layout">
      <article class="settings-section account-section">
        <div class="settings-section__title">
          <span>账号</span>
          <small>Profile</small>
        </div>

        <div class="account-card">
          <div class="account-fields" aria-label="账号信息">
            <label class="profile-field">
              <span>昵称</span>
              <input type="text" :value="profile.nickname" readonly />
            </label>
            <label class="profile-field">
              <span>CC98 昵称</span>
              <input type="text" :value="profile.cc98Nickname" readonly />
            </label>
          </div>

          <div class="profile-picture" aria-label="头像">
            <span class="profile-picture__title">头像</span>
            <div class="avatar-preview" aria-hidden="true">{{ profile.avatarInitials }}</div>
            <button class="avatar-edit" type="button" disabled>暂未开放</button>
          </div>
        </div>
      </article>

      <article class="settings-section theme-section">
        <div class="settings-section__title">
          <span>主题</span>
          <small>Appearance</small>
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
