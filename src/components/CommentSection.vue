<script setup>
import { computed, ref } from 'vue';
import { getProfileHref } from '../services/demoNavigationService.js';
import { renderCommentBody } from '../utils/commentUbb.js';

const props = defineProps({
  comments: { type: Array, default: () => [] },
  canComment: { type: Boolean, required: true },
  user: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  notice: { type: String, default: '' },
});
const emit = defineEmits(['add-comment', 'update-comment', 'delete-comment']);
const draft = ref('');
const replyTo = ref(null);
const editingId = ref('');
const editingBody = ref('');

const roots = computed(() => props.comments
  .filter((comment) => !comment.parentCommentId)
  .map((comment) => ({
    ...comment,
    replies: props.comments.filter((reply) => reply.parentCommentId === comment.id),
  })));

const MIN_COMMENT_LENGTH = 2;

function submitComment() {
  const body = draft.value.trim();
  // HI-UI-9: require at least 2 non-whitespace characters so empty / single
  // emoji / punctuation-only comments don't get sent.
  if (body.length < MIN_COMMENT_LENGTH || !props.canComment || props.busy) return;
  emit('add-comment', { body, parentCommentId: replyTo.value?.id ?? '' });
  draft.value = '';
  replyTo.value = null;
}

function startEdit(comment) {
  editingId.value = comment.id;
  editingBody.value = comment.body;
  // HI-UI-6: switching into edit mode cancels any in-progress reply so the
  // next submit doesn't accidentally reply to the wrong comment.
  replyTo.value = null;
}

function saveEdit(comment) {
  const body = editingBody.value.trim();
  if (body.length < MIN_COMMENT_LENGTH) {
    editingId.value = '';
    return;
  }
  emit('update-comment', { comment, body });
  editingId.value = '';
  // HI-UI-6: also clear reply state after a successful edit.
  replyTo.value = null;
}
</script>

<template>
  <section class="comment-section" aria-label="评论区">
    <header>
      <p class="course-detail__kicker">评论区</p>
      <h2>讨论与补充</h2>
    </header>
    <p v-if="notice" class="comment-notice" role="status">{{ notice }}</p>

    <div v-if="roots.length" class="comment-list">
      <article v-for="comment in roots" :key="comment.id" class="comment-thread">
        <div class="comment-item">
          <a v-if="comment.author?.publicId" class="comment-author" :href="getProfileHref(comment.author.publicId)">
            <img v-if="comment.author.avatarUrl" :src="comment.author.avatarUrl" alt="" />
            <span v-else>{{ comment.author.nickname?.slice(0, 1) }}</span>
            <strong>{{ comment.author.nickname }}</strong>
          </a>
          <p class="comment-body" v-html="renderCommentBody(comment.body)"></p>
          <footer>
            <time>{{ comment.createdAt }}</time>
            <button v-if="canComment && !comment.deleted" type="button" @click="replyTo = comment">回复</button>
            <button v-if="comment.canManage && !comment.deleted" type="button" @click="startEdit(comment)">编辑</button>
            <button v-if="comment.canManage && !comment.deleted" type="button" @click="emit('delete-comment', comment)">删除</button>
          </footer>
          <form v-if="editingId === comment.id" class="comment-edit" @submit.prevent="saveEdit(comment)">
            <textarea v-model="editingBody" rows="3" maxlength="1000" required></textarea>
            <button type="submit">保存</button>
            <button type="button" @click="editingId = ''">取消</button>
          </form>
        </div>

        <div v-if="comment.replies.length" class="comment-replies">
          <div v-for="reply in comment.replies" :key="reply.id" class="comment-item comment-item--reply">
            <a v-if="reply.author?.publicId" class="comment-author" :href="getProfileHref(reply.author.publicId)">
              <img v-if="reply.author.avatarUrl" :src="reply.author.avatarUrl" alt="" />
              <span v-else>{{ reply.author.nickname?.slice(0, 1) }}</span>
              <strong>{{ reply.author.nickname }}</strong>
            </a>
            <p class="comment-body" v-html="renderCommentBody(reply.body)"></p>
            <footer>
              <time>{{ reply.createdAt }}</time>
              <button v-if="canComment && !reply.deleted" type="button" @click="replyTo = comment">回复</button>
              <button v-if="reply.canManage && !reply.deleted" type="button" @click="startEdit(reply)">编辑</button>
              <button v-if="reply.canManage && !reply.deleted" type="button" @click="emit('delete-comment', reply)">删除</button>
            </footer>
            <form v-if="editingId === reply.id" class="comment-edit" @submit.prevent="saveEdit(reply)">
              <textarea v-model="editingBody" rows="3" maxlength="1000" required></textarea>
              <button type="submit">保存</button>
              <button type="button" @click="editingId = ''">取消</button>
            </form>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="comment-empty">暂时还没有评论。</p>

    <form v-if="canComment" class="comment-form" @submit.prevent="submitComment">
      <p v-if="replyTo" class="comment-replying">回复 {{ replyTo.author?.nickname }} <button type="button" @click="replyTo = null">取消</button></p>
      <label>
        <span>{{ user.nickname }} 的评论</span>
        <textarea v-model="draft" rows="3" maxlength="1000" placeholder="写下你的补充或问题"></textarea>
      </label>
      <p class="comment-form-hint">支持 UBB 标签 (如 <code>[b]加粗[/b]</code>、<code>[code]代码[/code]</code>、<code>[url=链接]文本[/url]</code>)</p>
      <button type="submit" :disabled="!draft.trim() || busy">发布评论</button>
    </form>
    <p v-else class="permission-note">需要完成学号认证后才可以评论。</p>
  </section>
</template>
