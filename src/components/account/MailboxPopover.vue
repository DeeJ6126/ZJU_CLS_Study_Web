<script setup>
defineProps({
  messages: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <aside class="mailbox-popover" aria-label="信箱">
    <header>
      <p class="popover-kicker">信箱</p>
      <h2>站内消息</h2>
    </header>

    <div v-if="messages.length" class="mailbox-list">
      <article v-for="message in messages" :key="message.id" class="mailbox-item">
        <strong>{{ message.title }}</strong>
        <p>{{ message.body }}</p>
      </article>
    </div>

    <p v-else class="mailbox-empty">
      当前没有消息。后续管理员会在这里收到投稿申请，学号认证用户会收到评论提醒。
    </p>
  </aside>
</template>
