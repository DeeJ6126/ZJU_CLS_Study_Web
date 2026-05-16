<script setup>
import { ref } from 'vue';

const props = defineProps({
  tabLabel: {
    type: String,
    required: true,
  },
  canSubmit: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['submit-contribution']);
const title = ref('');
const notice = ref('');

function submitContribution() {
  const cleanTitle = title.value.trim() || `补充${props.tabLabel}`;

  if (!props.canSubmit) {
    notice.value = '需要登录并完成 CC98 或浙大邮箱认证后才可以投稿。';
    return;
  }

  emit('submit-contribution', cleanTitle);
  notice.value = '投稿申请已发送到开发者信箱。';
  title.value = '';
}
</script>

<template>
  <section class="contribution-box" aria-label="投稿入口">
    <div>
      <p class="course-detail__kicker">投稿入口</p>
      <h2>补充{{ tabLabel }}</h2>
      <p>认证用户可以先提交申请，后续接入后端后再上传文件和正文。</p>
    </div>
    <form @submit.prevent="submitContribution">
      <label>
        <span>投稿标题</span>
        <input v-model="title" type="text" placeholder="例如：第六章复习提纲" />
      </label>
      <button type="submit">{{ canSubmit ? '提交申请' : '需要登录' }}</button>
    </form>
    <p v-if="notice" class="contribution-box__notice">{{ notice }}</p>
  </section>
</template>
