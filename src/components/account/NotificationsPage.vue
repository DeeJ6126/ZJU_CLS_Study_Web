<script setup>
import { getProfileHref } from '../../services/demoNavigationService.js';
import { formatRelativeTime, isoDateTime } from '../../utils/timeFormat.js';

defineProps({
  notifications: { type: Array, default: () => [] },
  unreadCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  notice: { type: String, default: '' },
});
const emit = defineEmits(['read', 'read-all', 'open-target']);
</script>

<template>
  <article class="notifications-page">
    <aside class="profile-sidebar">
      <a href="#home">返回首页</a>
      <strong>站内消息</strong>
    </aside>
    <main class="notifications-main">
      <header class="notifications-head">
        <div><p>Notifications</p><h1>站内消息</h1></div>
        <button v-if="unreadCount" type="button" @click="emit('read-all')">全部标为已读</button>
      </header>
      <p v-if="notice" class="profile-notice">{{ notice }}</p>
      <p v-if="loading" class="profile-state">正在加载消息...</p>
      <p v-else-if="!notifications.length" class="profile-state">当前没有消息。</p>
      <div v-else class="notification-list">
        <article v-for="notification in notifications" :key="notification.id" :class="{ 'is-unread': !notification.readAt }">
          <a v-if="notification.actor" :href="getProfileHref(notification.actor.publicId)" class="notification-actor">
            <img v-if="notification.actor.avatarUrl" :src="notification.actor.avatarUrl" alt="" />
            <span v-else>{{ notification.actor.nickname?.slice(0, 1) }}</span>
          </a>
          <div>
            <strong>{{ notification.title }}</strong>
            <p>{{ notification.body }}</p>
            <time :datetime="isoDateTime(notification.createdAt)">{{ formatRelativeTime(notification.createdAt) }}</time>
          </div>
          <button type="button" @click="emit('open-target', notification)">查看</button>
          <button v-if="!notification.readAt" type="button" @click="emit('read', notification)">标为已读</button>
        </article>
      </div>
    </main>
  </article>
</template>
