<script setup>
import { ref } from 'vue';

const props = defineProps({
  comments: {
    type: Array,
    default: () => [],
  },
  canComment: {
    type: Boolean,
    required: true,
  },
  user: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['add-comment']);
const draft = ref('');

function submitComment() {
  const text = draft.value.trim();

  if (!text || !props.canComment) {
    return;
  }

  emit('add-comment', text);
  draft.value = '';
}
</script>

<template>
  <section class="comment-section" aria-label="评论区">
    <header>
      <p class="course-detail__kicker">评论区</p>
      <h2>讨论与补充</h2>
    </header>

    <div v-if="comments.length" class="comment-list">
      <article v-for="comment in comments" :key="comment.id" class="comment-item">
        <strong>{{ comment.author }}</strong>
        <p>{{ comment.body }}</p>
        <span>{{ comment.createdAt }}</span>
      </article>
    </div>

    <p v-else class="comment-empty">暂时还没有评论。</p>

    <form v-if="canComment" class="comment-form" @submit.prevent="submitComment">
      <label>
        <span>{{ user.nickname }} 的评论</span>
        <textarea v-model="draft" rows="3" placeholder="写下你的补充或问题"></textarea>
      </label>
      <button type="submit" :disabled="!draft.trim()">发布评论</button>
    </form>

    <p v-else class="permission-note">需要完成 CC98 或浙大邮箱认证后才可以评论。</p>
  </section>
</template>
